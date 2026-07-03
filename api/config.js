export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    app: 'Rich Bizness Universe',
    domains: ['rich-bizness.com', 'www.rich-bizness.com', 'rich-bizness-mobile-app.vercel.app'],
    xpToCents: 1
  });
}
