create unique index if not exists sports_reactions_post_user_unique on public.sports_reactions(post_id,user_id) where post_id is not null;
create unique index if not exists sports_alert_subscriptions_user_team_unique on public.sports_alert_subscriptions(user_id,team_name) where team_name is not null;
create index if not exists sports_posts_sport_featured_created_idx on public.sports_posts(sport,is_featured desc,created_at desc);
create index if not exists sports_comments_post_created_idx on public.sports_comments(post_id,created_at desc);
create index if not exists sports_broadcasts_status_schedule_idx on public.sports_broadcasts(status,scheduled_for,created_at desc);
create index if not exists sports_brackets_status_created_idx on public.sports_brackets(status,created_at desc);
create index if not exists sports_picks_user_created_idx on public.sports_picks(user_id,created_at desc);
insert into public.system_health_checks(service,status,message,metadata) values ('sports-interactions','ok','Step 25 Sports interaction states and realtime indexes active',jsonb_build_object('step',25,'owner','sports'));