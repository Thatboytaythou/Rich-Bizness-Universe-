delete from public.game_runtime_manifests m
using public.games g
where m.game_id = g.id
  and g.slug = 'avatar-free-roam'
  and m.is_active = false
  and m.version in ('0.1.0','0.2.0')
  and m.entry_module = '/games/avatar-free-roam/game.ts';
