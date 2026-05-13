create unique index if not exists campaign_pages_published_slug_unique_idx
on public.campaign_pages(slug)
where is_published = true;
