# Rich Bizness Security Hardening Status

## Applied live in Supabase

- Enabled RLS on `public.rb_personality_settings`.
- Added public read policy for active personality settings only.
- Added admin-only full policy for personality settings.
- Dropped and recreated `public.active_brand_assets` view.
- Set `public.active_brand_assets` to `security_invoker`.
- Hardened search path on:
  - `public.handle_updated_at()`
  - `public.rb_rank_for_level(integer)`
- Revoked anon execute from exposed SECURITY DEFINER functions:
  - `handle_new_user()`
  - `rb_apply_personality_to_dm_thread()`
  - `rb_apply_personality_to_live_stream()`
  - `rb_apply_personality_to_profile()`
  - `rb_award_xp(text,text,text,uuid,integer)`
  - `rb_is_admin(integer)`
  - `rb_is_dm_thread_member(uuid)`
  - `rb_personality(text)`
  - `rb_sync_meta_avatar_to_profile()`
  - `save_meta_avatar(text,text,text,text,text,text,text,integer,integer,jsonb)`

## Still in progress / blocked by connector safety checks

- Followers insert/delete owner policies.
- Replacing frontend `rb_personality` RPC usage with direct RLS table reads.
- Several permissive game/live/music/radio/product analytics insert policies need more column-specific tightening.
- Public bucket listing policies need a storage-object policy pass.
- Leaked-password protection must be enabled in Supabase Auth settings/dashboard.
