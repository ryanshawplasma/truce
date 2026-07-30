'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MESSAGES from '../data/messages';
import { createCard } from '../actions';
import {
  RECIPIENTS, SEVERITIES, REASONS, STYLES, STYLE_LABEL, THEMES, LIMITS, FEELING_EMOJI, MAX_STICKERS,
  softenReason,
} from '@/lib/constants';
import { PACKS, Sticker } from './stickers';
import PackTabs from './PackTabs';
import { getOccasion, envelopeSubtitle } from '@/lib/occasions';
import { celebrate, copyText } from './ui';

/**
 * The card maker.
 *
 * Nine questions, then a preview, then a success screen with the real link.
 * All answers live in one `data` object in memory — nothing is stored in the
 * browser, and nothing reaches the server until "Create your card" is pressed.
 */

const OCCASION_ID = 'sorry';
const TOTAL_STEPS = 10; // the success screen is not counted

const EMPTY = {
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
};

/* ---------------------------------------------------------------- helpers */

const tidy = (value) => String(value ?? '').replace(/[ \t]+/g, ' ').trim();

function recipientTag(recipientId) {
  const found = RECIPIENTS.find((r) => r.id === recipientId);
  return found ? found.tag : 'any';
}

/** Messages matching the chosen style AND the recipient (or tagged "any"). */
function filterMessages(style, recipientId) {
  const tag = recipientTag(recipientId);
  return MESSAGES.filter((m) => {
    if (m.s !== style) return false;
    const who = m.who || ['any'];
    return who.includes(tag) || who.includes('any');
  });
}

/** The combined "what happened" line shown as `Re: …` on the card. */
function buildReason(data) {
  const parts = [...data.reasons];
  if (data.reasonText) parts.push(data.reasonText);
  return parts.join(' · ').slice(0, LIMITS.reason);
}

/** Wizard answers -> the card shape used everywhere else. */
function toCard(data) {
  return {
    occasion: OCCASION_ID,
    to_name: data.to_name,
    from_name: data.from_name,
    severity: data.severity,
    message: data.message,
    reason: buildReason(data),
    promise: data.promise,
    memory: data.memory,
    style: data.style || 'sweet',
    theme: data.theme,
    stickers: data.stickers,
  };
}

/* ------------------------------------------------------------- cuteness */

/**
 * The cuteness meter — pure fun, nothing is stored or sent anywhere.
 *
 * It rewards the things that actually make a card feel personal: a promise, a
 * memory, stickers, a bit of emoji in the message. Full marks is reachable but
 * takes effort, which is the point.
 */
/* Yes, it goes to 120%. Cuteness does not respect the laws of percentages. */
const CUTENESS_MAX = 120;

function cutenessScore(data) {
  let score = 30; // you showed up and wrote something
  if (tidy(data.promise)) score += 18;
  if (tidy(data.memory)) score += 18;
  score += Math.min(4, (data.stickers || []).length) * 7; // up to 28
  score += Math.min(4, countEmoji(data.message)) * 4; //     up to 16
  if (data.style) score += 5;
  if (data.theme) score += 5;
  return Math.max(0, Math.min(CUTENESS_MAX, score));
}

/** How many emoji are sprinkled through the message. */
function countEmoji(text) {
  const matches = String(text || '').match(/\p{Extended_Pictographic}/gu);
  return matches ? matches.length : 0;
}

function cutenessLabel(score) {
  if (score >= 120) return 'meter broken 🚨🧸💘';
  if (score >= 105) return 'off the charts 💘💘';
  if (score >= 90) return 'dangerously cute 🧸💘';
  if (score >= 80) return 'critically cute 💞';
  if (score >= 68) return 'extremely cute 🎀';
  if (score >= 54) return 'very cute 🧁';
  if (score >= 42) return 'pretty cute 🌸';
  return 'sweet start 🌱';
}

