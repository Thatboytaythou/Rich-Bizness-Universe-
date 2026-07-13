# Rich Bizness Universe — Architecture Lock

This rebuild starts from the repository's first commit.

## One app, one owner per concern

- `index.html` is the single homepage markup owner.
- `src/styles.css` is the single homepage visual owner.
- `src/main.js` is the single homepage runtime owner.
- `src/config.js` is the single routes/tables/buckets source of truth.
- `src/supabase-client.js` is the only browser Supabase client.

## Rebuild rules

1. Existing files are extended in place; replacement shells are not stacked on top.
2. No duplicate routers, page owners, global rewrite layers, or runtime wrappers.
3. A page may load one page module plus shared modules only.
4. Realtime subscriptions are scoped to the current page and cleaned up on exit.
5. Supabase schema changes require a named migration; frontend code does not invent table names.
6. The homepage stays on the original Rich Bizness Universe/Omni Portal direction.
7. New features are added section by section and verified before the next section begins.
