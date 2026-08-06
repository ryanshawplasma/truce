'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getClosingState,
  getGallery,
  getMessages,
  getUploadUrl,
  leaveRoom,
  refreshMedia,
  sendMessage,
} from '../actions';
import CloseCorner from './CloseCorner';
import { daysBetween } from '@/lib/format';
import { buildRows, clockTime, splitLinks } from '@/lib/chat';
import { COUPLE_MESSAGE_MAX as MAX_MESSAGE_LENGTH } from '@/lib/constants';
import {
  MEDIA_ACCEPT,
  MEDIA_BROKEN_MESSAGE,
  MEDIA_CAPTION_MAX,
  MEDIA_MAX_EDGE,
  MEDIA_MAX_ORIGINAL_BYTES,
  MEDIA_MAX_UPLOAD_BYTES,
  MEDIA_NOT_IMAGE_MESSAGE,
  MEDIA_TARGET_BYTES,
  MEDIA_TOO_BIG_MESSAGE,
} from '@/lib/media';
import { burstFrom, withTimeout } from '@/app/components/ui';
import BetaChip from '@/app/components/BetaChip';
import InstallPrompt from '@/app/components/InstallPrompt';

/**
 * The room.
 *
 * Messages are plain React children, so they are escaped like everything else
 * in Truce — a message of "<script>" is just a very odd thing to type.
 *
 * Polling rather than websockets: every 4 seconds we ask for anything newer
 * than the highest id we hold. It is unglamorous, it survives sleeping phones
 * and serverless cold starts, and for two people it is plenty.
 *
 * PHOTOS
 * ------
 * A photo never travels through a server action. The browser shrinks it, asks
 * for a one-shot signed upload URL, PUTs the bytes straight at Supabase
 * Storage, and only then tells the server "there is an object at this path".
 * The server picks the path, so the browser cannot choose where it lands, and
 * re-checks it anyway. Downloads are short-lived signed URLs, re-minted on
 * every fetch — see attachMediaUrls in lib/couple.js.
 */

const POLL_MS = 4000;

/* Closing state changes far less often than messages do, and only ever because
   a person deliberately did something. Riding along with every fourth message
   poll keeps the other side informed within about sixteen seconds without
   doubling the number of database reads a quiet room makes. */
