create or replace function public.rb_portal_universe_snapshot()
returns jsonb
language sql
security definer
set search_path=public
as $$
with me as (select auth.uid() uid),
profile as (select to_jsonb(p.*) j from public.profiles p,me where p.id=me.uid),
level_row as (select to_jsonb(u.*) j from public.user_levels u,me where u.user_id=me.uid),
avatar as (select to_jsonb(a.*) j from public.meta_avatars a,me where a.user_id=me.uid),
theme as (select to_jsonb(t.*) j from public.profile_theme_settings t,me where t.user_id=me.uid),
unread_notice as (select count(*)::int c from public.rich_notifications n,me where n.user_id=me.uid and coalesce(n.is_read,false)=false),
unread_threads as (select count(*)::int c from public.dm_thread_members m join public.dm_threads t on t.id=m.thread_id join me on m.user_id=me.uid where m.status='active' and coalesce(t.is_archived,false)=false and (m.last_read_at is null or t.last_message_at>m.last_read_at)),
announcement as (select to_jsonb(a.*) j from public.platform_announcements a where a.is_active=true and (a.target_section in ('global','portal') or a.target_section is null) and (a.starts_at is null or a.starts_at<=now()) and (a.ends_at is null or a.ends_at>=now()) order by case a.priority when 'critical' then 4 when 'high' then 3 when 'normal' then 2 else 1 end desc,a.created_at desc limit 1),
background as (select to_jsonb(b.*) j from public.background_presets b where b.is_active=true order by b.is_premium desc,b.created_at desc limit 1),
layout as (select to_jsonb(l.*) j from public.layout_presets l where l.is_active=true and l.section in ('portal','global') order by l.is_premium desc,l.created_at desc limit 1)
select jsonb_build_object('profile',coalesce((select j from profile),'{}'::jsonb),'level',coalesce((select j from level_row),'{}'::jsonb),'avatar',coalesce((select j from avatar),'{}'::jsonb),'theme',coalesce((select j from theme),'{}'::jsonb),'unread_notifications',coalesce((select c from unread_notice),0),'unread_threads',coalesce((select c from unread_threads),0),'announcement',coalesce((select j from announcement),'{}'::jsonb),'background',coalesce((select j from background),'{}'::jsonb),'layout',coalesce((select j from layout),'{}'::jsonb));
$$;
revoke execute on function public.rb_portal_universe_snapshot() from public,anon;
grant execute on function public.rb_portal_universe_snapshot() to authenticated;