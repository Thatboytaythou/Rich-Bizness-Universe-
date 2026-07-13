# Rich Bizness Universe — Architecture Lock

This rebuild starts from the repository's first commit.

## One app, one owner per concern

- `index.html` is the single homepage markup owner.
- `src/styles.css` is the single homepage visual owner.
- `src/main.js` is the single homepage runtime owner.
- `src/config.js` is the single routes/tables/buckets source of truth.
- `src/supabase-client.js` is the only browser Supabase client.
- `.github/workflows/release-guard.yml` is the single release-validation owner.
- `scripts/validate-app.mjs` is the single static route/import integrity owner.
- `scripts/production-smoke.mjs` is the single production reachability owner.

## Rebuild rules

1. Existing files are extended in place; replacement shells are not stacked on top.
2. No duplicate routers, page owners, global rewrite layers, or runtime wrappers.
3. A page may load one page module plus shared modules only.
4. Realtime subscriptions are scoped to the current page and cleaned up on exit.
5. Supabase schema changes require a named migration; frontend code does not invent table names.
6. The homepage stays on the original Rich Bizness Universe/Omni Portal direction.
7. New features are added section by section and verified before the next section begins.
8. Pull requests must pass route/import validation and the production build before merge.
9. Every push to `main` runs the production route smoke suite after the Vercel deployment window.
10. Release failures are fixed in the owning file instead of adding another wrapper or fallback runtime.

## Release guard

The required local release command is:

```bash
npm run release:check
```

The release guard checks:

- missing local HTML, CSS, image, and module paths
- broken JavaScript imports
- routes registered in `src/config.js` without matching files
- pages loading too many module owners
- Vite production build failures
- production route reachability after pushes to `main`

GitHub branch protection should require the `Build and integrity` check before merging into `main`. The workflow provides the check; repository branch rules control whether bypass is allowed.
