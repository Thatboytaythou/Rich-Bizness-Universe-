-- Rich Bizness Universe — complete Supabase schema map
-- Run with psql or the Supabase SQL editor. This is read-only.
-- It returns one JSON document containing schemas, relations, columns,
-- primary/foreign keys, indexes, policies, triggers, routines, enums,
-- publications, storage buckets, and migration history.

with relations as (
  select c.oid,
         n.nspname as schema_name,
         c.relname as relation_name,
         case c.relkind
           when 'r' then 'table'
           when 'p' then 'partitioned_table'
           when 'v' then 'view'
           when 'm' then 'materialized_view'
           when 'f' then 'foreign_table'
         end as relation_type,
         c.relrowsecurity as rls_enabled,
         c.relforcerowsecurity as rls_forced,
         obj_description(c.oid) as comment
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','auth','storage','realtime')
    and c.relkind in ('r','p','v','m','f')
),
columns as (
  select n.nspname as schema_name,
         c.relname as relation_name,
         a.attnum as ordinal_position,
         a.attname as column_name,
         pg_catalog.format_type(a.atttypid,a.atttypmod) as data_type,
         not a.attnotnull as is_nullable,
         pg_get_expr(ad.adbin,ad.adrelid) as default_value,
         col_description(c.oid,a.attnum) as comment
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
  where n.nspname in ('public','auth','storage','realtime')
    and c.relkind in ('r','p','v','m','f')
    and a.attnum > 0 and not a.attisdropped
),
constraints as (
  select n.nspname as schema_name,
         c.relname as relation_name,
         con.conname as constraint_name,
         case con.contype when 'p' then 'primary_key' when 'f' then 'foreign_key'
              when 'u' then 'unique' when 'c' then 'check' when 'x' then 'exclusion' end as constraint_type,
         pg_get_constraintdef(con.oid,true) as definition
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','auth','storage','realtime')
),
indexes as (
  select schemaname as schema_name, tablename as relation_name,
         indexname as index_name, indexdef as definition
  from pg_indexes
  where schemaname in ('public','auth','storage','realtime')
),
policies as (
  select schemaname as schema_name, tablename as relation_name,
         policyname as policy_name, permissive, roles, cmd,
         qual as using_expression, with_check as check_expression
  from pg_policies
  where schemaname in ('public','auth','storage','realtime')
),
triggers as (
  select event_object_schema as schema_name,
         event_object_table as relation_name,
         trigger_name,
         event_manipulation,
         action_timing,
         action_statement
  from information_schema.triggers
  where event_object_schema in ('public','auth','storage','realtime')
),
routines as (
  select n.nspname as schema_name,
         p.proname as routine_name,
         pg_get_function_identity_arguments(p.oid) as arguments,
         pg_get_function_result(p.oid) as return_type,
         p.prosecdef as security_definer,
         l.lanname as language
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname in ('public','auth','storage','realtime')
),
enums as (
  select n.nspname as schema_name, t.typname as enum_name,
         jsonb_agg(e.enumlabel order by e.enumsortorder) as values
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  join pg_enum e on e.enumtypid = t.oid
  where n.nspname in ('public','auth','storage','realtime')
  group by n.nspname,t.typname
),
publications as (
  select p.pubname as publication_name,
         n.nspname as schema_name,
         c.relname as relation_name
  from pg_publication p
  join pg_publication_rel pr on pr.prpubid = p.oid
  join pg_class c on c.oid = pr.prrelid
  join pg_namespace n on n.oid = c.relnamespace
),
buckets as (
  select id,name,public,file_size_limit,allowed_mime_types,created_at,updated_at
  from storage.buckets
),
migrations as (
  select version,name from supabase_migrations.schema_migrations order by version
)
select jsonb_build_object(
  'generated_at', now(),
  'project_ref', 'xfsrqomsiulswbalgknx',
  'relations', (select coalesce(jsonb_agg(to_jsonb(r) order by schema_name,relation_name),'[]'::jsonb) from relations r),
  'columns', (select coalesce(jsonb_agg(to_jsonb(c) order by schema_name,relation_name,ordinal_position),'[]'::jsonb) from columns c),
  'constraints', (select coalesce(jsonb_agg(to_jsonb(k) order by schema_name,relation_name,constraint_name),'[]'::jsonb) from constraints k),
  'indexes', (select coalesce(jsonb_agg(to_jsonb(i) order by schema_name,relation_name,index_name),'[]'::jsonb) from indexes i),
  'policies', (select coalesce(jsonb_agg(to_jsonb(p) order by schema_name,relation_name,policy_name),'[]'::jsonb) from policies p),
  'triggers', (select coalesce(jsonb_agg(to_jsonb(t) order by schema_name,relation_name,trigger_name),'[]'::jsonb) from triggers t),
  'routines', (select coalesce(jsonb_agg(to_jsonb(f) order by schema_name,routine_name),'[]'::jsonb) from routines f),
  'enums', (select coalesce(jsonb_agg(to_jsonb(e) order by schema_name,enum_name),'[]'::jsonb) from enums e),
  'realtime_publications', (select coalesce(jsonb_agg(to_jsonb(p) order by publication_name,schema_name,relation_name),'[]'::jsonb) from publications p),
  'storage_buckets', (select coalesce(jsonb_agg(to_jsonb(b) order by name),'[]'::jsonb) from buckets b),
  'migrations', (select coalesce(jsonb_agg(to_jsonb(m) order by version),'[]'::jsonb) from migrations m)
) as rich_bizness_supabase_schema_map;
