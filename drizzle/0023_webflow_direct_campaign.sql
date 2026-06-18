-- Sentinel campaign for direct Webflow lead form submissions (no campaign context)
insert into campaigns (name, slug, is_active, created_at, updated_at)
values ('Webflow Direct', 'webflow-direct', true, now(), now())
on conflict (slug) do nothing;
