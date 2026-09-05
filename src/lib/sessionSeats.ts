/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Authoritative seat counts for workshop sessions.
 *
 * WHY THIS EXISTS
 * Availability used to be summed in the browser from the `bookings` and `queue`
 * arrays in AppContext. Both are RLS-scoped to the caller, so a signed-out
 * visitor summed an empty array and a signed-in customer summed only their own
 * rows. Every session therefore read as completely open, however full it was.
 *
 * The count has to come from the database, where a SECURITY DEFINER function
 * can see every booking without exposing any of them. `session_seats_summary`
 * (migration 0023) returns capacity, taken and remaining for a batch of session
 * ids in one call, so a twelve-session workshop costs one round trip rather
 * than twelve.
 *
 * NOT KNOWING IS A DISTINCT STATE
 * `get()` returns undefined for any session whose count has not arrived — still
 * loading, request failed, or the id is not in the result. It never falls back
 * to a number. A default of 0 would show a bookable session as full; a default
 * of capacity would show a full session as wide open and invite a customer to
 * spend a checkout flow on a seat that does not exist. Callers must render
 * nothing at all until they have a real figure.
 *
 * NO REALTIME
 * RPC results are not a subscription — Postgres emits postgres_changes for
 * tables, not for function calls — so these numbers do not live-update. They
 * are fetched on mount, whenever the set of session ids changes, when the
 * signed-in session changes, and whenever notifySeatsChanged() is called after
 * a write that moves a seat. That is deliberate: seat counts are read far more
 * often than they change, and the authoritative check still happens inside
 * book_session_seats under a row lock at the moment of booking.
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { getDataClient, onDataClientChange } from './supabase';

export interface SessionSeats {
  capacity: number;
  seatsTaken: number;
  seatsRemaining: number;
}

export interface SessionSeatsState {
  /**
   * Seats for one session, or undefined if the real number is not known yet.
   * Never guesses.
   */
  get: (sessionId?: string) => SessionSeats | undefined;
  /** True while a fetch is in flight and nothing has arrived yet. */
  loading: boolean;
  /** Set when the last fetch failed. Callers show no figure, not a wrong one. */
  error: string | null;
  /** Force a re-read — used after a booking completes. */
  refresh: () => void;
}

/** Listeners woken by notifySeatsChanged(). */
const seatListeners = new Set<() => void>();

/**
 * Tell every mounted seat reader that a seat has moved.
 *
 * Called after booking, cancelling or checking in — the writes that change what
 * these functions would return. Without this the page a customer just booked
 * from would keep showing the pre-booking count until it remounted.
 */
export function notifySeatsChanged(): void {
  seatListeners.forEach(listener => listener());
}

/**
 * Fetch seat counts for a set of sessions.
 *
 * The id list is compared by value, not by identity: callers build it inside a
 * render from a filtered array, so a new array arrives every render and keying
 * the effect on the array itself would refetch forever.
 */
export function useSessionSeats(sessionIds: string[]): SessionSeatsState {
  const [seats, setSeats] = useState<Map<string, SessionSeats> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Stable, order-independent identity for the requested set.
  const idKey = useMemo(
    () => Array.from(new Set(sessionIds.filter(Boolean).map(String))).sort().join(','),
    [sessionIds]
  );

  // Refetch when the signed-in session changes, and on demand after a write.
  useEffect(() => {
    const bump = () => setNonce(n => n + 1);
    seatListeners.add(bump);
    const unsubscribeClient = onDataClientChange(bump);
    return () => {
      seatListeners.delete(bump);
      unsubscribeClient();
    };
  }, []);

  // Guards against a slow response from a previous id set overwriting a newer
  // one. Requests are not cancellable, so the stale reply is discarded instead.
  const requestRef = useRef(0);

  useEffect(() => {
    const ids = idKey ? idKey.split(',') : [];
    if (ids.length === 0) {
      setSeats(new Map());
      setLoading(false);
      setError(null);
      return;
    }

    const client = getDataClient();
    if (!client) {
      // Supabase is not configured. Report it as unknown rather than as zero
      // seats, which would falsely mark everything full.
      setSeats(null);
      setLoading(false);
      setError('Availability is unavailable.');
      return;
    }

    const requestId = ++requestRef.current;
    setLoading(true);

    client
      .rpc('session_seats_summary', { p_session_ids: ids })
      .then(({ data, error: rpcError }) => {
        if (requestId !== requestRef.current) return; // superseded
        if (rpcError) {
          // Deliberately does NOT clear a previous result: the last known
          // figures are closer to the truth than nothing, and the booking
          // itself is still guarded server-side.
          setError(rpcError.message);
          setLoading(false);
          return;
        }
        const next = new Map<string, SessionSeats>();
        for (const row of (data as any[]) || []) {
          next.set(String(row.session_id), {
            capacity: Number(row.capacity) || 0,
            seatsTaken: Number(row.seats_taken) || 0,
            seatsRemaining: Number(row.seats_remaining) || 0
          });
        }
        setSeats(next);
        setError(null);
        setLoading(false);
      });
  }, [idKey, nonce]);

  return useMemo(
    () => ({
      get: (sessionId?: string) => (sessionId ? seats?.get(String(sessionId)) : undefined),
      loading: loading && seats === null,
      error,
      refresh: () => setNonce(n => n + 1)
    }),
    [seats, loading, error]
  );
}

/**
 * Seats for a single session, read straight from the database.
 *
 * For the submit-time guard, which checks one session at the moment of booking
 * and must not depend on anything cached.
 */
export async function fetchSessionSeats(sessionId: string): Promise<SessionSeats | null> {
  const client = getDataClient();
  if (!client) return null;

  const { data, error } = await client.rpc('session_seats_summary', { p_session_ids: [sessionId] });
  if (error) return null;

  const row = ((data as any[]) || [])[0];
  if (!row) return null;

  return {
    capacity: Number(row.capacity) || 0,
    seatsTaken: Number(row.seats_taken) || 0,
    seatsRemaining: Number(row.seats_remaining) || 0
  };
}
