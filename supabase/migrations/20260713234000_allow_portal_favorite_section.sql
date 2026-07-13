alter table public.profiles drop constraint if exists profiles_favorite_section_check;

alter table public.profiles
  add constraint profiles_favorite_section_check
  check (
    favorite_section is null
    or favorite_section = any (
      array[
        'portal',
        'feed',
        'live',
        'watch',
        'music',
        'podcast',
        'radio',
        'store',
        'gaming',
        'sports',
        'gallery',
        'meta',
        'profile'
      ]::text[]
    )
  );
