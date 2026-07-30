'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { filterMessages } from '../data/library';
import { createCard, getCapabilities } from '../actions';
import {
  REASONS, STYLES, STYLE_LABEL, THEMES, LIMITS, FEELING_EMOJI, MAX_STICKERS,
  softenReason, stickerLabel, normaliseUnlockAt, UNLOCK_MIN_MS, UNLOCK_MAX_MS,
} from '@/lib/constants';
import { PACKS, Sticker } from './stickers';
import PackTabs from './PackTabs';
import {
  DEFAULT_OCCASION, OCCASION_CHOICES, getOccasion, envelopeSubtitle, envelopeTitle,
  occasionSteps, occasionRecipients, occasionSeverities, occasionSuggestedStickers,
  stripPromiseLead, promiseText, allowsRecipient, safeOccasion,
} from '@/lib/occasions';
import { rememberCard } from '@/lib/mycards';
import { truncate } from '@/lib/truncate';
import { CUTENESS_MAX, cutenessScore, cutenessLabel, cutenessHint } from '@/lib/cuteness';
import { celebrate } from './ui';
import CopyRow from './CopyRow';
import ShareRow from './ShareRow';
import BetaChip from './BetaChip';

/**
 * The card maker.
 *
 * The occasion comes first, and the occasion decides the rest: which questions
 * get asked, in what order, and what they are called. Everything below renders
 * a list of step KEYS supplied by lib/occasions.js rather than a fixed run of
 * numbered cases — which is how a birthday skips "what happened" and a proposal
 * skips both that and the severity question without a single `if`.
 *
 * All answers live in one `data` object in memory — nothing is stored in the
 * browser, and nothing reaches the server until "Create your card" is pressed.
 */

/* How long we wait for "Create your card" before offering a retry. A server
   action that never settles used to leave the button spinning forever. */
const CREATE_TIMEOUT_MS = 12000;

const EMPTY = {
  /* '' until they have chosen — the maker opens on the occasion question. */
  occasion: '',
  recipient: '',
  to_name: '',
  from_name: '',
  severity: 2,
  reasons: [],
  reasonText: '',
  style: '',
  messageIndex: -1,
  message: '',
  promise: '',
  memory: '',
  theme: 'blush',
  stickers: [],
  /* Time capsule. `sealed` is the toggle; `unlockLocal` is the raw value of the
     datetime-local field, which is a local-clock string like "2026-12-25T09:00". */
  sealed: false,
  unlockLocal: '',
};

const STEP_WORDS = [
  'one', 'two', 'three', 'four', 'five', 'six',
  'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
];

/* datetime-local speaks local wall-clock time, so both ends of the range have
   to be formatted in the visitor's own timezone rather than as ISO/UTC. */
