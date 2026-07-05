export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    app: 'Rich Bizness Universe',
    language: 'They’re here Rich',
    live: 'WE LIT🔥',
    room: 'Bizness Party',
    status: 'Get Right',
    domains: ['rich-bizness.com', 'www.rich-bizness.com', 'rich-bizness-mobile-app.vercel.app'],
    xp: 'realtime'
  });
}
