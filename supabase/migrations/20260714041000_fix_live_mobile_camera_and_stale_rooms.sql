update public.live_streams
set status='ended', status_label='PARTY’S OVER', ended_at=coalesce(ended_at,now()), updated_at=now()
where status='live' and coalesce(last_activity_at,updated_at,started_at,created_at) < now() - interval '2 hours';

create or replace function public.rb_live_heartbeat(p_stream_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_stream public.live_streams%rowtype;
begin
  if v_uid is null then raise exception 'Tap in first.' using errcode='28000'; end if;
  update public.live_streams
  set last_activity_at=now(), updated_at=now(), status='live', status_label='WE LIT🔥'
  where id=p_stream_id and creator_id=v_uid and status='live'
  returning * into v_stream;
  if not found then raise exception 'That live room is not active or it is not yours.'; end if;
  return jsonb_build_object('ok',true,'stream_id',v_stream.id,'last_activity_at',v_stream.last_activity_at);
end;
$$;

grant execute on function public.rb_live_heartbeat(uuid) to authenticated;

create index if not exists live_streams_status_activity_idx
on public.live_streams(status,last_activity_at desc);