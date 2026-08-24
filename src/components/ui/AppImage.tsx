/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A plain <img> silently gives up forever on the first failed load — a
 * transient network blip on a slow connection, or a request that raced the
 * browser's own cache warm-up, leaves a permanently blank frame that only a
 * full page refresh (a fresh request) recovers from. That is the "images
 * sometimes don't appear until I refresh" symptom.
 *
 * This wraps <img> with a small bounded retry: on error, it waits briefly
 * and re-issues the request a few times before giving up. Retrying a
 * `data:` URL cannot help (there is no network round trip to retry), so
 * those are left to fail once and are not retried.
 */

import React, { useEffect, useState } from 'react';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 700;

export interface AppImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
}

export const AppImage: React.FC<AppImageProps> = ({ src, onError, ...rest }) => {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  // A new source (e.g. the record finished loading, or the studio changed
  // the photo) always gets a clean slate rather than inheriting a previous
  // image's retry count or failure state.
  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return rest.className ? <div className={rest.className} aria-hidden="true" /> : null;
  }

  // Cache-busted after the first try, so a retried request cannot be served
  // straight back out of a failed/negative cache entry.
  const resolvedSrc =
    attempt === 0 || src.startsWith('data:')
      ? src
      : `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}`;

  return (
    <img
      {...rest}
      src={resolvedSrc}
      onError={e => {
        onError?.(e);
        if (src.startsWith('data:') || attempt >= MAX_RETRIES) {
          setFailed(true);
          return;
        }
        window.setTimeout(() => setAttempt(a => a + 1), RETRY_DELAY_MS * (attempt + 1));
      }}
    />
  );
};

export default AppImage;
