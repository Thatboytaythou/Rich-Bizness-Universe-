# Rich Bizness Canonical Application Flow

The active application is the Vite monorepo rooted at `apps/web`.

## Single owners

- Build and page inputs: `vite.config.ts`
- Hosting routes and redirects: `vercel.json`
- Browser startup: `apps/web/src/main.ts`
- Page registration and auth mode: `apps/web/src/route-loader.ts`
- Page mounting: page modules returned by the route registry
- Public runtime configuration: `packages/config`
- Database access: `packages/database`

## Page auth modes

- `public`: no session initialization required before mounting
- `optional`: initialize session state, but allow signed-out rendering
- `required`: initialize session state before mounting

No page should be imported or mounted directly from `bootstrap.ts`. New pages must be registered once in `route-loader.ts` and added to the Vite input map and Vercel route map when applicable.

## Cleanup rule

A file, table, view, route, or fallback may only be removed after every reference has been migrated to its canonical owner and production validation passes.
