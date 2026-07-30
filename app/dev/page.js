import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import Link from 'next/link';
import BrandMark from '@/app/components/BrandMark';
import { getAdminStats } from '@/lib/cards';
import { isSupabaseConfigured } from '@/lib/supabase';
import { relativeTime, absoluteTime } from '@/lib/format';
import { OCCASION_IDS, getOccasion } from '@/lib/occasions';

/**
 * /dev — a tiny private dashboard for whoever runs this deployment.
 *
 * Locked behind ?key=<ADMIN_SECRET>. It is deliberately dumb: no login, no
 * cookies, no session — just an environment variable you keep to yourself.
 *
 * PRIVACY: this page shows counts and card ids only. It never selects or
 * renders message text, names, promises or memories — see getAdminStats in
 * lib/cards.js. Somebody with the key can see how the product is doing, not
 * what anybody wrote.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Truce stats',
  description: 'Private deployment stats.',
  robots: { index: false, follow: false },
};

/**
 * Compare the supplied key against ADMIN_SECRET without leaking anything.
 *
 * The previous version returned early when the lengths differed, which is a
 * length oracle: an attacker can find the secret's length by timing, then only
 * guess strings of that length. HMAC-ing both sides first fixes it properly —
 * both digests are always 32 bytes, so timingSafeEqual is fed equal-length
 * buffers no matter what was typed, and the comparison time carries no
 * information about the secret at all.
 *
 * TRADEOFF, kept deliberately: the key travels in the query string, so it can
 * land in browser history, a proxy log or a Referer header. That is the price of
 * a dashboard with no login on it, and it is the right trade for a private stats
 * page whose worst case is "someone sees counts" (never card contents — see the
 * privacy note above). Rotate ADMIN_SECRET if a URL leaks. Noted in the README.
 */
function secretMatches(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  if (!expected) return false;
  /* A random per-process key: the digests cannot be precomputed or compared
     against anything outside this request. */
  const pepper = randomBytes(32);
  const a = createHmac('sha256', pepper).update(provided).digest();
  const b = createHmac('sha256', pepper).update(expected).digest();
  return timingSafeEqual(a, b);
}

function Shell({ children }) {
  return (
    <div className="devpage">
      <header className="nav is-stuck">
        <div className="wrap nav__inner">
          <Link className="brand" href="/" aria-label="Truce home">
            <BrandMark />
            <span>Truce</span>
          </Link>
          <Link className="btn btn--ghost btn--sm nav__cta" href="/">
            Back to site
          </Link>
        </div>
      </header>
      <main className="devpage__main">{children}</main>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="stat">
      <b>{value === null || value === undefined ? '—' : value}</b>
      <span>{label}</span>
    </div>
  );
}

