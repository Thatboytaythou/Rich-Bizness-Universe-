export const RB_DOMAINS = Object.freeze({
  canonicalHost: 'rich-bizness.com',
  canonicalUrl: 'https://rich-bizness.com',
  approvedHosts: [
    'rich-bizness.com',
    'www.rich-bizness.com',
    'rich-bizness-mobile-app.vercel.app'
  ],
  approvedUrls: [
    'https://rich-bizness.com',
    'https://www.rich-bizness.com',
    'https://rich-bizness-mobile-app.vercel.app'
  ]
});

export function isApprovedHost(hostname = location.hostname) {
  return RB_DOMAINS.approvedHosts.includes(hostname);
}

export function canonicalUrl(pathname = location.pathname, search = location.search, hash = location.hash) {
  return `${RB_DOMAINS.canonicalUrl}${pathname}${search}${hash}`;
}
