create unique index if not exists game_room_members_room_user_unique on public.game_room_members(room_id,user_id) where user_id is not null;
create index if not exists game_scores_game_score_created_idx on public.game_scores(game_id,score desc,created_at desc);
create index if not exists game_comments_game_created_idx on public.game_comments(game_id,created_at desc) where clip_id is null;
create index if not exists game_rooms_game_status_updated_idx on public.game_rooms(game_key,status,updated_at desc);
create index if not exists game_room_members_room_status_joined_idx on public.game_room_members(room_id,status,joined_at);
create index if not exists game_challenges_game_status_created_idx on public.game_challenges(game_id,status,created_at desc);
create index if not exists game_tournaments_game_status_start_idx on public.game_tournaments(game_id,status,starts_at);
insert into public.system_health_checks(service,status,message,metadata) values ('gaming-runtime','ok','Step 24 gaming interaction hardening applied',jsonb_build_object('room_member_uniqueness',true,'shared_runtime',true,'route_count',24));