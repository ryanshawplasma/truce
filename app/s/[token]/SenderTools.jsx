'use client';

import { useState, useTransition } from 'react';
import { deleteCard } from '@/app/actions';
import CopyRow from '@/app/components/CopyRow';
import { withTimeout } from '@/app/components/ui';

/** Copy-to-clipboard row for the recipient's link. */
export function CopyLink({ url }) {
  return <CopyRow url={url} ariaLabel="Your card link" />;
}

/** Delete the card for good. Asks first. */
export function DeleteCardButton({ token, toName }) {
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState('');

  const onDelete = () => {
    const sure = window.confirm(
      `Delete this card for ${toName}?\n\nThe link will stop working immediately and any reactions will be removed. This cannot be undone.`,
    );
    if (!sure) return;
    setProblem('');
    startTransition(async () => {
      /* On success this action redirects and this component unmounts, so the
         only way we get here is a refusal or a stall — say so either way rather
         than sitting on "Deleting…". */
      const res = await withTimeout(deleteCard(token), 12000, {
        ok: false,
        error: 'That took too long. Reload the page to see whether it went through.',
      });
      if (res && res.ok === false) setProblem(res.error || 'Could not delete that card.');
    });
  };

  return (
    <>
      <button type="button" className="btn btn--danger" onClick={onDelete} disabled={pending}>
        {pending ? (
          <>
            <span className="spinner" aria-hidden="true" style={{ borderTopColor: '#C22B45' }} /> Deleting…
          </>
        ) : (
          'Delete this card'
        )}
      </button>
      <p className="err" role="status">
        {problem}
      </p>
    </>
  );
}
