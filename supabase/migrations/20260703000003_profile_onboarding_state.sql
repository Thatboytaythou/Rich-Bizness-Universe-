alter table public.profiles add column if not exists onboarding_state text not null default 'complete';
alter table public.profiles add column if not exists has_avatar boolean not null default false;
alter table public.profiles add column if not exists has_profile_identity boolean not null default true;
alter table public.profiles add column if not exists last_route text not null default '/';

update public.profiles
set has_avatar = coalesce(nullif(avatar_url,''),'') <> '',
    has_profile_identity = true,
    onboarding_state = case when coalesce(nullif(avatar_url,''),'') <> '' then 'complete' else 'needs_avatar' end
where onboarding_state is null or onboarding_state = 'complete';