const CLOSING_EVERY = 4;

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

  /* Photos */
  const [uploading, setUploading] = useState(false);
  const [photoNote, setPhotoNote] = useState('');
  const [view, setView] = useState('chat'); // 'chat' | 'gallery'
  const [gallery, setGallery] = useState({ state: 'idle', photos: [], setup: false });
  const [viewer, setViewer] = useState(null); // { src, caption }

  /* Closing the corner */
  const [closing, setClosing] = useState(null); // null until the first poll answers
  const [closerOpen, setCloserOpen] = useState(false);

  /* The "jump to latest" button, and how much has landed since they scrolled
     up. Zero unread still shows the button — sometimes you just want back. */
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const [unread, setUnread] = useState(0);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const sendBtnRef = useRef(null);
  const pickRef = useRef(null);
  const pickBtnRef = useRef(null);
  const sendingRef = useRef(false);
  const pollCountRef = useRef(0);
  const uploadingRef = useRef(false);
  /* Whether the list is parked at the bottom. Kept in a ref as well as state
     because the "did anything arrive?" effect below reads it from inside a
     closure that must not go stale. */
  const atBottomRef = useRef(true);
  const prevCountRef = useRef(initialMessages.length);
  /* Object URLs we made for instant previews; released together on unmount. */
  const previewUrlsRef = useRef([]);
  /* Ids we have already asked the server to re-sign, so a genuinely dead photo
     cannot start a refresh loop. */
  const resignedRef = useRef(new Set());
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

  /**
   * A photo has no height until it has loaded, so the scroll-to-bottom that
   * runs when the message arrives is measuring a box that is about to grow.
   * Nudge it again once the picture is really there — but only while they are
   * still down at the bottom, so this can never yank the view away from
   * somebody reading back through last week.
   */
  const onPhotoShown = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 420) stickToBottom(false);
  }, [stickToBottom]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && view === 'chat') stickToBottom(false);
  }, [mounted, view, stickToBottom]);

  /* Release every preview URL exactly once, when the room goes away. */
  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* already gone */
        }
      });
      previewUrlsRef.current = [];
    },
    [],
  );

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

        /* Every fourth pass, and always on the very first one, ask where the
           corner stands on closing — otherwise the other person's request
           would only surface if they happened to open the panel. */
        pollCountRef.current += 1;
        if (pollCountRef.current === 1 || pollCountRef.current % CLOSING_EVERY === 0) {
          const state = await withTimeout(getClosingState(), 8000, null);
          if (!alive || !state) return;
          if (state.gone) {
            /* The other side finished closing it while this tab was open. */
            router.push('/couple?closed=1');
            return;
          }
          if (state.signedOut) {
            router.push('/couple');
            return;
          }
          setClosing(state);
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

  /**
   * New messages arriving should bring the view with them — but only if the
   * view was already down there.
   *
   * Scrolling somebody back to the bottom while they are reading last Tuesday
   * is the single rudest thing a chat can do. If they are up in the history,
   * the arrival is counted instead and offered as a button.
   *
   * Your own message always wins: pressing send means you want to see it.
   */
  useEffect(() => {
    if (view !== 'chat') return;

    const grew = messages.length > prevCountRef.current;
    prevCountRef.current = messages.length;
    if (!grew) return;

    const last = messages[messages.length - 1];
    const mineJustLanded = last && last.author === side;

    if (atBottomRef.current || mineJustLanded) {
      stickToBottom(true);
      setUnread(0);
    } else {
      setUnread((n) => n + 1);
    }
  }, [messages, view, side, stickToBottom]);

  /* One cheap read per scroll frame: are we at the bottom or not? */
  const onListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const bottom = distance < 90;
    atBottomRef.current = bottom;
    setAwayFromBottom(!bottom);
    if (bottom) setUnread(0);
  }, []);

  const jumpToLatest = useCallback(() => {
    atBottomRef.current = true;
    setAwayFromBottom(false);
    setUnread(0);
    stickToBottom(true);
  }, [stickToBottom]);

  /**
   * The composer grows with what is being written, up to the max-height in
   * globals.css, and then scrolls inside itself.
   *
   * Height goes back to `auto` before every measurement, otherwise scrollHeight
   * is reported against the box's current height and the field can only ever
   * get taller — delete a paragraph and you would be left staring at the hole
   * it used to fill.
   */
  const autoGrow = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    autoGrow();
  }, [draft, autoGrow]);

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

  /* ---------------------------------------------------------------- gallery */
  const loadGallery = useCallback(async () => {
    setGallery((g) => ({ ...g, state: 'loading' }));
    try {
      const res = await withTimeout(getGallery(), 12000, { ok: false, photos: [] });
      if (res.signedOut) {
        router.push('/couple');
        return;
      }
      setGallery({ state: 'ready', photos: res.photos || [], setup: !!res.setup });
    } catch {
      setGallery({ state: 'ready', photos: [], setup: false });
    }
  }, [router]);

  /* ------------------------------------------------------------- photo send */
  const onPick = async (event) => {
    const file = event.target.files && event.target.files[0];
    /* Let the same photo be chosen twice in a row. */
    if (event.target) event.target.value = '';
    if (!file || uploadingRef.current) return;

    setNote('');
    setPhotoNote('');

    if (!/^image\//i.test(file.type || '')) {
      setPhotoNote(MEDIA_NOT_IMAGE_MESSAGE);
      return;
    }
    if (file.size > MEDIA_MAX_ORIGINAL_BYTES) {
      setPhotoNote(MEDIA_TOO_BIG_MESSAGE);
      return;
    }

    uploadingRef.current = true;
    setUploading(true);

    /* Whatever is in the box becomes the caption, and the box empties — the
       same gesture as sending words. */
    const caption = draft.replace(/\r\n/g, '\n').trim().slice(0, MEDIA_CAPTION_MAX);
    setDraft('');

    const tempId = -Date.now();
    let previewUrl = '';

    try {
      const blob = await shrinkToJpeg(file);
      if (!blob) {
        setPhotoNote(MEDIA_BROKEN_MESSAGE);
        setDraft(caption);
        return;
      }

      previewUrl = URL.createObjectURL(blob);
      previewUrlsRef.current.push(previewUrl);

      /* Show it straight away, at the size it will actually be. */
      setMessages((current) => [
        ...current,
        {
          id: tempId,
          author: side,
          body: caption,
          created_at: new Date().toISOString(),
          media_path: 'pending',
          local_url: previewUrl,
          pending: true,
        },
      ]);

      const ticket = await withTimeout(getUploadUrl(), 12000, { ok: false, error: 'That upload timed out.' });
      if (ticket.signedOut) {
        router.push('/couple');
        return;
      }
      if (!ticket.ok) {
        setMessages((current) => current.filter((m) => m.id !== tempId));
        setPhotoNote(ticket.error || MEDIA_BROKEN_MESSAGE);
        setDraft(caption);
        return;
      }

      /* Straight at Storage: the bytes never touch our server. */
      const put = await fetch(ticket.signedUrl, {
        method: 'PUT',
        headers: { 'content-type': 'image/jpeg' },
        body: blob,
      });
      if (!put.ok) {
        setMessages((current) => current.filter((m) => m.id !== tempId));
        setPhotoNote('That photo did not finish uploading. Try again?');
        setDraft(caption);
        return;
      }

      const res = await withTimeout(sendMessage(caption, ticket.path), 12000, {
        ok: false,
        error: 'That did not go through. Check your connection and try again.',
      });
      if (res.signedOut) {
        router.push('/couple');
        return;
      }
      if (!res.ok) {
        setMessages((current) => current.filter((m) => m.id !== tempId));
        setPhotoNote(res.error || 'Could not send that photo.');
        setDraft(caption);
        return;
      }

      /* Carry the local preview onto the real row so the picture does not
         blink out and reload from a signed URL it already has on screen. */
      setMessages((current) =>
        merge(
          current.filter((m) => m.id !== tempId),
          [{ ...res.message, local_url: previewUrl }],
        ),
      );
      highestIdRef.current = Math.max(highestIdRef.current, res.message.id);
      burstFrom(pickBtnRef.current, 12);
      /* A photo added while the gallery is open should show up there too. */
      if (view === 'gallery') loadGallery();
    } catch {
      setMessages((current) => current.filter((m) => m.id !== tempId));
      setPhotoNote('Could not reach the server. Try again in a moment.');
      setDraft(caption);
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  };

  const toggleGallery = () => {
    if (view === 'gallery') {
      setView('chat');
      return;
    }
    setView('gallery');
    loadGallery();
  };

  /* --------------------------------------------------------- broken photos */
  /** A signed URL that has aged out: ask for one fresh one, once. */
  const resign = useCallback(async (id) => {
    if (!Number.isFinite(Number(id)) || Number(id) <= 0) return;
    if (resignedRef.current.has(id)) return;
    resignedRef.current.add(id);
    try {
      const res = await withTimeout(refreshMedia([id]), 10000, { ok: false, messages: [] });
      if (!res.ok || !res.messages || !res.messages.length) return;
      const fresh = res.messages[0];
      setMessages((current) =>
        current.map((m) => (m.id === fresh.id ? { ...m, media_url: fresh.media_url, local_url: null } : m)),
      );
      setGallery((g) => ({
        ...g,
        photos: g.photos.map((p) => (p.id === fresh.id ? { ...p, media_url: fresh.media_url } : p)),
      }));
    } catch {
      /* Leave the fallback tile in place. */
    }
  }, []);

  const openViewer = useCallback((src, caption) => {
    if (src) setViewer({ src, caption: caption || '' });
  }, []);

  const onSignOut = async () => {
    await leaveRoom();
    router.push('/couple');
  };

  const rows = useMemo(() => buildRows(messages), [messages]);

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
        <div className="corner__actions">
          <button
            type="button"
            className={`btn btn--ghost btn--sm corner__gallery-btn${view === 'gallery' ? ' is-on' : ''}`}
            onClick={toggleGallery}
            aria-pressed={view === 'gallery'}
          >
            {view === 'gallery' ? 'Back to chat' : 'Gallery 🖼'}
            <BetaChip tone="soft" className="corner__gallery-beta" />
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      {closing && (closing.theirs || closing.mine) ? (
        <button
          type="button"
          className={`corner__closing${closing.theirs ? ' is-theirs' : ''}`}
          onClick={() => setCloserOpen(true)}
        >
          {closing.theirs
            ? 'They have asked to close this corner — tap to read what that means'
            : 'You have asked to close this corner — tap to change your mind'}
        </button>
      ) : null}

      {view === 'gallery' ? (
        <Gallery gallery={gallery} onOpen={openViewer} onBroken={resign} />
      ) : (
        <div className="corner__list" ref={listRef} onScroll={onListScroll}>
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
                <Bubble
                  key={row.message.id}
                  message={row.message}
                  mine={row.message.author === side}
                  firstOfGroup={row.firstOfGroup}
                  lastOfGroup={row.lastOfGroup}
                  onOpen={openViewer}
                  onBroken={resign}
                  onShown={onPhotoShown}
                />
              ),
            )
          )}
        </div>
      )}

      {/* Order matters: the jump button lifts itself back over the LIST with a
          negative margin, so it has to sit directly after it. Put the install
          banner above and the button would float over the banner instead. */}
      {view === 'chat' && awayFromBottom ? (
        <button
          type="button"
          className={`corner__jump${unread ? ' has-unread' : ''}`}
          onClick={jumpToLatest}
          aria-label={unread ? `Jump to latest — ${unread} new` : 'Jump to latest'}
        >
          <span className="corner__jump-arrow" aria-hidden="true">
            ↓
          </span>
          {unread ? (
            <span className="corner__jump-count" aria-hidden="true">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      ) : null}

      {/* Renders nothing unless this browser can actually install, and nothing
          at all once Truce is running from the home screen. */}
      <InstallPrompt className="corner__install" tone="wide" label="Add Truce to your home screen" />

      <form className="corner__compose" onSubmit={submit}>
        <input
          ref={pickRef}
          type="file"
          accept={MEDIA_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={onPick}
        />
        <button
          ref={pickBtnRef}
          type="button"
          className="corner__pick"
          onClick={() => pickRef.current && pickRef.current.click()}
          disabled={uploading}
          aria-label="Send a photo (beta)"
          title="Send a photo"
        >
          {uploading ? <span className="spinner spinner--ink" aria-hidden="true" /> : '📷'}
          <span className="corner__pick-beta" aria-hidden="true">
            <BetaChip tone="soft" />
          </span>
        </button>
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

      {photoNote ? (
        <p className="corner__setup" role="status">
          {photoNote}
        </p>
      ) : null}

      <p className="corner__note" role="status">
        {note}
      </p>

      <p className="corner__foot">
        <Link href="/">Truce 🤍</Link> · signed in on this device for 30 days · not end-to-end
        encrypted ·{' '}
        <button type="button" className="corner__close-link" onClick={() => setCloserOpen(true)}>
          close this corner
        </button>
      </p>

      {viewer ? <Viewer src={viewer.src} caption={viewer.caption} onClose={() => setViewer(null)} /> : null}

      {closerOpen ? (
        <CloseCorner
          state={closing}
          onState={setClosing}
          onClosed={() => router.push('/couple?closed=1')}
          onDismiss={() => setCloserOpen(false)}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ bubbles */

function Bubble({ message, mine, firstOfGroup, lastOfGroup, onOpen, onBroken, onShown }) {
  const isPhoto = Boolean(message.media_path);
  const className = [
    'bubble',
    mine ? 'bubble--mine' : '',
    message.pending ? 'is-pending' : '',
    isPhoto ? 'bubble--photo' : '',
    firstOfGroup ? 'is-first' : '',
    lastOfGroup ? 'is-last' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      {isPhoto ? <Photo message={message} onOpen={onOpen} onBroken={onBroken} onShown={onShown} /> : null}
      {message.body ? <p className="bubble__body">{linkify(message.body)}</p> : null}
      <span className="bubble__meta">
        <span className="bubble__time">{clockTime(message.created_at)}</span>
        {mine ? <Tick pending={message.pending} /> : null}
      </span>
    </div>
  );
}

/**
 * The little status mark on your own messages.
 *
 * Deliberately two states, not three. A clock while it is in the air, one tick
 * once the server has it. There is no second tick, because nothing in the room
 * tracks whether the other person has actually read anything — inventing a
 * "seen" mark would be a lie told in a place where honesty is the whole point.
 */
function Tick({ pending }) {
  if (pending) {
    return (
      <svg className="tick tick--wait" viewBox="0 0 16 16" width="13" height="13" aria-label="Sending" role="img">
        <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.6V8l2.2 1.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className="tick" viewBox="0 0 16 16" width="13" height="13" aria-label="Sent" role="img">
      <path
        d="M2.6 8.6l3.2 3.2 7.6-7.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * One photo inside a bubble.
 *
 * Three states, all of them ordinary:
 *   loading — a shimmer the size of the eventual picture
 *   ready   — the picture, tappable
 *   broken  — a tile that says so, after one attempt at a fresh signed URL
 */
function Photo({ message, onOpen, onBroken, onShown }) {
  const src = message.local_url || message.media_url || null;
  const [status, setStatus] = useState(src ? 'loading' : 'broken');

  /* A re-signed URL arriving means "try again", not "stay broken". */
  useEffect(() => {
    setStatus(src ? 'loading' : 'broken');
  }, [src]);

  /* No URL at all means there is no <img> to fail, so nothing would ever ask
     for a fresh one. Ask here instead — once, guarded server-side by id. */
  useEffect(() => {
    if (!src && message.id > 0) onBroken(message.id);
  }, [src, message.id, onBroken]);

  if (status === 'broken') {
    return (
      <span className="photo photo--broken" role="img" aria-label="This photo could not be loaded">
        <span aria-hidden="true">🖼</span>
        <small>Photo unavailable</small>
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`photo${status === 'loading' ? ' is-loading' : ''}`}
      onClick={() => onOpen(src, message.body)}
      aria-label={message.body ? `Open photo: ${message.body}` : 'Open photo'}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived,
          off-origin URLs; the image optimizer cannot usefully cache these. */}
      <img
        className="photo__img"
        src={src}
        alt={message.body || 'A photo in your corner'}
        loading="lazy"
        decoding="async"
        onLoad={() => {
          setStatus('ready');
          if (onShown) onShown();
        }}
        onError={() => {
          setStatus('broken');
          if (!message.local_url) onBroken(message.id);
        }}
      />
      {status === 'loading' ? <span className="photo__shimmer" aria-hidden="true" /> : null}
    </button>
  );
}

/* ------------------------------------------------------------------ gallery */

function Gallery({ gallery, onOpen, onBroken }) {
  if (gallery.state !== 'ready') {
    return (
      <div className="corner__gallery">
        <p className="corner__loading">Gathering your photos…</p>
      </div>
    );
  }

  if (gallery.setup) {
    return (
      <div className="corner__gallery">
        <div className="corner__empty">
          <span aria-hidden="true">🖼</span>
          <h2>Almost ready</h2>
          <p>Photos need one quick setup step by the site owner 🤍</p>
        </div>
      </div>
    );
  }

  if (!gallery.photos.length) {
    return (
      <div className="corner__gallery">
        <div className="corner__empty">
          <span aria-hidden="true">🖼</span>
          <h2>No photos yet</h2>
          <p>
            Tap the 📷 down there and start the pile. Blurry ones count — arguably they count
            double.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="corner__gallery">
      <div className="gallery-grid">
        {gallery.photos.map((photo) => (
          <GalleryTile key={photo.id} photo={photo} onOpen={onOpen} onBroken={onBroken} />
        ))}
      </div>
    </div>
  );
}

function GalleryTile({ photo, onOpen, onBroken }) {
  const src = photo.media_url || null;
  const [status, setStatus] = useState(src ? 'loading' : 'broken');

  useEffect(() => {
    setStatus(src ? 'loading' : 'broken');
  }, [src]);

  useEffect(() => {
    if (!src && photo.id > 0) onBroken(photo.id);
  }, [src, photo.id, onBroken]);

  if (status === 'broken') {
    return (
      <span className="gallery-tile gallery-tile--broken" role="img" aria-label="This photo could not be loaded">
        🖼
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`gallery-tile${status === 'loading' ? ' is-loading' : ''}`}
      onClick={() => onOpen(src, photo.body)}
      aria-label={photo.body ? `Open photo: ${photo.body}` : 'Open photo'}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- see Photo above. */}
      <img
        src={src}
        alt={photo.body || 'A photo in your corner'}
        loading="lazy"
        decoding="async"
        onLoad={() => setStatus('ready')}
        onError={() => {
          setStatus('broken');
          onBroken(photo.id);
        }}
      />
    </button>
  );
}

/* ------------------------------------------------------------------- viewer */

/** Fit-to-screen, dark, and closed by absolutely everything. */
function Viewer({ src, caption, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Photo">
      <button type="button" className="viewer__backdrop" onClick={onClose} aria-label="Close photo" />
      <button type="button" className="viewer__close" onClick={onClose} aria-label="Close photo">
        ✕
      </button>
      <figure className="viewer__figure">
        {/* eslint-disable-next-line @next/next/no-img-element -- see Photo above. */}
        <img className="viewer__img" src={src} alt={caption || 'A photo in your corner'} />
        {caption ? <figcaption className="viewer__caption">{caption}</figcaption> : null}
      </figure>
    </div>
  );
}

/* -------------------------------------------------------------- compression */

/**
 * Shrink whatever came out of the picker into a modest JPEG.
 *
 * Longest edge to MEDIA_MAX_EDGE, then quality down in steps until it fits
 * MEDIA_TARGET_BYTES, then one last halving of the dimensions if a very noisy
 * photo is still enormous. Everything happens in the browser: a 6MB holiday
 * photo becomes a few hundred KB before a single byte leaves the phone, which
 * is the difference between a free Supabase bucket lasting months and lasting
 * a weekend.
 *
 * Returns null if the file could not be decoded at all (a HEIC on a browser
 * that cannot read one, a .jpg that is really a text file).
 */
async function shrinkToJpeg(file) {
  const source = await loadImage(file);
  if (!source) return null;

  const draw = async (maxEdge) => {
    const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    /* A white floor, so a transparent PNG does not become a black square. */
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);

    let quality = 0.82;
    let blob = await canvasToBlob(canvas, quality);
    while (blob && blob.size > MEDIA_TARGET_BYTES && quality > 0.42) {
      quality -= 0.12;
      blob = await canvasToBlob(canvas, quality);
    }
    return blob;
  };

  let blob = await draw(MEDIA_MAX_EDGE);
  if (blob && blob.size > MEDIA_MAX_UPLOAD_BYTES) blob = await draw(Math.round(MEDIA_MAX_EDGE / 2));
  if (source.close) source.close();

  if (!blob || blob.size > MEDIA_MAX_UPLOAD_BYTES) return null;
  return blob;
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
    } catch {
      resolve(null);
    }
  });
}

/** createImageBitmap where it exists, an <img> everywhere else. */
async function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* Fall through — Safari has historically been fussy here. */
    }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/* -------------------------------------------------------------- little bits */

/**
 * Merge new messages in, keeping ids unique and the order stable.
 *
 * Two things to get right:
 *
 *  1. Ids are unique. A poll and a send can deliver the same row, and the same
 *     poll can overlap the next one.
 *  2. The optimistic copy has to go. A message is shown immediately with a
 *     temporary negative id, then replaced when the server answers. If a poll
 *     lands in between it brings the REAL row back — different id, same words —
 *     and the sender briefly sees their message twice. Matching a pending row
 *     against an arriving one by author+body drops the placeholder instead.
 *
 * A photo without a caption has an empty body, so a pending row is only ever
 * matched against an arriving row of the same kind.
 */
function merge(current, incoming) {
  if (!incoming || !incoming.length) return current;

  const seen = new Set(current.map((m) => m.id));
  const added = [];
  for (const message of incoming) {
    if (!message || seen.has(message.id)) continue;
    seen.add(message.id);
    added.push(message);
  }
  if (!added.length) return current;

  /* Each arriving row can retire at most one placeholder, so sending the same
     words twice on purpose still shows two bubbles. */
  const claimed = new Set();
  const kept = current.filter((m) => {
    if (!m.pending) return true;
    const match = added.find(
      (x) =>
        !claimed.has(x.id) &&
        x.author === m.author &&
        x.body === m.body &&
        Boolean(x.media_path) === Boolean(m.media_path),
    );
    if (!match) return true;
    claimed.add(match.id);
    /* Hand the local preview to the real row so the picture never blinks. */
    if (m.local_url && !match.local_url) match.local_url = m.local_url;
    return false;
  });

  return [...kept, ...added].sort(sortByTime);
}

function sortByTime(a, b) {
  /* Optimistic ids are negative, so fall back to the timestamp for those. */
  if (a.id > 0 && b.id > 0) return a.id - b.id;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

/**
 * Turn URLs inside a message into real links.
 *
 * splitLinks does the finding (and is tested); this only decides what the
 * pieces look like. They become React children, never HTML, so a message that
 * happens to contain markup is still just text — the same guarantee the plain
 * bubble always had.
 */
function linkify(text) {
  const parts = splitLinks(text);
  if (parts.length === 1 && parts[0].type === 'text') return parts[0].value;

  return parts.map((part, i) =>
    part.type === 'link' ? (
      <a
        key={`l${i}`}
        className="bubble__link"
        href={part.value}
        target="_blank"
        rel="noopener noreferrer nofollow"
      >
        {part.value}
      </a>
    ) : (
      part.value
    ),
  );
}

/** True when a message is nothing but emoji — worth a little heart burst. */
function isOnlyEmoji(text) {
  const stripped = String(text).replace(/\s/g, '');
  if (!stripped) return false;
  return !/[^\p{Extended_Pictographic}\p{Emoji_Component}]/u.test(stripped);
}
