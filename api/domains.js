export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    canonical: 'https://rich-bizness.com',
    approved: ['rich-bizness.com', 'www.rich-bizness.com', 'rich-bizness-mobile-app.vercel.app']
  });
}
