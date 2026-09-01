/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Uploading photographs to Supabase Storage, and removing them again.
 *
 * Replaces the FileReader/base64 approach that put whole images in text
 * columns. Four components grew their own copy of that block, each with its own
 * validation and its own error handling; this is the one place it lives now, so
 * the rules cannot drift apart again.
 *
 * A caller gets back a URL to store in the row it was already storing base64
 * in. Nothing about the read path changes — a Storage URL is a shorter string
 * in the same column, and AppImage takes either.
 *
 * NO PROGRESS EVENTS. supabase-js's `upload()` is a single fetch with no
 * progress callback; byte-level progress needs the resumable (TUS) endpoint,
 * which is a much larger dependency. Callers show an indeterminate busy state
 * instead — honest about "working", silent about "how far".
 */

import { getDataClient } from './supabase';

/** Matches the limit enforced by the buckets themselves in migration 0021. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Buckets from migration 0021. */
export type MediaBucket = 'public-media' | 'customer-uploads';

export interface UploadResult {
  /** The public URL to store on the record. Absent when the upload failed. */
  url?: string;
  /** Storage path, kept so the object can be removed later. */
  path?: string;
  /** Present only on failure, already phrased for a person to read. */
  error?: string;
}

/**
 * Rejects a file before any network call.
 *
 * Storage enforces both of these too, so this is about telling someone what is
 * wrong with the file they picked rather than about security.
 */
export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return `${file.name} is not an image.`;
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `${file.name} is a ${file.type.replace('image/', '').toUpperCase()} — use JPEG, PNG, WEBP or GIF.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is 5MB.`;
  }
  return null;
}

/** The file's extension, from its name, falling back to its MIME type. */
function extensionFor(file: File): string {
  const fromName = file.name.includes('.') ? file.name.split('.').pop()! .toLowerCase() : '';
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  const fromType = file.type.split('/')[1];
  return fromType === 'jpeg' ? 'jpg' : (fromType || 'jpg');
}

/**
 * Uploads one image and returns its URL.
 *
 * The stored name is a fresh UUID, never the original filename: two staff
 * uploading `photo.jpg` must not collide, and a filename is the one part of an
 * upload the person choosing it controls.
 */
export async function uploadImage(
  file: File,
  options: { bucket?: MediaBucket; folder: string }
): Promise<UploadResult> {
  const { bucket = 'public-media', folder } = options;

  const invalid = validateImageFile(file);
  if (invalid) return { error: invalid };

  const supabase = getDataClient();
  if (!supabase) {
    return { error: 'Photo uploads are unavailable — the storage connection is not configured.' };
  }

  const path = `${folder}/${crypto.randomUUID()}.${extensionFor(file)}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false
  });

  if (error) {
    // Storage speaks in status codes; the person uploading needs a cause and a
    // next step. Anything unrecognised keeps its original message rather than
    // being flattened into "something went wrong".
    const raw = error.message || '';
    let friendly = `${file.name} could not be uploaded. ${raw}`;

    if (/exceeded the maximum allowed size|payload too large|413/i.test(raw)) {
      friendly = `${file.name} is too large for the photo library (5MB limit).`;
    } else if (/row-level security|not authorized|403/i.test(raw)) {
      friendly = 'You do not have permission to upload photos. Sign in again, or ask a Super Admin to check your access.';
    } else if (/bucket not found|404/i.test(raw)) {
      friendly = 'The photo library is not set up yet — migration 0021 has not been applied to this project.';
    } else if (/fetch|network|timeout/i.test(raw)) {
      friendly = `${file.name} could not be uploaded — the connection dropped. Check your network and try again.`;
    }

    console.error(`uploadImage: ${path} failed:`, raw);
    return { error: friendly };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) {
    return { error: `${file.name} uploaded, but its address could not be read. Please try again.` };
  }

  return { url: data.publicUrl, path };
}

/** Uploads several files, keeping the ones that worked and reporting the rest. */
export async function uploadImages(
  files: File[],
  options: { bucket?: MediaBucket; folder: string }
): Promise<{ urls: string[]; errors: string[] }> {
  const results = await Promise.all(files.map(file => uploadImage(file, options)));

  return {
    urls: results.map(r => r.url).filter((u): u is string => !!u),
    errors: results.map(r => r.error).filter((e): e is string => !!e)
  };
}

/** Whether a stored value is one of our Storage objects, rather than base64 or an external link. */
export function isStorageUrl(value: string | null | undefined, bucket: MediaBucket = 'public-media'): boolean {
  if (!value || typeof value !== 'string') return false;
  if (!/^https?:\/\//i.test(value)) return false;
  return value.includes(`/storage/v1/object/public/${bucket}/`) || value.includes(`/${bucket}/`);
}

/**
 * The path inside the bucket for one of our URLs, or null if it is not ours.
 *
 * Deliberately strict: a value that is base64, an external link, or from a
 * different bucket yields null, so `removeImage` can never be pointed at
 * something this app did not upload.
 */
export function storagePathFromUrl(url: string, bucket: MediaBucket = 'public-media'): string | null {
  if (!isStorageUrl(url, bucket)) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const path = url.slice(at + marker.length).split('?')[0];
  return path ? decodeURIComponent(path) : null;
}

/**
 * Deletes objects by URL. Best effort by design.
 *
 * A photograph nobody references costs a little storage; a save that refuses to
 * complete because cleanup failed costs the studio their work. So failures are
 * logged and reported, never thrown, and the caller carries on.
 *
 * Values that are not ours — base64, external links — are skipped rather than
 * treated as errors: callers pass whatever the record held.
 */
export async function removeImages(
  urls: Array<string | null | undefined>,
  bucket: MediaBucket = 'public-media'
): Promise<{ removed: number; failed: number }> {
  const paths = urls
    .map(u => (u ? storagePathFromUrl(u, bucket) : null))
    .filter((p): p is string => !!p);

  if (paths.length === 0) return { removed: 0, failed: 0 };

  const supabase = getDataClient();
  if (!supabase) return { removed: 0, failed: paths.length };

  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) {
    console.error('removeImages: cleanup failed for', paths, error.message);
    return { removed: 0, failed: paths.length };
  }

  return { removed: paths.length, failed: 0 };
}
