alter table public.live_member_activity
  drop constraint if exists live_member_activity_activity_type_check;

alter table public.live_member_activity
  add constraint live_member_activity_activity_type_check
  check (activity_type = any (array[
    'join'::text,
    'leave'::text,
    'reaction'::text,
    'chat'::text,
    'tip'::text,
    'vip'::text,
    'follow'::text,
    'share'::text,
    'purchase'::text,
    'end'::text
  ]));
