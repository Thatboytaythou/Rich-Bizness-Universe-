const sections = ['feed','upload','live','watch','music','podcast','radio','gaming','sports','gallery','store','meta','messages','notifications','profile','avatar','edit','settings'];
export default function handler(req, res) {
  res.status(200).json({ ok: true, sections });
}
