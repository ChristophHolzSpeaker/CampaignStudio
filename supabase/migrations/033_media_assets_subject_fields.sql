alter table media_assets
add column if not exists subject_position jsonb,
add column if not exists subject_facing text;
