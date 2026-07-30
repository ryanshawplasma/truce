'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMessages, leaveRoom, sendMessage } from '../actions';
import { daysBetween } from '@/lib/format';
import { COUPLE_MESSAGE_MAX as MAX_MESSAGE_LENGTH } from '@/lib/constants';
import { burstFrom, withTimeout } from '@/app/components/ui';
import BetaChip from '@/app/components/BetaChip';

/**
 * The room.
 *
 * Messages are plain React children, so they are escaped like everything else
 * in Truce — a message of "<script>" is just a very odd thing to type.
 *
 * Polling rather than websockets: every 4 seconds we ask for anything newer
 * than the highest id we hold. It is unglamorous, it survives sleeping phones
 * and serverless cold starts, and for two people it is plenty.
 */

const POLL_MS = 4000;

export default function CoupleRoom({ room, side, initialMessages = [] }) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  /* Timestamps and "Today" separators are formatted in the reader's own
     timezone, which the server cannot know — so the list is rendered after
     mount. The messages themselves already arrived with the first response,
     so there is no extra round-trip, just one frame of "opening…". */
  const [mounted, setMounted] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const sendBtnRef = useRef(null);
  const sendingRef = useRef(false);
  /* Highest real (server-assigned) id we have. Optimistic messages get a
     negative id so they can never be mistaken for one. */
  const highestIdRef = useRef(
    initialMessages.reduce((max, m) => (m.id > max ? m.id : max), 0),
  );

  const days = useMemo(() => daysBetween(room.anniversary), [room.anniversary]);

  /* ------------------------------------------------------------- scrolling */
  const stickToBottom = useCallback((smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) stickToBottom(false);
  }, [mounted, stickToBottom]);

  /* ---------------------------------------------------------------- polling */
  useEffect(() => {
    let alive = true;
    let timer = null;

    const poll = async () => {
      try {
        /* A poll that never answers must not stop the next one. */
        const res = await withTimeout(getMessages(highestIdRef.current), 8000, { ok: false, messages: [] });
        if (!alive) return;
        if (res.signedOut) {
          router.push('/couple');
          return;
        }
        if (res.messages && res.messages.length) {
          setMessages((current) => merge(current, res.messages));
          highestIdRef.current = res.messages.reduce(
            (max, m) => (m.id > max ? m.id : max),
            highestIdRef.current,
          );
        }
      } catch {
        /* A failed poll is not worth telling anyone about — try again in 4s. */
      } finally {
        if (alive) timer = window.setTimeout(poll, POLL_MS);
      }
    };

    timer = window.setTimeout(poll, POLL_MS);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [router]);

  /* New messages arriving should bring the view with them. */
  useEffect(() => {
    stickToBottom(true);
  }, [messages.length, stickToBottom]);

  /* ----------------------------------------------------------------- sending */
  const submit = async (e) => {
    if (e) e.preventDefault();
    const text = draft.replace(/\r\n/g, '\n').trim();
    if (!text || sendingRef.current) return;

    sendingRef.current = true;
    setSending(true);
    setNote('');

    /* Optimistic: it appears immediately, greyed until the server confirms. */
    const tempId = -Date.now();
    setMessages((current) => [
      ...current,
      { id: tempId, author: side, body: text.slice(0, MAX_MESSAGE_LENGTH), created_at: new Date().toISOString(), pending: true },
    ]);
    setDraft('');

    if (isOnlyEmoji(text)) burstFrom(sendBtnRef.current, 14);

    try {
      const res = await withTimeout(sendMessage(text), 10000, {
        ok: false,
        error: 'That did not go through. Check your connection and try again.',
      });
      if (res.signedOut) {
        router.push('/couple');
        return;
      }
      if (!res.ok) {
        setMessages((current) => current.filter((m) => m.id !== tempId));
        setDraft(text); // give them their words back
        setNote(res.error || 'Could not send that.');
        return;
      }
      setMessages((current) =>
        merge(
          current.filter((m) => m.id !== tempId),
          [res.message],
        ),
      );
      highestIdRef.current = Math.max(highestIdRef.current, res.message.id);
    } catch {
      setMessages((current) => current.filter((m) => m.id !== tempId));
      setDraft(text);
      setNote('Could not reach the server. Try again in a moment.');
    } finally {
      sendingRef.current = false;
      setSending(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const onSignOut = async () => {
    await leaveRoom();
    router.push('/couple');
  };

  const rows = useMemo(() => withDateSeparators(messages), [messages]);

  return (
    <div className="corner">
      <header className="corner__head">
        <div className="corner__title">
          <span className="corner__name">
            {room.name}
            <BetaChip />
          </span>
          {days !== null && days >= 0 ? (
            <span className="corner__days">Day {days + 1} together 💙</span>
          ) : (
            <span className="corner__days">just the two of you 💙</span>
          )}
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onSignOut}>
          Sign out
        </button>
      </header>

      <div className="corner__list" ref={listRef}>
        {!mounted ? (
          <p className="corner__loading">Opening your corner…</p>
        ) : rows.length === 0 ? (
          <div className="corner__empty">
            <span aria-hidden="true">💌</span>
            <h2>Nothing here yet</h2>
            <p>
              This is the quiet bit before the first message. Say the small thing — &ldquo;are you
              awake?&rdquo; counts.
            </p>
          </div>
        ) : (
          rows.map((row) =>
            row.kind === 'date' ? (
              <p className="corner__date" key={`d-${row.key}`}>
                {row.label}
              </p>
            ) : (
              <Bubble key={row.message.id} message={row.message} mine={row.message.author === side} />
            ),
          )
        )}
      </div>

      <form className="corner__compose" onSubmit={submit}>
        <textarea
          ref={inputRef}
          className="corner__input"
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Say it here…"
          value={draft}
          aria-label="Your message"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            /* Enter sends, Shift+Enter makes a new line — phone keyboards send
               a plain Enter, which is what people expect here. */
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          ref={sendBtnRef}
          type="submit"
          className="btn btn--primary corner__send"
          disabled={sending || !draft.trim()}
          aria-label="Send"
        >
          {sending ? <span className="spinner" aria-hidden="true" /> : '↑'}
        </button>
      </form>

      <p className="corner__note" role="status">
        {note}
      </p>

      <p className="corner__foot">
        <Link href="/">Truce 🤍</Link> · signed in on this device for 30 days · not end-to-end
        encrypted
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ bubbles */

function Bubble({ message, mine }) {
  return (
    <div className={`bubble${mine ? ' bubble--mine' : ''}${message.pending ? ' is-pending' : ''}`}>
      <p className="bubble__body">{message.body}</p>
      <span className="bubble__time">{clockTime(message.created_at)}</span>
    </div>
  );
}

/* -------------------------------------------------------------- little bits */

/** Merge new messages in, keeping ids unique and the order stable. */
function merge(current, incoming) {
  const seen = new Set(current.map((m) => m.id));
  const added = incoming.filter((m) => !seen.has(m.id));
  if (!added.length) return current;
  return [...current, ...added].sort(sortByTime);
}

function sortByTime(a, b) {
  /* Optimistic ids are negative, so fall back to the timestamp for those. */
  if (a.id > 0 && b.id > 0) return a.id - b.id;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

/** Insert "Today" / "Yesterday" / a date between days. */
function withDateSeparators(messages) {
  const rows = [];
  let lastKey = '';
  for (const message of messages) {
    const key = dayKey(message.created_at);
    if (key !== lastKey) {
      rows.push({ kind: 'date', key, label: dayLabel(message.created_at) });
      lastKey = key;
    }
    rows.push({ kind: 'message', message });
  }
  return rows;
}

function dayKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'x';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (dayKey(iso) === dayKey(today.toISOString())) return 'Today';
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return 'Yesterday';
  try {
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return d.toDateString();
  }
}

function clockTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** True when a message is nothing but emoji — worth a little heart burst. */
function isOnlyEmoji(text) {
  const stripped = String(text).replace(/\s/g, '');
  if (!stripped) return false;
  return !/[^\p{Extended_Pictographic}\p{Emoji_Component}]/u.test(stripped);
}
