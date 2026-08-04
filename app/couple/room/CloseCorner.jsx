'use client';

import { useEffect, useRef, useState } from 'react';
import { askToClose } from '../actions';
import { withTimeout } from '@/app/components/ui';

/**
 * Closing a corner — the panel behind the quiet link at the bottom of the room.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS TRYING NOT TO BE
 * ─────────────────────────────────────────────────────────────────────────────
 * A corner holds things neither person can get back. The interface for ending
 * one should be honest about that and should be impossible to trip over: no
 * red button next to "Sign out", no single tap, nothing that can be done by a
 * person holding somebody else's unlocked phone.
 *
 * So: both people ask, each with the password, inside ten minutes. Either can
 * withdraw. Doing nothing is a veto — the clock runs out on its own. The rules
 * live on the server (see askToClose); everything here is a way of showing
 * them.
 *
 * The countdown is the one piece of state that has to be live, so it ticks
 * locally from `msLeft` rather than asking the server every second. When it
 * reaches zero the panel asks once for the truth and settles.
 */

function mmss(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function CloseCorner({ state, onState, onClosed, onDismiss }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [left, setLeft] = useState(state ? state.msLeft : 0);
  const busyRef = useRef(false);
  const inputRef = useRef(null);

  /* Server truth resets the clock; the tick below only counts it down. */
  useEffect(() => {
    setLeft(state ? state.msLeft : 0);
  }, [state]);

  useEffect(() => {
    if (!left) return undefined;
    const id = setInterval(() => setLeft((v) => Math.max(0, v - 1000)), 1000);
    return () => clearInterval(id);
  }, [left > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const send = async (withdraw) => {
    if (busyRef.current) return;
    if (!withdraw && !password) {
      setNote('Type the password first.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setNote('');

    try {
      const res = await withTimeout(askToClose(withdraw ? '' : password, withdraw), 12000, {
        ok: false,
        error: 'That did not go through. Check your connection and try again.',
      });

      if (res.closed) {
        onClosed();
        return;
      }
      if (res.signedOut || res.gone) {
        onClosed();
        return;
      }
      if (!res.ok) {
        setNote(res.error || 'That did not work.');
        return;
      }

      setPassword('');
      onState(res);
      setNote(
        res.withdrawn
          ? 'Withdrawn. Nothing will happen.'
          : 'Asked. Nothing happens until they ask too.',
      );
    } catch {
      setNote('Could not reach the server. Try again in a moment.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const mine = !!(state && state.mine);
  const theirs = !!(state && state.theirs);
  const setup = !!(state && state.setup);

  return (
    <div className="closer" role="dialog" aria-modal="true" aria-label="Close this corner">
      <button type="button" className="closer__backdrop" onClick={onDismiss} aria-label="Cancel" />

      <div className="closer__panel">
        <h2 className="closer__title">Close this corner?</h2>

        {setup ? (
          <>
            <p className="closer__body">{state.error}</p>
            <div className="closer__actions">
              <button type="button" className="btn btn--ghost btn--wide" onClick={onDismiss}>
                Never mind
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="closer__body">
              This deletes every message and every photo in here, for both of you, and it cannot be
              undone.
            </p>
            <p className="closer__body">
              It takes both of you: you each enter the password within ten minutes of each other.
              Either of you can change your mind, and if one of you does nothing at all, nothing
              happens.
            </p>

            {theirs ? (
              <p className="closer__flag closer__flag--theirs" role="status">
                They have asked to close this corner.{' '}
                {left > 0 ? <b>{mmss(left)} left to agree.</b> : <b>That ask has expired.</b>}
              </p>
            ) : null}

            {mine ? (
              <p className="closer__flag" role="status">
                You have asked.{' '}
                {theirs ? null : left > 0 ? (
                  <>
                    Waiting for them — <b>{mmss(left)} left.</b>
                  </>
                ) : (
                  <b>Your ask has expired.</b>
                )}
              </p>
            ) : null}

            {mine && left > 0 ? (
              <div className="closer__actions">
                <button
                  type="button"
                  className="btn btn--primary btn--wide"
                  onClick={() => send(true)}
                  disabled={busy}
                >
                  {busy ? <span className="spinner" aria-hidden="true" /> : 'Change my mind'}
                </button>
                <button type="button" className="btn btn--ghost btn--wide" onClick={onDismiss}>
                  Back to the chat
                </button>
              </div>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="closePass">The corner password</label>
                  <input
                    ref={inputRef}
                    className="input"
                    id="closePass"
                    type="password"
                    autoComplete="current-password"
                    maxLength={200}
                    placeholder="the one you both know"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        send(false);
                      }
                    }}
                  />
                </div>

                <div className="closer__actions">
                  <button
                    type="button"
                    className="btn btn--danger btn--wide"
                    onClick={() => send(false)}
                    disabled={busy}
                  >
                    {busy ? <span className="spinner" aria-hidden="true" /> : 'Ask to close it'}
                  </button>
                  <button type="button" className="btn btn--ghost btn--wide" onClick={onDismiss}>
                    Never mind
                  </button>
                </div>
              </>
            )}
          </>
        )}

        <p className="closer__note" role="status">
          {note}
        </p>
      </div>
    </div>
  );
}
