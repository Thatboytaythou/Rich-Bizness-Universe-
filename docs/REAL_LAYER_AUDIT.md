# Rich Bizness Real Layer Audit

This audit tracks old fake/demo layers, blockers, and conflict points that must be removed or merged into real schema-driven logic.

## Fixed in this pass

### 1. Shared section runtime was still a diagnostic layer

Old behavior:

- Rendered table counts as visible content.
- Filled pages with generic cards from whatever primary table existed.
- Used labels like `Schema Sync`, `PRIMARY`, and `TABLES`.

Fix:

- `src/section-runtime.js` now renders real Supabase records or real empty states.
- The side panel is now `Next Action` / `Live State` / `Empty State` instead of schema/debug output.
- No demo records are injected.

### 2. Passive XP was fake progress

Old behavior:

- `src/rb-xp-boot.js` awarded XP for simply opening pages.
- This duplicated real XP earned by live watching, game moves, uploads, scores, etc.

Fix:

- `src/rb-xp-boot.js` now calls `bootXp(null)`.
- XP is display/sync only on page load.
- XP must be earned by action handlers such as game moves, score submit, live watch, upload drop, etc.

### 3. Section CSS still allowed old shell wording to show visually

Fix:

- `src/section-page.css` now styles the real-state runtime and neutralizes old shell/debug labels.

## Still needs page-by-page cleanup

The following pages have old shell HTML with wording such as `SYNC`, `PRIMARY`, `TABLES`, or section-specific `Sync` headings. The runtime now overwrites/hides most of it, but each page should be rewritten to remove those words from the HTML source when safe:

- `messages.html`
- `store.html`
- `gaming.html`
- `music.html`
- `podcast.html`
- `radio.html`
- `sports.html`
- `gallery.html`
- `creator.html`
- `admin.html`
- `notifications.html`

## Rules going forward

- No fake data cards.
- No demo/sample/mock records in UI.
- Empty tables must show empty-state with the correct action.
- Homepage remains a portal gateway, not a fake dashboard.
- XP only from real actions, not page visits.
- One schema map: `src/rb-schema-map.js`.
- One personality layer: `public.rb_personality_settings` plus `src/rb-personality.js`.
- One identity chain: `auth.users -> profiles -> meta_avatars -> profile/index/avatar UI`.

## Known blockers to keep watching

- Some full-file HTML rewrites have been blocked by the connector, so smaller safe patches may be required.
- Supabase table introspection sometimes gets blocked; prefer targeted SQL checks.
- Vercel project checks sometimes get blocked; runtime route checks may still work.