function toLocalInputValue(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/**
 * A datetime-local value -> an ISO string, or null.
 *
 * Browsers that do not support type="datetime-local" fall back to a plain text
 * box, so this can receive literally anything the visitor typed. `new
 * Date("banana").toISOString()` throws a RangeError, and thrown from inside a
 * useMemo that runs on every keystroke it takes the whole maker down with it.
 * Anything unparseable is treated as "no seal".
 */
function localToIso(value) {
  if (!value) return null;
  const when = new Date(value).getTime();
  if (!Number.isFinite(when)) return null;
  return new Date(when).toISOString();
}

/* ---------------------------------------------------------------- helpers */

const tidy = (value) => String(value ?? '').replace(/[ \t]+/g, ' ').trim();

/** The combined "what happened" line shown as an aside on the card.
 *
 *  truncate() rather than .slice(): five preset reasons plus a free-text note
 *  easily runs past the limit, and cutting there can land in the middle of an
 *  emoji. That leaves a lone surrogate, which makes the JSON invalid UTF-8 and
 *  the insert fail — the card would silently degrade to a hash link because
 *  somebody typed "😭" at the end. See lib/truncate.js. */
function buildReason(data) {
  const parts = [...data.reasons];
  if (data.reasonText) parts.push(data.reasonText);
  return truncate(parts.join(' · '), LIMITS.reason);
}

/** Wizard answers -> the card shape used everywhere else. */
function toCard(data) {
  const occasion = safeOccasion(data.occasion);
  const asks = occasionSteps(occasion);
  return {
    occasion,
    /* Sent so the server can check it against the occasion, never stored. */
    recipient: data.recipient,
    to_name: data.to_name,
    from_name: data.from_name,
    severity: asks.includes('severity') ? data.severity : getOccasion(occasion).defaultSeverity || 2,
    message: data.message,
    reason: asks.includes('reason') ? buildReason(data) : '',
    promise: data.promise,
    memory: data.memory,
    style: data.style || 'sweet',
    theme: data.theme,
    stickers: data.stickers,
    /* null unless they sealed it; the server re-validates either way. */
    unlock_at: data.sealed ? localToIso(data.unlockLocal) : null,
  };
}

/* ------------------------------------------------------------- cuteness */

/* The scoring itself lives in lib/cuteness.js, because the card the recipient
   opens shows the same meter (and lets them poke it). A wish counts exactly
   like a promise — it is the same field wearing a party hat. */

function CutenessMeter({ data, showHint = true }) {
  const score = cutenessScore(data);
  const label = cutenessLabel(score);
  return (
    <div className={`cuteness${score >= 105 ? ' is-max' : ''}`}>
      <div className="cuteness__head">
        <span className="cuteness__title">Cuteness</span>
        <span className="cuteness__label">
          {score}% · {label}
        </span>
      </div>
      <div
        className="cuteness__track"
        role="progressbar"
        aria-label="Cuteness meter"
        aria-valuemin={0}
        aria-valuemax={CUTENESS_MAX}
        aria-valuenow={score}
        aria-valuetext={`${score}% — ${label}`}
      >
        <span className="cuteness__fill" style={{ width: `${(score / CUTENESS_MAX) * 100}%` }} />
      </div>
      {showHint ? <p className="cuteness__hint">{cutenessHint(data)}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------- mini card */

function MiniCard({ card }) {
  const occasion = getOccasion(card.occasion);
  const stickers = Array.isArray(card.stickers) ? card.stickers.slice(0, MAX_STICKERS) : [];
  return (
    <div className={`mini themed${stickers.length ? ' mini--stickered' : ''}`} data-theme={card.theme}>
      {stickers.map((id, i) => (
        <Sticker key={id} id={id} size={44} className={`mini-sticker mini-sticker--${i + 1}`} />
      ))}
      <div className="mini__top" style={{ background: 'var(--t-env-flap)', color: 'var(--t-ink)' }}>{/* envelope side: page ink */}
        <div className="mini__seal" style={{ background: 'var(--t-seal)', color: '#fff' }} aria-hidden="true">
          ♥
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>
          {envelopeTitle(card.occasion, card.to_name || 'them')}
        </div>
        <div style={{ fontSize: '.82rem', opacity: 0.75 }}>{envelopeSubtitle(card.occasion, card.severity)}</div>
      </div>

      <div className="mini__body" style={{ background: 'var(--t-paper)', color: 'var(--t-paper-ink)' }}>
        <div className="mini__dear">Dear {card.to_name || 'you'},</div>
        <div className="mini__msg">{card.message || 'Your message will appear here.'}</div>

        {/* Matches the card itself: a gentle aside under the message rather
            than a "Re:" subject line above it. */}
        {card.reason ? <div className="mini__about">…about {softenReason(card.reason)} 🙈</div> : null}

        {card.promise ? (
          <div className="mini__extra" style={{ background: 'var(--t-accent-soft)', color: 'var(--t-paper-ink)' }}>
            <b style={{ color: 'var(--t-accent)' }}>{occasion.promise.boxTitle}:</b>
            <br />
            {promiseText(card.occasion, card.promise)}
          </div>
        ) : null}

        {card.memory ? (
          <div className="mini__extra" style={{ background: 'var(--t-accent-soft)', color: 'var(--t-paper-ink)' }}>
            Remember {card.memory}? I want more of that.
          </div>
        ) : null}

        <div className="mini__sign" style={{ color: 'var(--t-accent)' }}>
          — {card.from_name || 'you'}, {occasion.signOff}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- copy-able link */

function LinkRow({ label, url, help, tone = 'public' }) {
  return (
    <div className="linkgroup">
      <h4>{label}</h4>
      <CopyRow url={url} ariaLabel={label} tone={tone} />
      {help ? <p>{help}</p> : null}
    </div>
  );
}

/* ==========================================================================
   Wizard
   ========================================================================== */

export default function Wizard({ onClose, dbEnabled = false, open = true, start = null }) {
  const [data, setData] = useState(EMPTY);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // what createCard gave us back
  const [packId, setPackId] = useState(PACKS[0].id); // sticker step: visible pack
  /* Starts from the value the (static) page was built with, then confirms it
     against the running server — see getCapabilities in app/actions.js. */
  const [dbReady, setDbReady] = useState(dbEnabled);
  const stepRef = useRef(null);
  const messageRef = useRef(null);
  const attemptRef = useRef(0);

  const set = useCallback((patch) => setData((d) => ({ ...d, ...patch })), []);

  /* The occasion drives everything. Until one is chosen we lay the maker out
     with the default so the progress bar has something honest to show. */
  const occasionId = data.occasion || DEFAULT_OCCASION;
  const occasion = getOccasion(occasionId);
  const copy = occasion.wizard;

  /* Step ZERO is always the occasion question; the rest comes from the config.
     Keeping the picker in the list (rather than before it) means Back from the
     first question walks to it instead of closing the maker. */
  const steps = useMemo(() => ['occasion', ...occasionSteps(occasionId)], [occasionId]);
  const totalSteps = steps.length;
  const key = steps[step] || 'done';

  const done = step >= totalSteps;
  const shown = Math.min(step + 1, totalSteps);

  const goTo = useCallback((next, dir) => {
    setDirection(dir);
    setErrors({});
    setStep(next);
  }, []);

  const next = useCallback(() => goTo(Math.min(step + 1, totalSteps), 1), [goTo, step, totalSteps]);
  const back = useCallback(() => {
    if (step === 0) {
      onClose();
      return;
    }
    goTo(step - 1, -1);
  }, [goTo, onClose, step]);

  /**
   * Opened from an occasion shortcut ("Birthday 🎂" under the hero).
   *
   * `start` carries a token that changes on every such click, so choosing a
   * different occasion always starts a fresh card rather than dropping them
   * halfway through the last one with the wrong questions around them.
   */
  const startedRef = useRef(null);
  useEffect(() => {
    if (!start || !start.occasion) return;
    if (startedRef.current === start.token) return;
    startedRef.current = start.token;
    setData({ ...EMPTY, occasion: safeOccasion(start.occasion) });
    setResult(null);
    setErrors({});
    setDirection(1);
    setStep(1); // straight past the picker — they already answered it
  }, [start]);

  useEffect(() => {
    let alive = true;
    getCapabilities()
      .then((caps) => {
        if (alive) setDbReady(Boolean(caps && caps.db));
      })
      .catch(() => {
        /* Keep whatever the page was built with — the worst case is that the
           seal toggle is hidden, and createCard still does the right thing. */
      });
    return () => {
      alive = false;
    };
  }, []);

  /* Esc closes the maker — but only while it is on screen. The component stays
     mounted when closed (see MakerProvider) so its answers survive. */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  /* Move focus to the new question so keyboard and screen readers keep up. */
  useEffect(() => {
    if (!open) return;
    const el = stepRef.current;
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  }, [step, open]);

  /* Has anything actually been typed or chosen? Used only to decide whether a
     refresh is worth interrupting. */
  const hasAnswers = useMemo(
    () =>
      Boolean(
        data.recipient ||
          data.to_name ||
          data.from_name ||
          data.message ||
          data.promise ||
          data.memory ||
          data.style ||
          data.reasonText ||
          (data.reasons && data.reasons.length) ||
          (data.stickers && data.stickers.length),
      ),
    [data],
  );

  /**
   * "Leave site?" while there are unsaved answers.
   *
   * Nothing is stored anywhere until "Create your card" is pressed, so a stray
   * refresh or a closed tab really does lose the lot. The browser's own confirm
   * dialog is the only thing that can interrupt that.
   *
   * Deliberately NOT shown once `result` exists: by then the card is made, the
   * link is on screen, and — in hash mode — also remembered in My cards, so
   * there is nothing left to lose and the prompt would just be rude.
   */
  useEffect(() => {
    if (!open || result || !hasAnswers) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = ''; // required by some browsers to actually show the prompt
      return '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [open, result, hasAnswers]);

  const messages = useMemo(
    () => filterMessages(occasionId, data.style, data.recipient),
    [occasionId, data.style, data.recipient],
  );
  const card = useMemo(() => toCard(data), [data]);

  /* Bounds for the seal-date picker, in the visitor's own clock. Computed once
     per mount: good enough, and it keeps the input from re-rendering every tick. */
  const unlockRange = useMemo(
    () => ({
      min: toLocalInputValue(Date.now() + UNLOCK_MIN_MS),
      max: toLocalInputValue(Date.now() + UNLOCK_MAX_MS),
    }),
    [],
  );

  /**
   * Choosing (or changing) the occasion.
   *
   * The libraries are per-occasion, so a message picked for an apology has no
   * business surviving into a birthday card. The recipient survives only if the
   * new occasion offers them — you cannot propose to your dad.
   */
  const chooseOccasion = useCallback(
    (id) => {
      const nextId = safeOccasion(id);
      setData((d) => {
        if (d.occasion === nextId) return d;
        return {
          ...d,
          occasion: nextId,
          recipient: allowsRecipient(nextId, d.recipient) ? d.recipient : '',
          messageIndex: -1,
          message: '',
          severity: occasionSteps(nextId).includes('severity')
            ? d.severity
            : getOccasion(nextId).defaultSeverity || 2,
          /* "What happened" belongs to apologies only. */
          reasons: occasionSteps(nextId).includes('reason') ? d.reasons : [],
          reasonText: occasionSteps(nextId).includes('reason') ? d.reasonText : '',
        };
      });
    },
    [],
  );

  /** Drop an emoji into the message at the cursor (or at the end). */
  function insertEmoji(glyph) {
    const field = messageRef.current;
    const current = data.message || '';
    if (current.length + glyph.length + 1 > LIMITS.message) return;

    const start = field && typeof field.selectionStart === 'number' ? field.selectionStart : current.length;
    const end = field && typeof field.selectionEnd === 'number' ? field.selectionEnd : current.length;
    const gap = start > 0 && !/\s$/.test(current.slice(0, start)) ? ' ' : '';
    const insertion = gap + glyph;

    set({ message: current.slice(0, start) + insertion + current.slice(end) });
    setErrors({});

    /* Put the cursor back after the emoji so they can keep typing. */
    window.requestAnimationFrame(() => {
      if (!field) return;
      field.focus();
      const caret = start + insertion.length;
      try {
        field.setSelectionRange(caret, caret);
      } catch {
        /* some browsers refuse on hidden fields — harmless */
      }
    });
  }

  /* ----------------------------------------------------------- validation */
  function validateNames() {
    const to_name = truncate(tidy(data.to_name), LIMITS.name);
    const from_name = truncate(tidy(data.from_name), LIMITS.name);
    set({ to_name, from_name });
    const nextErrors = {};
    if (!to_name) nextErrors.to = 'Who is this for?';
    if (!from_name) nextErrors.from = 'They should know it is from you.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateMessage() {
    const message = truncate(
      String(data.message || '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
      LIMITS.message,
    );
    set({ message });
    if (!message) {
      setErrors({ message: 'Pick a message above or write your own.' });
      return false;
    }
    setErrors({});
    return true;
  }

  /* -------------------------------------------------------------- create */
  /**
   * Creates the card, and refuses to hang while doing it.
   *
   * If the server has not answered within CREATE_TIMEOUT_MS we stop waiting,
   * put the button back and offer a retry — no infinite spinner. The request
   * itself is still in flight, so if a slow answer does turn up before they
   * press retry we quietly accept it rather than making a second card.
   */
  async function handleCreate() {
    if (busy) return;
    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;

    setBusy(true);
    setErrors({});

    const timer = window.setTimeout(() => {
      if (attemptRef.current !== attempt) return;
      setBusy(false);
      setErrors({
        create: 'That is taking longer than it should. Check your connection and try again — nothing was lost.',
      });
    }, CREATE_TIMEOUT_MS);

    try {
      const response = await createCard(card);
      window.clearTimeout(timer);
      /* Superseded by a retry — let the newer attempt own the screen. */
      if (attemptRef.current !== attempt) return;

      if (!response.ok) {
        setErrors({ create: response.error || 'Something went wrong. Please try again.' });
        setBusy(false);
        return;
      }
      setResult(response);

      /* Remember it on this device so /mine can hand the private link back if
         they lose it. Only real cards have one; hash-mode cards are their own
         link. Failure here is silent by design — see lib/mycards.js. */
      if (response.mode === 'db' && response.id && response.editToken) {
        rememberCard({
          kind: 'db',
          id: response.id,
          editToken: response.editToken,
          toName: card.to_name,
          occasion: card.occasion,
          createdAt: new Date().toISOString(),
          unlockAt: response.unlockAt || null,
        });
      } else if (response.mode === 'hash' && response.payload) {
        /* Hash-mode cards live entirely in their link, so the link IS the card.
           Remember the finished URL: refreshing this screen used to lose it for
           good, with nothing on any server to recover it from. */
        const origin = response.origin || (typeof window !== 'undefined' ? window.location.origin : '');
        rememberCard({
          kind: 'hash',
          url: `${origin}/c/local#c=${response.payload}`,
          toName: card.to_name,
          occasion: card.occasion,
          createdAt: new Date().toISOString(),
        });
      }

      goTo(totalSteps, 1);
      setTimeout(() => celebrate(), 260);
    } catch {
      window.clearTimeout(timer);
      if (attemptRef.current !== attempt) return;
      setErrors({ create: 'Could not reach the server. Please try again.' });
    } finally {
      if (attemptRef.current === attempt) setBusy(false);
    }
  }

  /** Validate the seal date before we bother the server with it. */
  function validateUnlock() {
    if (!data.sealed) return true;
    if (!data.unlockLocal) {
      setErrors({ unlock: 'Pick the moment it should open.' });
      return false;
    }
    const iso = localToIso(data.unlockLocal);
    if (!iso) {
      setErrors({ unlock: 'That date did not look right — pick it again.' });
      return false;
    }
    const check = normaliseUnlockAt(iso);
    if (check.error) {
      setErrors({ unlock: check.error });
      return false;
    }
    setErrors({});
    return true;
  }

  /* Links to show on the success screen. */
  const links = useMemo(() => {
    if (!result) return null;
    if (result.mode === 'db') {
      return { card: result.cardUrl, sender: result.senderUrl };
    }
    const origin =
      result.origin || (typeof window !== 'undefined' ? window.location.origin : '');
    return { card: `${origin}/c/local#c=${result.payload}`, sender: null };
  }, [result]);

  /* ------------------------------------------------------------- render */

  const kicker = key === 'preview' ? 'Almost there' : `Step ${STEP_WORDS[step] || step + 1}`;

  const stepTitles = {
    occasion: "What's the occasion?",
    recipient: copy.recipientQ,
    names: 'The important names',
    severity: copy.severityQ,
    reason: copy.reasonQ,
    style: copy.styleQ,
    message: copy.messageQ,
    promise: copy.promiseQ,
    theme: copy.themeQ,
    stickers: 'Add stickers 🧸',
    preview: 'Here it is',
  };

  function renderStep() {
    switch (key) {
      /* ---- the occasion --------------------------------------------- */
      case 'occasion':
        return (
          <>
            <Head
              kicker={kicker}
              title="What's the occasion?"
              sub="Three kinds of card so far. They each ask slightly different questions."
            />
            <div className="opts opts--3" role="radiogroup" aria-label="Occasion">
              {OCCASION_CHOICES.map((o) => (
                <Opt
                  key={o.id}
                  emoji={o.emoji}
                  label={o.label}
                  desc={o.desc}
                  on={data.occasion === o.id}
                  onClick={() => {
                    chooseOccasion(o.id);
                    window.setTimeout(next, 260);
                  }}
                />
              ))}
            </div>
          </>
        );

      /* ---- who ------------------------------------------------------- */
      case 'recipient':
        return (
          <>
            <Head kicker={kicker} title={copy.recipientQ} sub={copy.recipientSub} />
            <div className="opts" role="radiogroup" aria-label="Recipient">
              {occasionRecipients(occasionId).map((r) => (
                <Opt
                  key={r.id}
                  emoji={r.emoji}
                  label={r.label}
                  on={data.recipient === r.id}
                  onClick={() => {
                    /* A different recipient can mean a different shortlist. */
                    set(r.id === data.recipient ? { recipient: r.id } : { recipient: r.id, messageIndex: -1 });
                    window.setTimeout(next, 260);
                  }}
                />
              ))}
            </div>
          </>
        );

      /* ---- names ----------------------------------------------------- */
      case 'names':
        return (
          <>
            <Head kicker={kicker} title="The important names" sub="They go on the envelope and the signature." />
            <div className="field">
              <label htmlFor="fTo">Their name</label>
              <input
                className={`input${errors.to ? ' is-invalid' : ''}`}
                id="fTo"
                type="text"
                maxLength={LIMITS.name}
                autoComplete="off"
                placeholder="e.g. Sam"
                value={data.to_name}
                onChange={(e) => set({ to_name: e.target.value })}
              />
              <p className="err">{errors.to || ''}</p>
            </div>
            <div className="field">
              <label htmlFor="fFrom">Your name</label>
              <input
                className={`input${errors.from ? ' is-invalid' : ''}`}
                id="fFrom"
                type="text"
                maxLength={LIMITS.name}
                autoComplete="off"
                placeholder="e.g. Alex"
                value={data.from_name}
                onChange={(e) => set({ from_name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && validateNames()) next();
                }}
              />
              <p className="err">{errors.from || ''}</p>
            </div>
            <Nav onNext={() => validateNames() && next()} />
          </>
        );

      /* ---- severity / how big it should feel ------------------------- */
      case 'severity':
        return (
          <>
            <Head kicker={kicker} title={copy.severityQ} sub={copy.severitySub} />
            <div className="opts opts--3" role="radiogroup" aria-label={copy.severityQ}>
              {occasionSeverities(occasionId).map((s) => (
                <Opt
                  key={s.v}
                  emoji={s.emoji}
                  label={s.label}
                  desc={s.desc}
                  on={data.severity === s.v}
                  onClick={() => {
                    set({ severity: s.v });
                    window.setTimeout(next, 260);
                  }}
                />
              ))}
            </div>
          </>
        );

      /* ---- what happened (apologies only, optional) ------------------ */
      case 'reason':
        return (
          <>
            <Head kicker={kicker} title={copy.reasonQ} sub={copy.reasonSub} />
            <div className="chips" role="group" aria-label="Quick reasons">
              {REASONS.map((r) => {
                const on = data.reasons.includes(r);
                return (
                  <button
                    type="button"
                    key={r}
                    className={`chip${on ? ' is-on' : ''}`}
                    aria-pressed={on}
                    onClick={() =>
                      set({
                        reasons: on ? data.reasons.filter((x) => x !== r) : [...data.reasons, r],
                      })
                    }
                  >
                    {r}
                  </button>
                );
              })}
            </div>
            <div className="field">
              <label htmlFor="fWhy">
                In your own words <span style={{ fontWeight: 600, color: 'var(--plum-soft)' }}>(optional)</span>
              </label>
              <input
                className="input"
                id="fWhy"
                type="text"
                maxLength={90}
                placeholder="e.g. I missed the dinner you planned for weeks"
                value={data.reasonText}
                onChange={(e) => set({ reasonText: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    set({ reasonText: tidy(data.reasonText) });
                    next();
                  }
                }}
              />
              <p className="hint">Keep it short — this shows up as a small label on the card.</p>
            </div>
            <Nav
              skipLabel="Skip this"
              onSkip={() => {
                set({ reasons: [], reasonText: '' });
                next();
              }}
              onNext={() => {
                set({ reasonText: tidy(data.reasonText) });
                next();
              }}
            />
          </>
        );

      /* ---- style ----------------------------------------------------- */
      case 'style':
        return (
          <>
            <Head kicker={kicker} title={copy.styleQ} sub={copy.styleSub} />
            <div className="opts" role="radiogroup" aria-label={copy.styleQ}>
              {STYLES.map((s) => (
                <Opt
                  key={s.id}
                  emoji={s.emoji}
                  label={s.label}
                  desc={s.desc}
                  on={data.style === s.id}
                  onClick={() => {
                    set(s.id === data.style ? { style: s.id } : { style: s.id, messageIndex: -1 });
                    window.setTimeout(next, 260);
                  }}
                />
              ))}
            </div>
          </>
        );

      /* ---- message --------------------------------------------------- */
      case 'message': {
        const who = occasionRecipients(occasionId).find((r) => r.id === data.recipient);
        const sub = `Written for ${who ? who.label.toLowerCase() : 'anyone'}, in the ${(
          STYLE_LABEL[data.style] || 'chosen'
        ).toLowerCase()} style. Tap one, then make it yours.`;
        return (
          <>
            <Head kicker={kicker} title={copy.messageQ} sub={sub} />
            <div className="msg-list" role="listbox" aria-label="Suggested messages">
              {messages.length ? (
                messages.map((m, i) => (
                  <button
                    type="button"
                    key={i}
                    className={`msg-opt${data.messageIndex === i ? ' is-on' : ''}`}
                    role="option"
                    aria-selected={data.messageIndex === i}
                    onClick={() => {
                      set({ messageIndex: i, message: m.t });
                      setErrors({});
                    }}
                  >
                    {m.t}
                  </button>
                ))
              ) : (
                <p className="msg-empty">
                  No messages match that combination yet — write your own below, it will be better anyway.
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="fMsg">Make it yours — edit anything</label>
              <textarea
                ref={messageRef}
                className={`textarea${errors.message ? ' is-invalid' : ''}`}
                id="fMsg"
                maxLength={LIMITS.message}
                placeholder="Pick a message above, or write something only you would say…"
                value={data.message}
                onChange={(e) => set({ message: e.target.value })}
              />
              <p className="err">{errors.message || ''}</p>

              <div className="emoji-row" role="group" aria-label="Add a little feeling to your message">
                <span className="emoji-row__label">Add a little feeling</span>
                {FEELING_EMOJI.map((glyph) => (
                  <button
                    type="button"
                    key={glyph}
                    className="emoji-chip"
                    aria-label={`Add ${glyph} to your message`}
                    onClick={() => insertEmoji(glyph)}
                  >
                    {glyph}
                  </button>
                ))}
              </div>
            </div>
            <Nav
              skipLabel="Write my own"
              onSkip={() => {
                set({ messageIndex: -1, message: '' });
                const field = document.getElementById('fMsg');
                if (field) field.focus();
              }}
              onNext={() => validateMessage() && next()}
            />
          </>
        );
      }

      /* ---- promise / wish + memory (optional) ------------------------ */
      case 'promise':
        return (
          <>
            <Head kicker={kicker} title={copy.promiseQ} sub={copy.promiseSub} />
            <div className="field">
              <label htmlFor="fProm">{occasion.promise.label}</label>
              <input
                className="input"
                id="fProm"
                type="text"
                maxLength={LIMITS.promise}
                placeholder={occasion.promise.placeholder}
                value={data.promise}
                onChange={(e) => set({ promise: e.target.value })}
              />
              <p className="hint">{occasion.promise.hint}</p>
            </div>
            <div className="field">
              <label htmlFor="fMem">A memory I love: …</label>
              <input
                className="input"
                id="fMem"
                type="text"
                maxLength={LIMITS.memory}
                placeholder="the night we got lost looking for that taco place"
                value={data.memory}
                onChange={(e) => set({ memory: e.target.value })}
              />
              <p className="hint">It appears as “Remember … ? I want more of that.”</p>
            </div>
            <Nav
              skipLabel="Skip this"
              onSkip={() => {
                set({ promise: '', memory: '' });
                next();
              }}
              onNext={() => {
                set({
                  promise: stripPromiseLead(occasionId, tidy(data.promise)),
                  memory: tidy(data.memory).replace(/^remember\s+/i, '').replace(/[?.]+$/, ''),
                });
                next();
              }}
            />
          </>
        );

      /* ---- theme ----------------------------------------------------- */
      case 'theme':
        return (
          <>
            <Head kicker={kicker} title={copy.themeQ} sub={copy.themeSub} />
            <div className="themes" role="radiogroup" aria-label="Theme">
              {THEMES.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={`theme-opt${data.theme === t.id ? ' is-on' : ''}`}
                  role="radio"
                  aria-checked={data.theme === t.id}
                  onClick={() => set({ theme: t.id })}
                >
                  <span className="theme-opt__swatch" style={{ background: t.bg }}>
                    {t.dots.map((d) => (
                      <span key={d} className="theme-opt__dot" style={{ background: d }} />
                    ))}
                  </span>
                  <span className="theme-opt__name">{t.label}</span>
                </button>
              ))}
            </div>
            <Nav nextLabel="Continue" onNext={next} />
          </>
        );

      /* ---- stickers (optional) --------------------------------------- */
      case 'stickers': {
        const chosen = data.stickers;
        const full = chosen.length >= MAX_STICKERS;
        const pack = PACKS.find((p) => p.id === packId) || PACKS[0];
        const suggestions = occasionSuggestedStickers(occasionId, data.style, data.severity);
        return (
          <>
            <Head
              kicker={kicker}
              title="Add stickers 🧸"
              sub="Optional. Six packs, sixty-two drawings — pick up to four and we'll stick them on their card. A couple peek out from the envelope too."
            />
            <span className="sticker-count">
              {chosen.length} of {MAX_STICKERS} picked
            </span>

            {/* Three one-tap picks matched to the occasion and the tone, so
                nobody has to scroll sixty-two drawings to get started. */}
            <div className="suggest">
              <p className="suggest__label">Suggested for this letter ✨</p>
              <div className="suggest__row">
                {suggestions.map((id) => {
                  const on = chosen.includes(id);
                  const label = stickerLabel(id) || 'Sticker';
                  return (
                    <button
                      type="button"
                      key={id}
                      className={`suggest__pick${on ? ' is-on' : ''}`}
                      aria-pressed={on}
                      disabled={!on && full}
                      title={label}
                      onClick={() =>
                        set({
                          stickers: on
                            ? chosen.filter((x) => x !== id)
                            : [...chosen, id].slice(0, MAX_STICKERS),
                        })
                      }
                    >
                      <Sticker id={id} size={54} className="suggest__art" />
                      <span className="suggest__name">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <PackTabs value={pack.id} onChange={setPackId} idPrefix="wiz" panelId="wiz-sticker-sheet" />
            <p className="pack-hint">Mix and match — your four can come from any pack.</p>
            <div
              className="sticker-sheet"
              id="wiz-sticker-sheet"
              role="tabpanel"
              aria-labelledby={`wiz-tab-${pack.id}`}
            >
              {pack.stickers.map((sticker) => {
                const on = chosen.includes(sticker.id);
                return (
                  <button
                    type="button"
                    key={sticker.id}
                    className={`sticker-pick${on ? ' is-on' : ''}`}
                    aria-pressed={on}
                    disabled={!on && full}
                    onClick={() =>
                      set({
                        stickers: on
                          ? chosen.filter((x) => x !== sticker.id)
                          : [...chosen, sticker.id].slice(0, MAX_STICKERS),
                      })
                    }
                  >
                    <Sticker id={sticker.id} size={58} className="sticker-pick__art" />
                    <span className="sticker-pick__name">{sticker.label}</span>
                  </button>
                );
              })}
            </div>
            <Nav
              nextLabel="See your card →"
              onNext={next}
              skipLabel="No stickers"
              onSkip={() => {
                set({ stickers: [] });
                next();
              }}
            />
          </>
        );
      }

      /* ---- preview + create ------------------------------------------ */
      case 'preview':
        return (
          <>
            <Head kicker={kicker} title="Here it is" sub={copy.previewSub} />
            <div className="order">
              <div>
                <MiniCard card={card} />
              </div>
              <div>
                <CutenessMeter data={data} />

                <div className="summary">
                  <div className="summary__row">
                    <b>Occasion</b>
                    <span>
                      {occasion.picker.emoji} {occasion.label}
                    </span>
                  </div>
                  <div className="summary__row">
                    <b>For</b>
                    <span>{card.to_name}</span>
                  </div>
                  <div className="summary__row">
                    <b>From</b>
                    <span>{card.from_name}</span>
                  </div>
                  <div className="summary__row">
                    <b>Style</b>
                    <span>{STYLE_LABEL[card.style] || card.style}</span>
                  </div>
                  <div className="summary__row">
                    <b>Card theme</b>
                    <span>{(THEMES.find((t) => t.id === card.theme) || {}).label}</span>
                  </div>
                </div>

                {/* ---- Time capsule --------------------------------------
                    Only offered when there is a database to hold the letter:
                    a hash link carries the card inside itself, so it cannot be
                    kept shut. Rather than a toggle that silently does nothing,
                    we say why. */}
                {dbReady ? (
                  <div className={`capsule${data.sealed ? ' is-on' : ''}`}>
                    <label className="capsule__switch">
                      <input
                        type="checkbox"
                        checked={data.sealed}
                        onChange={(e) => {
                          const sealed = e.target.checked;
                          set({
                            sealed,
                            /* Default to a week today — a nice "next Saturday" sort of gap. */
                            unlockLocal:
                              sealed && !data.unlockLocal
                                ? toLocalInputValue(Date.now() + 7 * 24 * 60 * 60 * 1000)
                                : data.unlockLocal,
                          });
                          setErrors({});
                        }}
                      />
                      <span className="capsule__track" aria-hidden="true" />
                      <span className="capsule__text">
                        <b>
                          Seal until a special date 🕰️
                          <BetaChip />
                        </b>
                        <small>They see a sealed envelope and a countdown until then.</small>
                      </span>
                    </label>

                    {data.sealed ? (
                      <div className="capsule__when">
                        <label htmlFor="fUnlock">It opens on</label>
                        <input
                          className={`input${errors.unlock ? ' is-invalid' : ''}`}
                          id="fUnlock"
                          type="datetime-local"
                          value={data.unlockLocal}
                          min={unlockRange.min}
                          max={unlockRange.max}
                          onChange={(e) => {
                            set({ unlockLocal: e.target.value });
                            setErrors({});
                          }}
                        />
                        <p className="hint">
                          Your own clock, at least an hour from now. Until then not one word of your
                          letter leaves our server — not even in the page source.
                        </p>
                        <p className="err">{errors.unlock || ''}</p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="capsule-note">
                    🕰️ Sealed letters are having a rest just now — this one will go out as a normal
                    card, ready to open the moment you send it.
                  </p>
                )}

                <button
                  type="button"
                  className="btn btn--primary btn--wide btn--lg"
                  onClick={() => validateUnlock() && handleCreate()}
                  disabled={busy}
                >
                  {busy ? (
                    <>
                      <span className="spinner" aria-hidden="true" /> Creating your card…
                    </>
                  ) : (
                    'Create your card →'
                  )}
                </button>
                <p className="err" style={{ textAlign: 'center' }}>
                  {errors.create || ''}
                </p>
                <p className="form-note">Free while in beta 🤍 No card details, no account, no catch.</p>
              </div>
            </div>
          </>
        );

      /* ---- success --------------------------------------------------- */
      default:
        return (
          <div className="done">
            <div className="done__hero">
              {/* The Truce mascot, having a very good day. */}
              <Sticker id="bandaged-heart" size={92} className="done__mascot" />
              <div className="done__badge" aria-hidden="true">
                🎉
              </div>
            </div>
            <h2>Your card is ready</h2>
            <p className="wstep__sub">
              Send the first link to {card.to_name}. Keep the second one to yourself — it is how you check in later.
            </p>

            {result && result.unlockAt ? (
              <p className="sealed-receipt">
                🕰️ Sealed. Until it opens, {card.to_name} sees a countdown and nothing else — you can
                send the link right now.
              </p>
            ) : null}

            {result && result.unlockDropped ? (
              <p className="notice">
                We couldn&rsquo;t seal this one, so it has gone out as a normal card — {card.to_name} can
                open it straight away.
              </p>
            ) : null}

            <CutenessMeter data={data} showHint={false} />

            {links ? (
              <>
                <LinkRow
                  label="Their link — send this one"
                  url={links.card}
                  help="Text it, email it, AirDrop it. It opens in any browser, no app needed."
                />

                <ShareRow
                  label={`Send it to ${card.to_name} ${occasion.badge}`}
                  text={`${occasion.badge} ${card.to_name}, I have something for you…`}
                  url={links.card}
                  channels={['native', 'whatsapp', 'telegram', 'sms', 'instagram', 'copy']}
                />

                {links.sender ? (
                  <>
                    <LinkRow
                      label="Your private link — keep this one"
                      url={links.sender}
                      tone="private"
                      help="This is your secret page — see when they open it and what they send back. Don't send them this one."
                    />
                    <p className="done__saved">
                      Saved on this device — find it later under{' '}
                      <a href="/mine">My cards</a>.
                    </p>
                  </>
                ) : /* Two different situations, and they must never be confused:
                      a wobble we can apologise for, or a site that has simply not
                      been switched on yet (which only its owner ever sees). */
                result && result.degraded ? (
                  <p className="notice">
                    Heads up — our database hiccuped, so this link carries the whole letter inside it. It works
                    perfectly, it is just long. Try again in a minute if you would like a short one.
                  </p>
                ) : (
                  <p className="notice">
                    This link carries the whole letter inside it, so it works anywhere — it is just long. Short links,
                    open-tracking and replies arrive once this site is connected to its database.
                  </p>
                )}
              </>
            ) : null}

            <div className="done__actions">
              <a className="btn btn--primary btn--lg" href={links ? links.card : '#'}>
                Open their experience
              </a>
              <button type="button" className="btn btn--ghost btn--lg" onClick={onClose}>
                Back to Truce
              </button>
            </div>
          </div>
        );
    }
  }

  return (
    <div
      className="wizard"
      role="dialog"
      aria-modal="true"
      aria-label="Create your card"
      /* Hidden rather than unmounted, so answers survive a close/reopen. */
      hidden={!open}
      inert={!open}
    >
      <div className="wizard__bar">
        <div className="wrap wizard__barin">
          <button type="button" className="icon-btn" onClick={back} disabled={done} aria-label="Previous step">
            <svg width="22" height="22" aria-hidden="true">
              <use href="#ic-back" />
            </svg>
          </button>

          <div className="wizard__progress">
            <div className="wizard__track">
              <div className="wizard__fill" style={{ width: `${done ? 100 : (shown / totalSteps) * 100}%` }} />
            </div>
            <span className="wizard__count">{done ? 'All done 🎉' : `Step ${shown} of ${totalSteps}`}</span>
          </div>

          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close and return to site">
            <svg width="22" height="22" aria-hidden="true">
              <use href="#ic-close" />
            </svg>
          </button>
        </div>
      </div>

      <div className="wizard__body">
        <div className="wizard__stage">
          <section
            key={`${occasionId}-${step}`}
            ref={stepRef}
            tabIndex={-1}
            className={`wstep is-active${direction < 0 ? ' is-back' : ''}`}
            aria-label={stepTitles[key] || 'Your card is ready'}
          >
            {renderStep()}
          </section>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- little building blocks */

function Head({ kicker, title, sub }) {
  return (
    <>
      <p className="wstep__kicker">{kicker}</p>
      <h2>{title}</h2>
      {sub ? <p className="wstep__sub">{sub}</p> : null}
    </>
  );
}

function Opt({ emoji, label, desc, on, onClick }) {
  return (
    <button type="button" className={`opt${on ? ' is-on' : ''}`} role="radio" aria-checked={on} onClick={onClick}>
      <span className="opt__emoji" aria-hidden="true">
        {emoji}
      </span>
      <span className="opt__label">{label}</span>
      {desc ? <span className="opt__desc">{desc}</span> : null}
    </button>
  );
}

function Nav({ onNext, nextLabel = 'Continue', onSkip, skipLabel }) {
  return (
    <div className="wizard__nav">
      {onSkip ? (
        <button type="button" className="btn btn--plain wizard__skip" onClick={onSkip}>
          {skipLabel}
        </button>
      ) : null}
      <button type="button" className="btn btn--primary" onClick={onNext}>
        {nextLabel}
      </button>
    </div>
  );
}
