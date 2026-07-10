// pages/api/travel/join.js
import Pusher from 'pusher';

const pusherServer = new Pusher({
  appId:   process.env.PUSHER_APP_ID,
  key:     process.env.PUSHER_KEY,
  secret:  process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS:  true,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { room, lang } = req.body;
  if (!room || !lang) return res.status(400).json({ error: 'Missing fields' });

  try {
    await pusherServer.trigger(`travel-${room}`, 'partner-joined', { lang });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[join]', err);
    return res.status(500).json({ error: 'Join failed' });
  }
}
