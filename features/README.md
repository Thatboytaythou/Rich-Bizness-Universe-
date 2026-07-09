# Rich Bizness Features

This folder owns app logic by product area. Route files should stay thin; feature folders own Supabase reads/writes, realtime channels, actions, and state.

## Rule

- `*.html` = route shell only.
- `/features/<feature>/index.js` = feature owner.
- `/features/<feature>/schema.md` = tables and columns the feature owns.
- `/features/<feature>/README.md` = behavior and boundaries.

## Active feature lanes

- `profile` = user empire, public profile views, stats, access, badges, themes.
- `messages` = Rich-DM threads, messages, reads, reactions, typing, calls, attachments.
- `live-watch` = live rooms, watch rooms, chat, reactions, tips, members, VIP access.
- `store` = products, cart, orders, comments, likes, views, seller notifications.
- `meta` = worlds, rooms, portals, chat, inventory, visits, avatar position.
- `media` = music, podcast, radio playback, likes, comments, sessions, playlists.
- `sports` = posts, uploads, picks, comments, reactions, teams, leagues, brackets.
- `notifications` = alerts, reads, groups, push devices.
- `home` = homepage portal, platform health, signed-in state.

## Why this exists

The app was getting hidden duplicate ownership from global CSS + inline route scripts + old owner files. This folder is the fix: each system gets one owner and one boundary.
