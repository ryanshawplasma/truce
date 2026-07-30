'use client';

import { useState, useTransition } from 'react';
import { deleteCard } from '@/app/actions';
import { copyText } from '@/app/components/ui';

/** Copy-to-clipboard row for the recipient's link. */
export function CopyLink({ url }) {
  const [state, setState] = useState('');

  return (
    <>
      <div className="linkbox">
        <input
          type="text"
          readOnly
          value={url}
          aria-label="Your card link"
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={async () => {
            const ok = await copyText(url);
            setState(ok ? 'Copied 🤍' : 'Select the link and copy it manually.');
            setTimeout(() => setState(''), 2600);
          }}
        >
          Copy
        </button>
      </div>
      <p className="copy-state" role="status">
        {state}
      </p>
    </>
  );
}

/** Delete the card for good. Asks first. */
export function DeleteCardButton({ token, toName }) {
  const [pending, startTransition] = useTransition();

  const onDelete = () => {
    const sure = window.confirm(
      `Delete this card for ${toName}?\n\nThe link will stop working immediately and any reactions will be removed. This cannot be undone.`,
    );
    if (!sure) return;
    startTransition(async () => {
      await deleteCard(token);
    });
  };

  return (
    <button type="button" className="btn btn--danger" onClick={onDelete} disabled={pending}>
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" style={{ borderTopColor: '#C22B45' }} /> Deleting…
        </>
      ) : (
        'Delete this card'
      )}
    </button>
  );
}