/** A nudge towards the one thing that would help most. */
function cutenessHint(data) {
  if (!tidy(data.promise)) return 'Add a promise for a big cuteness bump.';
  if (!tidy(data.memory)) return 'A shared memory would push this higher.';
  if ((data.stickers || []).length < 2) return 'Stickers are worth a lot. Just saying.';
  if (countEmoji(data.message) < 2) return 'A little emoji in the message goes a long way.';
  if (cutenessScore(data) >= 120) return 'You broke the meter. 120%. There is no higher honor.';
  return 'Honestly? This is about as cute as it gets.';
}

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
      <div className="mini__top" style={{ background: 'var(--t-env-flap)', color: 'var(--t-ink)' }}>
        <div className="mini__seal" style={{ background: 'var(--t-seal)', color: '#fff' }} aria-hidden="true">
          ♥
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>For {card.to_name || 'them'}</div>
        <div style={{ fontSize: '.82rem', opacity: 0.75 }}>{envelopeSubtitle(card.occasion, card.severity)}</div>
      </div>

      <div className="mini__body" style={{ background: 'var(--t-paper)', color: 'var(--t-ink)' }}>
        <div className="mini__dear">Dear {card.to_name || 'you'},</div>
        <div className="mini__msg">{card.message || 'Your message will appear here.'}</div>

        {/* Matches the card itself: a gentle aside under the message rather
            than a "Re:" subject line above it. */}
        {card.reason ? <div className="mini__about">…about {softenReason(card.reason)} 🙈</div> : null}

        {card.promise ? (
          <div className="mini__extra" style={{ background: 'var(--t-accent-soft)', color: 'var(--t-ink)' }}>
            <b style={{ color: 'var(--t-accent)' }}>My promise to you:</b>
            <br />I promise to {card.promise}
          </div>
        ) : null}

        {card.memory ? (
          <div className="mini__extra" style={{ background: 'var(--t-accent-soft)', color: 'var(--t-ink)' }}>
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
  const [state, setState] = useState('');

  const onCopy = async () => {
    const ok = await copyText(url);
    setState(ok ? 'Copied 🤍' : 'Select the link and copy it manually.');
    setTimeout(() => setState(''), 2600);
  };

  return (
    <div className="linkgroup">
      <h4>{label}</h4>
      <div className={`linkbox${tone === 'private' ? ' linkbox--private' : ''}`}>
        <input type="text" readOnly value={url} aria-label={label} onFocus={(e) => e.target.select()} />
        <button type="button" className="btn btn--primary btn--sm" onClick={onCopy}>
          Copy
        </button>
      </div>
      <p className="copy-state" role="status">
        {state}
      </p>
      {help ? <p>{help}</p> : null}
    </div>
  );
}

/* ==========================================================================
   Wizard
   ========================================================================== */

export default function Wizard({ onClose }) {
  const occasion = getOccasion(OCCASION_ID);
  const copy = occasion.wizard;

  const [data, setData] = useState(EMPTY);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // what createCard gave us back
  const [packId, setPackId] = useState(PACKS[0].id); // sticker step: visible pack
  const stepRef = useRef(null);
  const messageRef = useRef(null);

  const set = useCallback((patch) => setData((d) => ({ ...d, ...patch })), []);

  const done = step >= TOTAL_STEPS;
  const shown = Math.min(step + 1, TOTAL_STEPS);

  const goTo = useCallback((next, dir) => {
    setDirection(dir);
    setErrors({});
    setStep(next);
  }, []);

  const next = useCallback(() => goTo(Math.min(step + 1, TOTAL_STEPS), 1), [goTo, step]);
  const back = useCallback(() => {
    if (step === 0) {
      onClose();
      return;
    }
    goTo(step - 1, -1);
  }, [goTo, onClose, step]);

  /* Esc closes the maker. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* Move focus to the new question so keyboard and screen readers keep up. */
  useEffect(() => {
    const el = stepRef.current;
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  }, [step]);

  const messages = useMemo(() => filterMessages(data.style, data.recipient), [data.style, data.recipient]);
  const card = useMemo(() => toCard(data), [data]);

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
    const to_name = tidy(data.to_name).slice(0, LIMITS.name);
    const from_name = tidy(data.from_name).slice(0, LIMITS.name);
    set({ to_name, from_name });
    const nextErrors = {};
    if (!to_name) nextErrors.to = 'Who is this for?';
    if (!from_name) nextErrors.from = 'They should know it is from you.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateMessage() {
    const message = String(data.message || '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, LIMITS.message);
    set({ message });
    if (!message) {
      setErrors({ message: 'Pick a message above or write your own.' });
      return false;
    }
    setErrors({});
    return true;
  }

  /* -------------------------------------------------------------- create */
  async function handleCreate() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await createCard(card);
      if (!response.ok) {
        setErrors({ create: response.error || 'Something went wrong. Please try again.' });
        setBusy(false);
        return;
      }
      setResult(response);
      goTo(TOTAL_STEPS, 1);
      setTimeout(() => celebrate(), 260);
    } catch {
      setErrors({ create: 'Could not reach the server. Please try again.' });
    } finally {
      setBusy(false);
    }
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

  const stepTitles = [
    copy.recipientQ,
    'The important names',
    copy.severityQ,
    copy.reasonQ,
    copy.styleQ,
    copy.messageQ,
    copy.promiseQ,
    copy.themeQ,
    'Add stickers 🧸',
    'Here it is',
  ];

  function renderStep() {
    switch (step) {
      /* 1 — who --------------------------------------------------------- */
      case 0:
        return (
          <>
            <Head kicker="Step one" title={copy.recipientQ} sub={copy.recipientSub} />
            <div className="opts" role="radiogroup" aria-label="Recipient">
              {RECIPIENTS.map((r) => (
                <Opt
                  key={r.id}
                  emoji={r.emoji}
                  label={r.label}
                  on={data.recipient === r.id}
                  onClick={() => {
                    set({ recipient: r.id });
                    window.setTimeout(next, 260);
                  }}
                />
              ))}
            </div>
          </>
        );

      /* 2 — names ------------------------------------------------------- */
      case 1:
        return (
          <>
            <Head kicker="Step two" title="The important names" sub="They go on the envelope and the signature." />
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

      /* 3 — severity ---------------------------------------------------- */
      case 2:
        return (
          <>
            <Head kicker="Step three" title={copy.severityQ} sub={copy.severitySub} />
            <div className="opts opts--3" role="radiogroup" aria-label="Severity">
              {SEVERITIES.map((s) => (
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

      /* 4 — what happened (optional) ------------------------------------ */
      case 3:
        return (
          <>
            <Head kicker="Step four" title={copy.reasonQ} sub={copy.reasonSub} />
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

      /* 5 — style ------------------------------------------------------- */
      case 4:
        return (
          <>
            <Head kicker="Step five" title={copy.styleQ} sub={copy.styleSub} />
            <div className="opts" role="radiogroup" aria-label="Apology style">
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

      /* 6 — message ----------------------------------------------------- */
      case 5: {
        const who = RECIPIENTS.find((r) => r.id === data.recipient);
        const sub = `Written for ${who ? who.label.toLowerCase() : 'anyone'}, in the ${(
          STYLE_LABEL[data.style] || 'chosen'
        ).toLowerCase()} style. Tap one, then make it yours.`;
        return (
          <>
            <Head kicker="Step six" title={copy.messageQ} sub={sub} />
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

      /* 7 — promise + memory (optional) --------------------------------- */
      case 6:
        return (
          <>
            <Head kicker="Step seven" title={copy.promiseQ} sub={copy.promiseSub} />
            <div className="field">
              <label htmlFor="fProm">I promise to…</label>
              <input
                className="input"
                id="fProm"
                type="text"
                maxLength={LIMITS.promise}
                placeholder="call you back before you have to text twice"
                value={data.promise}
                onChange={(e) => set({ promise: e.target.value })}
              />
              <p className="hint">Small and true beats big and vague.</p>
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
                  promise: tidy(data.promise).replace(/^i\s+promise\s+to\s+/i, ''),
                  memory: tidy(data.memory).replace(/^remember\s+/i, '').replace(/[?.]+$/, ''),
                });
                next();
              }}
            />
          </>
        );

      /* 8 — theme ------------------------------------------------------- */
      case 7:
        return (
          <>
            <Head kicker="Step eight" title={copy.themeQ} sub={copy.themeSub} />
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

      /* 9 — stickers (optional) ----------------------------------------- */
      case 8: {
        const chosen = data.stickers;
        const full = chosen.length >= MAX_STICKERS;
        const pack = PACKS.find((p) => p.id === packId) || PACKS[0];
        return (
          <>
            <Head
              kicker="Step nine"
              title="Add stickers 🧸"
              sub="Optional. Six packs, sixty-two drawings — pick up to four and we'll stick them on their card. A couple peek out from the envelope too."
            />
            <span className="sticker-count">
              {chosen.length} of {MAX_STICKERS} picked
            </span>
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

      /* 10 — preview + create ------------------------------------------- */
      case 9:
        return (
          <>
            <Head
              kicker="Almost there"
              title="Here it is"
              sub="A preview of what lands on their screen. Happy with it? Let's make the link."
            />
            <div className="order">
              <div>
                <MiniCard card={card} />
              </div>
              <div>
                <CutenessMeter data={data} />

                <div className="summary">
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
                    <b>Theme</b>
                    <span>{(THEMES.find((t) => t.id === card.theme) || {}).label}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn--primary btn--wide btn--lg"
                  onClick={handleCreate}
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

      /* 10 — success ---------------------------------------------------- */
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

            <CutenessMeter data={data} showHint={false} />

            {links ? (
              <>
                <LinkRow
                  label="Their link — send this one"
                  url={links.card}
                  help="Text it, email it, AirDrop it. It opens in any browser, no app needed."
                />
                {links.sender ? (
                  <LinkRow
                    label="Your private link — keep this one"
                    url={links.sender}
                    tone="private"
                    help="This is your secret page — see when they open it and what they send back. Don't send them this one."
                  />
                ) : (
                  <p className="notice">
                    Running without a database, so this card travels inside its own link. It works perfectly and needs no
                    server — but there is no open-tracking or reactions page for it. Add Supabase env vars (see the
                    README) to switch on real short links.
                  </p>
                )}
                {result && result.degraded ? (
                  <p className="notice">
                    We could not reach the database just now, so we made you a self-contained link instead. Nothing was
                    lost.
                  </p>
                ) : null}
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
    <div className="wizard" role="dialog" aria-modal="true" aria-label="Create your apology card">
      <div className="wizard__bar">
        <div className="wrap wizard__barin">
          <button type="button" className="icon-btn" onClick={back} disabled={done} aria-label="Previous step">
            <svg width="22" height="22" aria-hidden="true">
              <use href="#ic-back" />
            </svg>
          </button>

          <div className="wizard__progress">
            <div className="wizard__track">
              <div className="wizard__fill" style={{ width: `${done ? 100 : (shown / TOTAL_STEPS) * 100}%` }} />
            </div>
            <span className="wizard__count">{done ? 'All done 🎉' : `Step ${shown} of ${TOTAL_STEPS}`}</span>
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
            key={step}
            ref={stepRef}
            tabIndex={-1}
            className={`wstep is-active${direction < 0 ? ' is-back' : ''}`}
            aria-label={stepTitles[step] || 'Your card is ready'}
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
