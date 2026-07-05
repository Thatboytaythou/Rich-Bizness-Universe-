export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "POST required" });
  }

  const event = req.body || {};

  return res.status(200).json({
    ok: true,
    received: true,
    provider: "stripe",
    type: event.type || null,
    message: "They’re here Rich",
    app: "Rich Bizness Universe"
  });
}
