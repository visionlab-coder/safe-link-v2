// pages/api/travel/translate.js
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

  const { text, from, to, room } = req.body;
  if (!text || !from || !to || !room) return res.status(400).json({ error: 'Missing fields' });

  try {
    // Google Translate API
    const url = `https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_TRANSLATE_API_KEY}`;
    const gRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: from, target: to, format: 'text' }),
    });
    const gData = await gRes.json();
    const translated = gData.data.translations[0].translatedText;

    const message = {
      id:         Date.now(),
      original:   text,
      translated,
      lang:       from,
      time:       new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    };

    // Pusher로 상대방에게 전송
    await pusherServer.trigger(`travel-${room}`, 'new-message', message);

    return res.json({ translated, message });
  } catch (err) {
    console.error('[translate]', err);
    return res.status(500).json({ error: 'Translation failed' });
  }
}