export default async function DevPage({ searchParams }) {
  const params = await searchParams;
  const key = typeof params?.key === 'string' ? params.key : '';
  const secret = process.env.ADMIN_SECRET || '';

  /* ---------------------------------------------------------- no secret set */
  if (!secret) {
    return (
      <Shell>
        <span className="dev-flag">🔧 Setup needed</span>
        <div className="panel">
          <h2>This page is switched off</h2>
          <p className="panel__sub">
            The stats page only opens when you have chosen a secret key for it. Nobody can reach it until you do — which
            is exactly what you want on a public site.
          </p>

          <h3 style={{ fontSize: '1.05rem', marginTop: 22 }}>Turn it on in three steps</h3>
          <ol className="dev-steps">
            <li>
              Make up a long random password. Anything hard to guess works — for example{' '}
              <code>truce-9fJ2xQ-stats</code>.
            </li>
            <li>
              Add it as an environment variable called <code>ADMIN_SECRET</code>.
              <span className="codeblock">ADMIN_SECRET=your-long-random-password</span>
              Locally that goes in <code>.env.local</code>. On Vercel: Project → Settings → Environment Variables → Add,
              then redeploy.
            </li>
            <li>
              Visit this page with the key on the end of the address:
              <span className="codeblock">/dev?key=your-long-random-password</span>
            </li>
          </ol>

          <p className="panel__sub" style={{ marginTop: 18, marginBottom: 0 }}>
            Keep that link to yourself — it is the only lock on this page.
          </p>
        </div>
      </Shell>
    );
  }

  /* ------------------------------------------------------------- wrong key */
  if (!secretMatches(key, secret)) {
    return (
      <Shell>
        <div className="panel" style={{ textAlign: 'center' }}>
          <div className="oops__emoji" aria-hidden="true">
            🔎
          </div>
          <h2>Nothing to see here</h2>
          <p className="panel__sub">
            This page needs a key on the end of the address, and that one did not match. If it is your deployment, check
            the <code>ADMIN_SECRET</code> value in your environment variables.
          </p>
          <div className="oops__actions">
            <Link className="btn btn--primary btn--lg" href="/">
              Back to Truce
            </Link>
            <Link className="btn btn--ghost btn--lg" href="/c/demo">
              See a sample card
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  /* --------------------------------------------------------------- no db */
  const stats = await getAdminStats();

  if (!stats) {
    return (
      <Shell>
        <span className="dev-flag">🔒 Private — stats</span>
        <div className="panel">
          <h2>No database connected yet</h2>
          <p className="panel__sub">
            {isSupabaseConfigured()
              ? 'Supabase is configured but the stats queries could not run. Check that supabase/schema.sql has been applied to your project.'
              : 'Truce is running in no-setup mode, so cards travel inside their own links and nothing is stored. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see the README) and the numbers will appear here.'}
          </p>
          <div className="oops__actions" style={{ justifyContent: 'flex-start' }}>
            <Link className="btn btn--ghost btn--sm" href="/">
              Back to site
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const openRate = stats.cards ? Math.round(((stats.opened || 0) / stats.cards) * 100) : 0;

  return (
    <Shell>
      <span className="dev-flag">🔒 Private — stats</span>

      <div className="panel">
        <h2>How Truce is doing</h2>
        <p className="panel__sub">
          Counts only — card contents are never read by this page.
          {stats.partial ? ' Some numbers could not be loaded, so treat them as approximate.' : ''}
        </p>
        <div className="stat-grid">
          <Stat value={stats.cards} label="Cards" />
          <Stat value={stats.opened} label="Opened" />
          <Stat value={stats.forgiven} label="Forgiven" />
          <Stat value={stats.reactions} label="Reactions" />
          <Stat value={stats.lastWeek} label="Last 7 days" />
        </div>
        <p className="panel__sub" style={{ marginTop: 16, marginBottom: 0 }}>
          {stats.cards
            ? `${openRate}% of cards have been opened.`
            : 'No cards yet — make one and it will show up here.'}
        </p>
      </div>

      <div className="panel">
        <h2>By occasion</h2>
        <p className="panel__sub">Which kinds of card people are actually making.</p>
        <div className="stat-grid">
          {OCCASION_IDS.map((id) => {
            const occasion = getOccasion(id);
            return (
              <Stat
                key={id}
                value={(stats.occasionCounts || {})[id]}
                label={`${occasion.badge} ${occasion.label}`}
              />
            );
          })}
        </div>
      </div>

      <div className="panel">
        <h2>Ten most recent cards</h2>
        <p className="panel__sub">Ids only. Open one at /c/&lt;id&gt; if you need to check on it.</p>

        {stats.recent.length ? (
          <div className="dev-table__scroll">
            <table className="dev-table">
              <thead>
                <tr>
                  <th scope="col">Id</th>
                  <th scope="col">Occasion</th>
                  <th scope="col">Created</th>
                  <th scope="col">Opened</th>
                  <th scope="col">Forgiven</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <code>{row.id}</code>
                    </td>
                    <td>{row.occasion || 'sorry'}</td>
                    <td title={absoluteTime(row.created_at)}>{relativeTime(row.created_at)}</td>
                    <td>{row.opened_at ? `👀 ${relativeTime(row.opened_at)}` : '—'}</td>
                    <td>{row.forgiven_at ? `🎉 ${relativeTime(row.forgiven_at)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">No cards have been created on this deployment yet. 🤍</p>
        )}
      </div>
    </Shell>
  );
}
