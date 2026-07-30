import { redirect } from 'next/navigation';
import CoupleRoom from './CoupleRoom';
import { getSession } from '../actions';
import { listMessages } from '@/lib/couple';
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

export default async function CoupleRoomPage() {
  if (!isSupabaseConfigured()) redirect('/couple');

  const session = await getSession();
  if (!session) redirect('/couple');

  const messages = await listMessages(session.room.id, 0);

  return (
    <CoupleRoom
      room={{ name: session.room.name, anniversary: session.room.anniversary }}
      side={session.side}
      initialMessages={messages}
    />
  );
}
