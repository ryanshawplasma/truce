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

const SIDES = [
  { value: 1, label: 'I am the first one', hint: 'my messages sit on the right' },
  { value: 2, label: 'I am the second one', hint: 'my messages sit on the right' },
];

export default function CoupleForms() {
  const [mode, setMode] = useState('join'); // join | create

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

      {mode === 'join' ? <JoinForm /> : <CreateForm />}
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

function JoinForm() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [side, setSide] = useState(1);
  const [error, setError] = useState('');
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
      const res = await joinRoom({ name, password, side });
      if (res && !res.ok) setError(res.error || 'That did not work.');
    } catch {
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

      <p className="err">{error}</p>
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
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      /* Same as joining: success redirects, so anything returned is a refusal. */
      const res = await createRoom({ name, password, anniversary, side });
      if (res && !res.ok) setError(res.error || 'That did not work.');
    } catch {
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
          className="input"
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
          className="input"
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
          className="input"
          id="newAnn"
          type="date"
          value={anniversary}
          onChange={(e) => setAnniversary(e.target.value)}
        />
        <p className="hint">If you add it, your corner counts the days at the top.</p>
      </div>

      <SidePicker side={side} onChange={setSide} />

      <p className="err">{error}</p>
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
