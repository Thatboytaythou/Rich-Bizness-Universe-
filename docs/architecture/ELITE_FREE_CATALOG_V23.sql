insert into public.avatar_items(item_key,item_type,title,rarity,config,is_active)
values
('rb-elite-emerald-legacy','outfit','Emerald Legacy','rare','{"collection":"emerald-legacy","release":"elite-v23","claim":"free"}',true),
('rb-elite-onyx-executive','outfit','Onyx Executive','rare','{"collection":"onyx-executive","release":"elite-v23","claim":"free"}',true),
('rb-elite-omni-phantom','outfit','Omni Phantom','rare','{"collection":"omni-phantom","release":"elite-v23","claim":"free"}',true),
('rb-elite-heritage-crown','outfit','Heritage Crown','rare','{"collection":"heritage-crown","release":"elite-v23","claim":"free"}',true),
('rb-elite-midnight-motion','outfit','Midnight Motion','rare','{"collection":"midnight-motion","release":"elite-v23","claim":"free"}',true)
on conflict(item_key) do nothing;