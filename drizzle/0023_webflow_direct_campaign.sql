-- Sentinel campaign for direct Webflow lead form submissions (no campaign context)
-- Ensure idempotency: remove any previous version then insert fresh
delete from campaigns where name = 'Webflow Direct';

insert into campaigns (name, audience, format, topic, language, geography, status, created_at, updated_at)
values (
  'Webflow Direct',
  'Webflow visitors',
  'Direct lead form',
  'Speaking engagement inquiry',
  'en',
  'Global',
  'active',
  now(),
  now()
);
