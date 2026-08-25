'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getClosingState,
  getGallery,
  getMessages,
  editText,
  getUploadUrl,
  leaveRoom,
  refreshMedia,
  sendMessage,
  react as sendReaction,
  unsend,
} from '../actions';
import CloseCorner from './CloseCorner';
import { daysBetween } from '@/lib/format';
import {
  REACTIONS,
  buildRows,
  firstUnreadId,
  clockTime,
  highlight,
  normaliseReactions,
  searchMessages,
  splitLinks,
  toggleReactionSet,
} from '@/lib/chat';
import { COUPLE_MESSAGE_MAX as MAX_MESSAGE_LENGTH } from '@/lib/constants';
import {
  MEDIA_ACCEPT,
  MEDIA_AUDIO_BITS_PER_SECOND,
  MEDIA_AUDIO_BROKEN_MESSAGE,
  MEDIA_AUDIO_DENIED_MESSAGE,
  MEDIA_AUDIO_MAX_BYTES,
  MEDIA_AUDIO_MAX_MS,
  MEDIA_AUDIO_MIN_MS,
  MEDIA_AUDIO_TOO_SHORT_MESSAGE,
  MEDIA_AUDIO_UNSUPPORTED_MESSAGE,
  MEDIA_BROKEN_MESSAGE,
  MEDIA_CAPTION_MAX,
  MEDIA_MAX_EDGE,
  clockDuration,
  mediaKind,
  pickAudioFormat,
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

  /* Reacting has to feel instant — it is a tap, not a send — so the emoji lands
     locally first and the server confirms after. The same toggle that applied
     it is what puts it back if the write fails, which works precisely because
     the operation is its own inverse. */
  const onReact = useCallback(
    async (id, emoji) => {
      const flip = (current) =>
        current.map((m) => (m.id === id ? { ...m, reactions: toggleReactionSet(m.reactions, emoji, side) } : m));

      setMessages(flip);

      const res = await sendReaction(id, emoji).catch(() => null);
      if (res && res.ok) {
        setMessages((current) => current.map((m) => (m.id === id ? { ...m, reactions: res.reactions } : m)));
        return;
      }

      setMessages(flip);
      if (res && res.error) setNote(res.error);
    },
    [side],
  );

  /* Unsend cannot be undone, so it asks first. The row stays in the list as a
     tombstone rather than vanishing: the poll tracks the highest id it has
     seen, and a hole in that sequence is how a room starts waiting for a
     message that is never coming. */
  const onUnsend = useCallback(async (id) => {
    if (typeof window !== 'undefined' && !window.confirm('Unsend this message? It goes for both of you.')) return;

    const res = await unsend(id).catch(() => null);
    if (res && res.ok) {
      setMessages((current) =>
        current.map((m) =>
          m.id === id
            ? { ...m, body: '', media_path: null, media_url: null, deleted_at: new Date().toISOString() }
            : m,
        ),
      );
      return;
    }
    setNote((res && res.error) || 'Could not unsend that just now.');
  }, []);

  /* ------------------------------------------------------------------ reply */

  /* The message being answered, held whole rather than as an id: the composer
     shows a line of it, and looking that up again on every keystroke would be
     work for nothing. */
  const [replyingTo, setReplyingTo] = useState(null);

  const onReply = useCallback((message) => {
    setReplyingTo(message);
    if (inputRef.current) inputRef.current.focus();
  }, []);

  /* ------------------------------------------------------------------- edit */

  /* The message being rewritten. The composer doubles as the editor rather
     than growing a second box inside the bubble: one place words are typed,
     one keyboard on a phone, one Enter key that means the same thing. */
  const [editing, setEditing] = useState(null);

  const onEdit = useCallback((message) => {
    setEditing(message);
    setReplyingTo(null);
    setDraft(String(message.body || ''));
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const cancelEdit = useCallback(() => {
    setEditing(null);
    setDraft('');
  }, []);

  const onCopy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      setNote('Copied 🤍');
    } catch {
      /* Denied, or an insecure page — the clipboard API is HTTPS-only. Saying
         nothing would look like the button did nothing. */
      setNote('This browser would not let us copy that.');
    }
  }, []);

  /* ------------------------------------------------------------- the draft */

  /* Kept per room, the way every chat app keeps one: a half-written message is
     often the hardest one to write, and losing it to a locked screen is worse
     than losing a sent one. Not persisted while editing — that text belongs to
     a message that already exists, and restoring it into an empty composer
     later would look like a draft they never wrote. */
  const draftKeyRef = useRef(`truce.corner.draft.${room.id}`);
  const draftLoaded = useRef(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKeyRef.current);
      if (saved) setDraft(saved);
    } catch {
      /* Storage blocked. The composer simply starts empty. */
    }
    draftLoaded.current = true;
  }, []);

  useEffect(() => {
    if (!draftLoaded.current || editing) return;
    try {
      if (draft) window.localStorage.setItem(draftKeyRef.current, draft);
      else window.localStorage.removeItem(draftKeyRef.current);
    } catch {
      /* As above. */
    }
  }, [draft, editing]);

  /* Quotes are resolved from what this browser already holds rather than
     fetched: the reply and the message it answers are almost always both on
     screen, and the poll only ever carries the recent window anyway. Anything
     older than that renders as "message unavailable", which is honest. */
  const byId = useMemo(() => {
    const map = new Map();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  /* ------------------------------------------------------------ voice notes */

  const [recording, setRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef(null);
  const discardRef = useRef(false);

  /* Letting go of the microphone matters more than most cleanup: a live track
     keeps the browser's recording indicator lit, which on a phone looks exactly
     like being listened to. */
  const releaseMic = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  /* Alive only while mounted. onstop fires asynchronously and there is no way
     to un-fire it, so the handler has to be able to ask. */
  const micAliveRef = useRef(true);

  useEffect(() => {
    micAliveRef.current = true;
    return () => {
      micAliveRef.current = false;

      /*
       * Leaving the room mid-recording must not send the recording.
       *
       * Releasing the microphone stops the tracks, which ends the recorder,
       * which fires onstop — and that handler used to carry straight on and
       * upload. Closing the room while holding a voice note therefore posted
       * it into a room the person had already left, setting state on a
       * component that no longer existed on the way past. Mark it discarded
       * and stop the recorder deliberately, rather than letting it be stopped
       * as a side effect of the microphone going away.
       */
      discardRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          /* Already gone. The tracks below are what actually matter. */
        }
      }

      releaseMic();
    };
  }, [releaseMic]);

  const uploadVoice = useCallback(
    async (blob, heldMs, ext) => {
      const tempId = -Date.now();
      const previewUrl = URL.createObjectURL(blob);
      previewUrlsRef.current.push(previewUrl);
      const answering = replyingTo ? replyingTo.id : null;
      setReplyingTo(null);

      setMessages((current) => [
        ...current,
        {
          id: tempId,
          author: side,
          body: '',
          created_at: new Date().toISOString(),
          media_path: 'pending',
          media_kind: 'voice',
          media_ms: heldMs,
          local_url: previewUrl,
          reply_to: answering,
          pending: true,
        },
      ]);

      const fail = (message) => {
        setMessages((current) => current.filter((m) => m.id !== tempId));
        setPhotoNote(message);
      };

      try {
        const ticket = await withTimeout(getUploadUrl('voice', ext), 12000, {
          ok: false,
          error: 'That upload timed out.',
        });
        if (ticket.signedOut) {
          router.push('/couple');
          return;
        }
        if (!ticket.ok) return fail(ticket.error || MEDIA_AUDIO_BROKEN_MESSAGE);

        const put = await fetch(ticket.signedUrl, {
          method: 'PUT',
          headers: { 'content-type': ext === 'm4a' ? 'audio/mp4' : 'audio/webm' },
          body: blob,
        });
        if (!put.ok) return fail('That recording did not finish uploading. Try again?');

        const res = await withTimeout(sendMessage('', ticket.path, answering, heldMs), 12000, {
          ok: false,
          error: 'That did not go through. Check your connection and try again.',
        });
        if (res.signedOut) {
          router.push('/couple');
          return;
        }
        if (!res.ok) return fail(res.error || MEDIA_AUDIO_BROKEN_MESSAGE);

        setMessages((current) =>
          merge(
            current.filter((m) => m.id !== tempId),
            [{ ...res.message, local_url: previewUrl }],
          ),
        );
        highestIdRef.current = Math.max(highestIdRef.current, res.message.id);
      } catch {
        fail('Could not reach the server. Try again in a moment.');
      }
    },
    [replyingTo, router, side],
  );

  const startRecording = useCallback(async () => {
    setPhotoNote('');

    const format = pickAudioFormat();
    /* No MediaRecorder also means an insecure page — getUserMedia is HTTPS
       only — so this covers "it silently does nothing on http" too. */
    if (!format || typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setPhotoNote(MEDIA_AUDIO_UNSUPPORTED_MESSAGE);
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      /* Denied, dismissed, or no microphone at all. The browser does not tell
         them apart reliably, and the fix is the same sentence either way. */
      setPhotoNote(MEDIA_AUDIO_DENIED_MESSAGE);
      return;
    }

    let recorder;
    try {
      recorder = new window.MediaRecorder(stream, {
        mimeType: format.mimeType,
        audioBitsPerSecond: MEDIA_AUDIO_BITS_PER_SECOND,
      });
    } catch {
      for (const track of stream.getTracks()) track.stop();
      setPhotoNote(MEDIA_AUDIO_UNSUPPORTED_MESSAGE);
      return;
    }

    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];
    discardRef.current = false;
    startedAtRef.current = Date.now();

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const heldMs = Date.now() - startedAtRef.current;
      const chunks = chunksRef.current;
      chunksRef.current = [];
      releaseMic();

      /* The room has gone. Nothing below is safe, and the recording is not
         wanted — see the unmount cleanup for why this fires at all. */
      if (!micAliveRef.current) return;

      setRecording(false);
      setRecordMs(0);

      if (discardRef.current) return;

      /* A tap that never became a recording is a mis-tap, not a message. */
      if (heldMs < MEDIA_AUDIO_MIN_MS) {
        setPhotoNote(MEDIA_AUDIO_TOO_SHORT_MESSAGE);
        return;
      }

      const blob = new Blob(chunks, { type: format.mimeType });
      if (!blob.size) {
        setPhotoNote(MEDIA_AUDIO_BROKEN_MESSAGE);
        return;
      }
      if (blob.size > MEDIA_AUDIO_MAX_BYTES) {
        setPhotoNote('That recording is too long to send 🤍');
        return;
      }

      uploadVoice(blob, Math.min(heldMs, MEDIA_AUDIO_MAX_MS), format.ext);
    };

    recorder.start();
    setRecording(true);
    setRecordMs(0);

    tickRef.current = window.setInterval(() => {
      const held = Date.now() - startedAtRef.current;
      setRecordMs(held);
      /* Stops itself rather than letting somebody leave it running in a
         pocket and then trying to upload twenty minutes of it. */
      if (held >= MEDIA_AUDIO_MAX_MS && recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop();
      }
    }, 200);
  }, [releaseMic, uploadVoice]);

  const finishRecording = useCallback((discard) => {
    discardRef.current = Boolean(discard);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      return;
    }
    /* Nothing was running — make sure the UI does not stay stuck in a state
       the recorder has already left. */
    releaseMic();
    setRecording(false);
    setRecordMs(0);
  }, [releaseMic]);
  /* Timestamps and "Today" separators are formatted in the reader's own
     timezone, which the server cannot know — so the list is rendered after
     mount. The messages themselves already arrived with the first response,
     so there is no extra round-trip, just one frame of "opening…". */
  const [mounted, setMounted] = useState(false);

  /* Photos */
  const [uploading, setUploading] = useState(false);
  const [photoNote, setPhotoNote] = useState('');
  /* ----------------------------------------------------------------- search */

  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);

  const hits = useMemo(() => (searching ? searchMessages(messages, query) : []), [searching, query, messages]);

  const toggleSearch = useCallback(() => {
    setSearching((on) => {
      if (on) setQuery('');
      return !on;
    });
  }, []);

  /* Which message is briefly lit after being jumped to. A result opened out of
     the conversation around it is half an answer, so search closes and the
     room scrolls to it instead of showing it in a list of its own. */
  const [flash, setFlash] = useState(null);

  const jumpTo = useCallback((id) => {
    setFlash(id);
    /* The list is still showing the search panel this tick; wait for the room
       to be back on screen before looking for a row inside it. */
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const list = listRef.current;
        const el = list && list.querySelector(`[data-mid="${id}"]`);
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    });
    window.setTimeout(() => setFlash((current) => (current === id ? null : current)), 1800);
  }, []);

  useEffect(() => {
    if (searching && searchRef.current) searchRef.current.focus();
  }, [searching]);

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
          setMessages((current) => applyStates(merge(current, res.messages), res.states));
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
      /* Arriving while already at the bottom counts as read too; the scroll
         handler never fires for a message that did not move the view. */
      markRead(highestIdRef.current);
    } else {
      setUnread((n) => n + 1);
    }
  }, [messages, view, side, stickToBottom, markRead]);

  /* One cheap read per scroll frame: are we at the bottom or not? */
  const onListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const bottom = distance < 90;
    atBottomRef.current = bottom;
    setAwayFromBottom(!bottom);
    if (bottom) {
      setUnread(0);
      /* Reaching the bottom is what “I have read this” means in a room this
         small — there is no other place the newest message could be. */
      markRead(highestIdRef.current);
    }
  }, [markRead]);

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
  /**
   * Save a rewrite.
   *
   * Optimistic like a send is, and for the same reason — but it restores the
   * ORIGINAL words if the server refuses, not the ones they typed. A failed
   * edit that leaves the new text sitting in the bubble is a message that says
   * something its author never sent.
   */
  const saveEdit = async (text) => {
    const target = editing;
    if (!target || sendingRef.current) return;

    sendingRef.current = true;
    setSending(true);
    setNote('');

    const original = target.body;
    setEditing(null);
    setDraft('');

    setMessages((current) =>
      current.map((m) =>
        m.id === target.id ? { ...m, body: text, edited_at: new Date().toISOString(), pending: true } : m,
      ),
    );

    const putBack = (message) => {
      setMessages((current) =>
        current.map((m) =>
          m.id === target.id ? { ...m, body: original, edited_at: target.edited_at || null, pending: false } : m,
        ),
      );
      setNote(message);
    };

    try {
      const res = await withTimeout(editText(target.id, text), 10000, {
        ok: false,
        error: 'That change did not go through. Check your connection and try again.',
      });
      if (res.signedOut) {
        router.push('/couple');
        return;
      }
      if (!res.ok) {
        putBack(res.error || 'Could not change that.');
        return;
      }

      setMessages((current) =>
        current.map((m) => (m.id === target.id ? { ...m, ...(res.message || {}), pending: false } : m)),
      );
    } catch {
      putBack('Could not reach the server. Try again in a moment.');
    } finally {
      sendingRef.current = false;
      setSending(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const submit = async (e) => {
    if (e) e.preventDefault();
    const text = draft.replace(/\r\n/g, '\n').trim();
    if (!text || sendingRef.current) return;

    /* Same box, same Enter key, different verb. */
    if (editing) return saveEdit(text);

    sendingRef.current = true;
    setSending(true);
    setNote('');

    /* Taken now, not when the request lands: they may start typing the next
       message — and clear the chip — while this one is still in the air. */
    const answering = replyingTo ? replyingTo.id : null;
    setReplyingTo(null);

    /* Optimistic: it appears immediately, greyed until the server confirms. */
    const tempId = -Date.now();
    setMessages((current) => [
      ...current,
      {
        id: tempId,
        author: side,
        body: text.slice(0, MAX_MESSAGE_LENGTH),
        created_at: new Date().toISOString(),
        reply_to: answering,
        pending: true,
      },
    ]);
    setDraft('');

    if (isOnlyEmoji(text)) burstFrom(sendBtnRef.current, 14);

    try {
      const res = await withTimeout(sendMessage(text, null, answering), 10000, {
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
          media_kind: 'photo',
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

  /* ----------------------------------------------------------- unread line */

  /* Frozen at mount and left alone. If it followed the last-read marker it
     would vanish the instant the room scrolled to the bottom — which is the
     first thing the room does — so the line would never survive long enough to
     be read. It stays until the corner is opened again. */
  const [unreadFrom, setUnreadFrom] = useState(null);
  const readKeyRef = useRef(`truce.corner.read.${room.id}`);

  /* Layout effect, not an effect: scrolling the list to the bottom on mount
     dispatches a scroll event, and that handler calls markRead — which would
     overwrite the very marker this is trying to read. Running before paint puts
     the read first by construction rather than by luck of ordering. */
  useLayoutEffect(() => {
    let stored = null;
    try {
      stored = window.localStorage.getItem(readKeyRef.current);
    } catch {
      /* Storage blocked — no line, which is the quiet failure, not the loud one. */
    }
    setUnreadFrom(firstUnreadId(messages, stored, side));
    /* Mount only: this is a snapshot of where they left off, not a live view. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Marking read is cheap and idempotent, so it rides the same moments the room
     already knows about rather than earning its own listener. */
  const markRead = useCallback((id) => {
    if (typeof id !== 'number' || id <= 0) return;
    try {
      const seen = Number(window.localStorage.getItem(readKeyRef.current)) || 0;
      if (id > seen) window.localStorage.setItem(readKeyRef.current, String(id));
    } catch {
      /* As above. A corner that cannot remember is still a working corner. */
    }
  }, []);

  const rows = useMemo(() => buildRows(messages, new Date(), { unreadFrom }), [messages, unreadFrom]);

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
            className={`btn btn--ghost btn--sm${searching ? ' is-on' : ''}`}
            onClick={toggleSearch}
            aria-pressed={searching}
            aria-label={searching ? 'Close search' : 'Search this corner'}
          >
            {searching ? 'Close' : '🔍'}
          </button>
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

      {searching ? (
        <div className="search">
          <input
            ref={searchRef}
            type="search"
            className="search__input"
            placeholder="Search what you have said…"
            value={query}
            aria-label="Search this corner"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') toggleSearch();
            }}
          />

          <p className="search__count" role="status">
            {!query.trim()
              ? 'Type to search.'
              : hits.length === 0
                ? 'Nothing matches.'
                : `${hits.length} ${hits.length === 1 ? 'message' : 'messages'}`}
          </p>

          <div className="search__results">
            {hits.map((m) => (
              <button
                key={m.id}
                type="button"
                className={m.author === side ? 'search__hit search__hit--mine' : 'search__hit'}
                onClick={() => {
                  /* Close search and land on the message in its own context —
                     a result out of the conversation around it is half an
                     answer. */
                  toggleSearch();
                  jumpTo(m.id);
                }}
              >
                <span className="search__hit-who">{m.author === side ? 'You' : room.name}</span>
                <span className="search__hit-body">
                  {highlight(m.body, query).map((part, i) =>
                    part.hit ? (
                      <mark key={i} className="search__mark">
                        {part.text}
                      </mark>
                    ) : (
                      <span key={i}>{part.text}</span>
                    ),
                  )}
                </span>
                <span className="search__hit-when">{clockTime(m.created_at)}</span>
              </button>
            ))}
          </div>

          {/* Said plainly rather than implied: the room holds a recent window,
              so "nothing matches" is not the same claim as "it was never said". */}
          <p className="search__scope">Searches the messages this device has loaded.</p>
        </div>
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
              ) : row.kind === 'unread' ? (
                <p className="corner__unread" key={row.key}>
                  <span>Unread messages</span>
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
                  onReact={onReact}
                  onUnsend={onUnsend}
                  onReply={onReply}
                  onEdit={onEdit}
                  onCopy={onCopy}
                  onJump={jumpTo}
                  flash={flash === row.message.id}
                  parent={row.message.reply_to ? byId.get(row.message.reply_to) : null}
                  side={side}
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

      {editing ? (
        <div className="corner__replying corner__replying--edit">
          <span className="corner__replying-bar" aria-hidden="true" />
          <span className="corner__replying-text">
            <span className="corner__replying-who">Editing your message</span>
            <span className="corner__replying-body">{quotedText(editing)}</span>
          </span>
          <button
            type="button"
            className="corner__replying-x"
            onClick={cancelEdit}
            aria-label="Stop editing and leave the message as it was"
          >
            ×
          </button>
        </div>
      ) : null}

      {replyingTo && !editing ? (
        <div className="corner__replying">
          <span className="corner__replying-bar" aria-hidden="true" />
          <span className="corner__replying-text">
            <span className="corner__replying-who">
              {replyingTo.author === side ? 'Replying to yourself' : 'Replying'}
            </span>
            <span className="corner__replying-body">{quotedText(replyingTo)}</span>
          </span>
          <button
            type="button"
            className="corner__replying-x"
            onClick={() => setReplyingTo(null)}
            aria-label="Stop replying"
          >
            ×
          </button>
        </div>
      ) : null}

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
        {recording ? (
          <div className="corner__recording" role="status" aria-live="polite">
            <span className="corner__recording-dot" aria-hidden="true" />
            <span className="corner__recording-time">{clockDuration(recordMs)}</span>
            <span className="corner__recording-hint">Recording…</span>
            <button
              type="button"
              className="corner__recording-cancel"
              onClick={() => finishRecording(true)}
              aria-label="Discard this recording"
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary corner__recording-send"
              onClick={() => finishRecording(false)}
              aria-label="Send this recording"
            >
              ↑
            </button>
          </div>
        ) : null}

        {/* The microphone stands where the words go, so it is never the thing
            you hit while reaching for send. */}
        {!recording ? (
          <button
            type="button"
            className="corner__mic"
            onClick={startRecording}
            disabled={uploading || sending}
            aria-label="Record a voice note"
            title="Record a voice note"
          >
            🎙️
          </button>
        ) : null}

        <textarea
          ref={inputRef}
          className={recording ? 'corner__input is-hidden' : 'corner__input'}
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Say it here…"
          value={draft}
          aria-label="Your message"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            /* Enter sends, Shift+Enter makes a new line — phone keyboards send
               a plain Enter, which is what people expect here. */
            if (e.key === 'Escape' && editing) {
              e.preventDefault();
              cancelEdit();
              return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          ref={sendBtnRef}
          type="submit"
          className={recording ? 'btn btn--primary corner__send is-hidden' : 'btn btn--primary corner__send'}
          disabled={sending || !draft.trim() || recording}
          aria-label="Send"
        >
          {sending ? <span className="spinner" aria-hidden="true" /> : editing ? '✓' : '↑'}
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

/**
 * One line of a message, for a quote.
 *
 * A quote has to say something even when the message had no words at all — a
 * photo, a voice note, or something that was unsent since. Falling through to
 * an empty string would render a quote box with nothing in it, which reads as
 * broken rather than as brief.
 */
function quotedText(message) {
  if (!message) return 'Message unavailable';
  if (message.deleted_at) return 'Unsent';

  const kind = message.media_kind || mediaKind(message.media_path);
  const body = String(message.body || '').replace(/\s+/g, ' ').trim();

  if (kind === 'voice') return body || `Voice note · ${clockDuration(message.media_ms)}`;
  if (message.media_path) return body || 'Photo';

  if (!body) return 'Message';
  return body.length > 90 ? `${body.slice(0, 89)}…` : body;
}

/* --------------------------------------------------------------- voice note */

/**
 * A voice note: one button, one line, one length.
 *
 * Deliberately not a native <audio controls>. Chrome, Safari and Firefox each
 * draw a different widget with a different height, and all three look like a
 * browser part dropped into a conversation.
 *
 * The duration comes from media_ms — measured while recording — rather than
 * from the file, because streaming WebM carries no duration in its header and
 * answers Infinity until it has played through once. Where media_ms is missing
 * (a note recorded before the column existed) the element's own metadata is
 * used, and clockDuration turns whatever nonsense that is into 0:00.
 */
function VoiceNote({ message, mine }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [atMs, setAtMs] = useState(0);
  const [fallbackMs, setFallbackMs] = useState(0);

  const src = message.local_url || message.media_url || '';
  const totalMs = Number(message.media_ms) > 0 ? Number(message.media_ms) : fallbackMs;
  const progress = totalMs > 0 ? Math.min(100, (atMs / totalMs) * 100) : 0;

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => setPlaying(false));
    } else {
      el.pause();
    }
  };

  /*
   * A voice note whose signed URL did not come back.
   *
   * attachMediaUrls returns media_url: null when Storage refuses to sign, and
   * the honest thing to do with that is say so. Falling through rendered an
   * <audio src="">, which gives a play button that does nothing at all when
   * pressed — the worst of the three options, because it looks like the
   * recording is fine and the person is doing it wrong. The Photo beside it has
   * always said "broken"; this now matches.
   */
  if (!src && !message.pending) {
    return (
      <span className="voice voice--waiting">
        <span className="voice__time">Could not load that recording</span>
      </span>
    );
  }

  if (message.pending && !src) {
    return (
      <span className="voice voice--waiting">
        <span className="spinner spinner--ink" aria-hidden="true" />
        <span className="voice__time">Sending…</span>
      </span>
    );
  }

  return (
    <span className={mine ? 'voice voice--mine' : 'voice'}>
      <button
        type="button"
        className="voice__play"
        onClick={toggle}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
      >
        <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
      </button>

      <span className="voice__track" aria-hidden="true">
        <span className="voice__fill" style={{ width: `${progress}%` }} />
      </span>

      <span className="voice__time">{clockDuration(playing || atMs ? totalMs - atMs : totalMs)}</span>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setAtMs(e.currentTarget.currentTime * 1000)}
        onLoadedMetadata={(e) => {
          const seconds = e.currentTarget.duration;
          if (Number.isFinite(seconds) && seconds > 0) setFallbackMs(seconds * 1000);
        }}
        onEnded={() => {
          setPlaying(false);
          setAtMs(0);
        }}
      />
    </span>
  );
}

/* ------------------------------------------------------------------ bubbles */

function Bubble({
  message,
  mine,
  firstOfGroup,
  lastOfGroup,
  onOpen,
  onBroken,
  onShown,
  onReact,
  onUnsend,
  onReply,
  onEdit,
  onCopy,
  onJump,
  flash,
  parent,
  side,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const gone = Boolean(message.deleted_at);
  /* An optimistic row knows its own kind; a real one is read off the path,
     because the extension is the only thing that says which it is. */
  const kind = gone ? null : message.media_kind || mediaKind(message.media_path);
  const isVoice = kind === 'voice';
  const isPhoto = !gone && !isVoice && Boolean(message.media_path);
  const reactionList = Object.entries(normaliseReactions(message.reactions));
  /* A message still in the air has no id the server would recognise, so there
     is nothing yet to react to or unsend. */
  const actionable = !gone && !message.pending && typeof message.id === 'number';
  /* Swipe-to-reply, the gesture this whole interaction is named after
     everywhere else. Horizontal intent only: the list scrolls vertically, so a
     drag that is mostly up or down must be left alone or the room becomes
     impossible to scroll with a thumb. */
  const dragRef = useRef(null);
  const [dragX, setDragX] = useState(0);

  const SWIPE_ARM = 12;   // px before we decide the gesture is horizontal
  const SWIPE_FIRE = 56;  // px before letting go counts as a reply

  const onTouchStart = (e) => {
    if (!actionable || !onReply) return;
    const t = e.touches[0];
    dragRef.current = { x: t.clientX, y: t.clientY, armed: false };
  };

  const onTouchMove = (e) => {
    const start = dragRef.current;
    if (!start) return;

    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (!start.armed) {
      if (Math.abs(dy) > Math.abs(dx)) {
        /* They are scrolling. Give up on this gesture entirely rather than
           fighting the list for it. */
        dragRef.current = null;
        return;
      }
      if (Math.abs(dx) < SWIPE_ARM) return;
      start.armed = true;
    }

    /* Rightwards only, and with a ceiling — this is a nudge, not a drawer. */
    const travel = Math.max(0, Math.min(dx, SWIPE_FIRE + 12));
    /* Recorded on the gesture itself as well as in state. touchend reads it to
       decide whether the swipe counted, and reading it from state means
       trusting that the last setDragX of the drag has been rendered before the
       finger left the glass — which is a race nobody should be relying on to
       decide whether a reply happens. */
    start.travel = travel;
    setDragX(travel);
  };

  const onTouchEnd = () => {
    const start = dragRef.current;
    dragRef.current = null;
    const travelled = start ? start.travel || 0 : 0;
    setDragX(0);
    if (start && start.armed && travelled >= SWIPE_FIRE && onReply) onReply(message);
  };

  const className = [
    'bubble',
    mine ? 'bubble--mine' : '',
    message.pending ? 'is-pending' : '',
    isPhoto ? 'bubble--photo' : '',
    gone ? 'bubble--gone' : '',
    firstOfGroup ? 'is-first' : '',
    lastOfGroup ? 'is-last' : '',
    flash ? 'is-flash' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      data-mid={message.id}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      style={dragX ? { transform: `translateX(${dragX}px)` } : undefined}
    >
      {dragX > 0 ? (
        <span className="bubble__swipe" aria-hidden="true" style={{ opacity: Math.min(1, dragX / 56) }}>
          ↩
        </span>
      ) : null}
      {message.reply_to && !gone ? (
        parent && onJump ? (
          /* Tapping a quote goes to what it answers — the thing every chat app
             has trained a thumb to expect. Only when there is something to go
             to: a quote for a message we no longer hold is not a button. */
          <button
            type="button"
            className="quote quote--go"
            onClick={() => onJump(parent.id)}
            aria-label="Go to the message this replies to"
          >
            <span className="quote__bar" aria-hidden="true" />
            <span className="quote__text">{quotedText(parent)}</span>
          </button>
        ) : (
          <span className="quote">
            <span className="quote__bar" aria-hidden="true" />
            <span className="quote__text">
              {/* Either it scrolled out of the window we hold, or it was
                  unsent. Saying so beats an empty box. */}
              <em className="quote__missing">Message unavailable</em>
            </span>
          </span>
        )
      ) : null}

      {isVoice ? <VoiceNote message={message} mine={mine} /> : null}
      {isPhoto ? <Photo message={message} onOpen={onOpen} onBroken={onBroken} onShown={onShown} /> : null}

      {gone ? (
        <p className="bubble__body bubble__body--gone">Unsent</p>
      ) : message.body ? (
        <p className="bubble__body">{linkify(message.body)}</p>
      ) : null}

      <span className="bubble__meta">
        {/* Said out loud, always. A chat where messages can change quietly is
            one where you cannot trust what you remember reading. */}
        {message.edited_at && !gone ? <span className="bubble__edited">edited</span> : null}
        <span className="bubble__time">{clockTime(message.created_at)}</span>
        {mine && !gone ? <Tick pending={message.pending} /> : null}
      </span>

      {reactionList.length ? (
        <span className="bubble__reactions">
          {reactionList.map(([emoji, sides]) => {
            const held = sides.includes(side);
            return (
              <button
                key={emoji}
                type="button"
                className={held ? 'reaction is-mine' : 'reaction'}
                onClick={() => onReact && onReact(message.id, emoji)}
                aria-label={held ? `${emoji} — take yours back` : `${emoji} — add yours`}
              >
                <span aria-hidden="true">{emoji}</span>
                {sides.length > 1 ? <span className="reaction__n">{sides.length}</span> : null}
              </button>
            );
          })}
        </span>
      ) : null}

      {actionable ? (
        <span className="bubble__tools">
          <button
            type="button"
            className="bubble__more"
            aria-label="Message actions"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span aria-hidden="true">⋯</span>
          </button>

          {menuOpen ? (
            <span className="bubble__menu">
              <span className="bubble__palette">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="bubble__palette-btn"
                    aria-label={emoji}
                    onClick={() => {
                      setMenuOpen(false);
                      if (onReact) onReact(message.id, emoji);
                    }}
                  >
                    <span aria-hidden="true">{emoji}</span>
                  </button>
                ))}
              </span>

              <button
                type="button"
                className="bubble__reply"
                onClick={() => {
                  setMenuOpen(false);
                  if (onReply) onReply(message);
                }}
              >
                Reply
              </button>

              {/* Words only — there is nothing useful to put on a clipboard
                  for a photo whose URL expires within the hour. */}
              {!isPhoto && !isVoice && message.body ? (
                <button
                  type="button"
                  className="bubble__reply"
                  onClick={() => {
                    setMenuOpen(false);
                    if (onCopy) onCopy(message.body);
                  }}
                >
                  Copy
                </button>
              ) : null}

              {/* Words only. A caption edit that could also swap the photo is
                  a different feature with different consequences. */}
              {mine && !isPhoto && !isVoice ? (
                <button
                  type="button"
                  className="bubble__reply"
                  onClick={() => {
                    setMenuOpen(false);
                    if (onEdit) onEdit(message);
                  }}
                >
                  Edit
                </button>
              ) : null}

              {mine ? (
                <button
                  type="button"
                  className="bubble__unsend"
                  onClick={() => {
                    setMenuOpen(false);
                    if (onUnsend) onUnsend(message.id);
                  }}
                >
                  Unsend
                </button>
              ) : null}
            </span>
          ) : null}
        </span>
      ) : null}
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
/**
 * Fold the other side's reactions and unsends into messages we already hold.
 *
 * Returns the SAME array when nothing moved. That matters: this runs on every
 * four-second poll, and handing React a fresh array each time would re-render
 * the whole thread — and fight the scroll position — for no reason at all.
 */
function applyStates(current, states) {
  if (!states || !states.length) return current;

  const byId = new Map(states.map((s) => [s.id, s]));
  let changed = false;

  const next = current.map((m) => {
    const state = byId.get(m.id);
    if (!state) return m;

    const reactions = state.reactions || {};
    const deletedAt = state.deleted_at || null;

    const sameReactions = JSON.stringify(m.reactions || {}) === JSON.stringify(reactions);
    const sameDeleted = (m.deleted_at || null) === deletedAt;
    if (sameReactions && sameDeleted) return m;

    changed = true;

    /* An unsend takes the words and the picture with it here too, so a copy of
       the room that was open when it happened does not keep showing them. */
    return deletedAt
      ? { ...m, reactions, deleted_at: deletedAt, body: '', media_path: null, media_url: null, local_url: null }
      : { ...m, reactions, deleted_at: null };
  });

  return changed ? next : current;
}

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
        Boolean(x.media_path) === Boolean(m.media_path) &&
        /* Kind as well as presence: a photo and a voice note sent in the same
           breath are both "has media" with an empty body, and without this
           they can retire each other's placeholder and swap pictures. */
        (m.media_kind || null) === (x.media_path ? mediaKind(x.media_path) : null),
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
