// Compatibility bridge only.
// The app shell, dock, auth guard, section data, and page layout are owned by section-runtime.js.
// This file must not create panels, docks, overlays, auth flows, or duplicate Supabase subscriptions.
import './section-runtime.js?v=one-app-dock-1';
export {};
