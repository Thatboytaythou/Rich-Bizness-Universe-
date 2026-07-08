import createStream from './live-stream-create.js';
import endStream from './live-stream-end.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST required' });
  const body = req.body || {};
  if (String(body.action || 'start') === 'end') return endStream(req, res);
  return createStream(req, res);
}
