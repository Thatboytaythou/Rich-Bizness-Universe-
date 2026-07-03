export default function handler(req, res) {
  const xp = Number(req.query?.xp || 0);
  const cents = Math.max(0, Math.floor(xp));
  res.status(200).json({ ok: true, xp, cents, dollars: `$${(cents / 100).toFixed(2)}` });
}
