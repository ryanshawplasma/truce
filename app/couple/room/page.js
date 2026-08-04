import { redirect } from 'next/navigation';
import CoupleRoom from './CoupleRoom';
import { getSessionState } from '@/lib/couple-session';
import { attachMediaUrls, listMessages } from '@/lib/couple';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * /couple/room — the chat.
 *
 * The session lives in an httpOnly cookie, so the first paint can already carry
 * the last 200 messages; the client component takes over from there and polls
 * for anything newer.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Our corner — Truce',
  description: 'Your private space for two.',
  robots: { index: false, follow: false },
};

export default async function CoupleRoomPage({ searchParams }) {
  if (!isSupabaseConfigured()) redirect('/couple');

  const params = (await searchParams) || {};
  /* Set by enterRoom() immediately after a successful create or join. */
  const justSignedIn = params.new === '1';

  const { session, failed } = await getSessionState();

  if (!session) {
    /* Landing here with no session right after signing in means the corner was
       made but the sign-in did not stick — a cookie the browser refused, or a
       database read that failed a second later. Either way the person needs a
       sentence, not a silent bounce back to an empty form. */
    if (justSignedIn) redirect(`/couple?err=${failed ? 'lookup' : 'cookie'}`);
    redirect('/couple');
  }

  /* Sign the photos before the first paint. Polling signs what it fetches, but
     the rows that arrive with the HTML are the ones nobody polls for — without
     this the room came back from a reload full of "photo unavailable" tiles
     until something newer happened to arrive. */
  const messages = await attachMediaUrls(await listMessages(session.room.id, 0));

  return (
    <CoupleRoom
      room={{ name: session.room.name, anniversary: session.room.anniversary }}
      side={session.side}
      initialMessages={messages}
    />
  );
}
