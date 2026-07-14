update public.brand_assets
set public_path = '/images/brand/portal-universe-bg.svg',
    title = 'Portal Universe Background',
    asset_type = 'image',
    section = 'portal',
    is_default = true,
    is_active = true,
    updated_at = now()
where asset_key = 'background_v2';

update public.background_presets
set background_url = '/images/brand/portal-universe-bg.svg',
    thumbnail_url = '/images/brand/portal-universe-bg.svg',
    updated_at = now()
where preset_key = 'smoke_cloud_green';
