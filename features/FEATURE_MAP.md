# Feature Ownership Map

Home owns homepage portal, signed-in state, and platform health.
Profile owns user empire, public profile views, stats, access, badges, and themes.
Messages owns Rich-DM threads, messages, reads, reactions, typing, calls, and attachments.
Live Watch owns live rooms, watch rooms, chat, reactions, tips, members, VIP access, and view sessions.
Store owns products, cart, orders, comments, likes, views, and seller notifications.
Meta owns worlds, rooms, portals, chat, inventory, visits, and avatar position.
Media owns music, podcast, radio playback, likes, comments, sessions, shows, and playlists.
Sports owns posts, uploads, picks, comments, reactions, teams, leagues, brackets, and broadcasts.
Notifications owns rich alerts, read receipts, groups, and push devices.

Frontend rule: root HTML files are route shells. Feature logic belongs in feature owner modules, not inline route logic.

Asset rule: image choices must come from the image manifest or real files under /images. Do not guess hero art.
