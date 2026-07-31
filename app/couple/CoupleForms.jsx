'use client';

import { useRef, useState } from 'react';
import { createRoom, joinRoom } from './actions';

/**
 * The two doors: make a corner, or walk into one you already have.
 *
 * Both forms talk to server actions that do the real validation. The checks
 * here exist only to answer instantly — nothing decided in this file is
 * trusted by the server.
 */

/**
 * A server action that succeeds by redirecting throws a NEXT_REDIRECT signal.
 * If a catch block eats it, the navigation never happens and a corner that was
 * created perfectly well looks like a failure. So: rethrow it, always.
 */
function rethrowIfRedirect(err) {
  const digest = err && typeof err.digest === 'string' ? err.digest : '';
  if (digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND') throw err;
}

const SIDES = [
  /* Both sides see their OWN messages on the right — the number only tells the
     two of you apart, so the hints have to say that rather than describing an
     alignment that is identical either way. */
  { value: 1, label: 'I am the first one', hint: 'pick this if you set the corner up' },
  { value: 2, label: 'I am the second one', hint: 'pick this if they set it up' },
];

export default function CoupleForms({ initialError = '' }) {
  const [mode, setMode] = useState(initialError ? 'join' : 'join'); // join | create

  return (
    <div className="panel">
      <div className="corner-tabs" role="tablist" aria-label="Our corner">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'join'}
          className={`corner-tab${mode === 'join' ? ' is-on' : ''}`}
          onClick={() => setMode('join')}
        >
          Enter your corner
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'create'}
          className={`corner-tab${mode === 'create' ? ' is-on' : ''}`}
          onClick={() => setMode('create')}
        >
          Create your corner
        </button>
      </div>

      {mode === 'join' ? <JoinForm initialError={initialError} /> : <CreateForm />}
    </div>
  );
}

/** Shared bits: the name field, the password field and the side picker. */
function SidePicker({ side, onChange }) {
  return (
    <div className="field">
      <span className="corner-legend">Which one are you?</span>
      <div className="corner-sides" role="radiogroup" aria-label="Which one are you?">
        {SIDES.map((s) => (
          <button
            type="button"
            key={s.value}
            role="radio"
            aria-checked={side === s.value}
            className={`corner-side${side === s.value ? ' is-on' : ''}`}
            onClick={() => onChange(s.value)}
          >
            <b>{s.label}</b>
            <small>{s.hint}</small>
          </button>
        ))}
      </div>
      <p className="hint">Just so the bubbles land on the right sides. Pick the same one each time.</p>
    </div>
  );
}

function JoinForm({ initialError = '' }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [side, setSide] = useState(1);
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      /* On success the action redirects us into the room and never returns a
         value — so the only thing that comes back here is a refusal. */
      const res = await joinRoom({ name: name.trim(), password, side });
      if (res && !res.ok) setError(res.error || 'That did not work.');
    } catch (err) {
      rethrowIfRedirect(err);
      setError('Could not reach the server. Try again in a moment.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="corner-form">
      <h2>Enter your corner</h2>
      <p className="panel__sub">The name and password you both agreed on.</p>

      <div className="field">
        <label htmlFor="joinName">Corner name</label>
        <input
          className="input"
          id="joinName"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={32}
          placeholder="e.g. rainy-tuesday"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="joinPass">Password</label>
        <input
          className="input"
          id="joinPass"
          type="password"
          autoComplete="current-password"
          maxLength={200}
          placeholder="the one you both know"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <SidePicker side={side} onChange={setSide} />

      <p className="err" role="alert" aria-live="polite">{error}</p>
      <button type="submit" className="btn btn--primary btn--wide btn--lg" disabled={busy}>
        {busy ? (
          <>
            <span className="spinner" aria-hidden="true" /> Opening…
          </>
        ) : (
          'Open our corner 💙'
        )}
      </button>
    </form>
  );
}

function CreateForm() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [anniversary, setAnniversary] = useState('');
  const [side, setSide] = useState(1);
  const [error, setError] = useState('');
  const [badField, setBadField] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setBadField('');
    try {
      /* Same as joining: success redirects, so anything returned is a refusal.

         `anniversary` is optional, and an empty date input hands us ''. Postgres
         will not take '' for a `date` column — it refuses the whole insert — so
         it becomes null here as well as on the server. Belt and braces on
         purpose: this exact value is what broke card-corner creation in
         production while every local test passed. */
      const res = await createRoom({
        name: name.trim(),
        password,
        anniversary: anniversary && anniversary.trim() ? anniversary.trim() : null,
        side,
      });
      if (res && !res.ok) {
        setError(res.error || 'That did not work.');
        setBadField(res.field || '');
      }
    } catch (err) {
      rethrowIfRedirect(err);
      setError('Could not reach the server. Try again in a moment.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="corner-form">
      <h2>Create your corner</h2>
      <p className="panel__sub">
        Then tell the other person the name and the password. That is the whole setup.
      </p>

      <div className="field">
        <label htmlFor="newName">Corner name</label>
        <input
          className={`input${badField === 'name' ? ' is-invalid' : ''}`}
          id="newName"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={32}
          placeholder="e.g. rainy-tuesday"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="hint">3–32 letters, numbers or dashes. Make it something only you two would guess.</p>
      </div>

      <div className="field">
        <label htmlFor="newPass">Password</label>
        <input
          className={`input${badField === 'password' ? ' is-invalid' : ''}`}
          id="newPass"
          type="password"
          autoComplete="new-password"
          maxLength={200}
          placeholder="at least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="hint">Please don&rsquo;t reuse a password that matters elsewhere.</p>
      </div>

      <div className="field">
        <label htmlFor="newAnn">
          Together since <span style={{ fontWeight: 600, color: 'var(--plum-soft)' }}>(optional)</span>
        </label>
        <input
          className={`input${badField === 'anniversary' ? ' is-invalid' : ''}`}
          id="newAnn"
          type="date"
          value={anniversary}
          onChange={(e) => setAnniversary(e.target.value)}
        />
        <p className="hint">If you add it, your corner counts the days at the top.</p>
      </div>

      <SidePicker side={side} onChange={setSide} />

      <p className="err" role="alert" aria-live="polite">{error}</p>
      <button type="submit" className="btn btn--primary btn--wide btn--lg" disabled={busy}>
        {busy ? (
          <>
            <span className="spinner" aria-hidden="true" /> Making it…
          </>
        ) : (
          'Make our corner 💙'
        )}
      </button>
    </form>
  );
}
