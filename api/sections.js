const sections = ['feed','upload','search','live','watch','music','podcast','radio','gaming','games','sports','gallery','store','meta','messages','notifications','profile','avatar','avatar-characters','creator','admin','edit','settings','rb-secret'];

export default function handler(req, res) {
  res.status(200).json({ ok: true, sections });
}
