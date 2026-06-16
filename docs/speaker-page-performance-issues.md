# Speaker Page Performance Issues

## 1. Client-side speaker visit logging

- **Type:** AFK
- **Blocked by:** None
- **User stories covered:** 4, 5, 9, 10, 11, 12

### What to build

Move public speaker page-view logging off the server load path and into a browser-triggered remote command that runs after the page shell paints. The browser should generate and retain a visitor identifier client-side so the existing 30-minute dedupe window still works without a server cookie.

### Acceptance criteria

- [ ] The public speaker route no longer waits on visit logging before sending HTML.
- [ ] Page-view logging still writes to `campaign_visits` with the expected attribution fields.
- [ ] Repeat views from the same browser within the dedupe window are not double-counted.
- [ ] The route no longer requires a server-issued visitor cookie.

## 2. Deferred booking slot loading

- **Type:** AFK
- **Blocked by:** None
- **User stories covered:** 1, 2, 3, 8

### What to build

Render the speaker page shell immediately, then fetch booking slot preview data after paint. Show a lightweight loading state or empty placeholder until the slots arrive, without blocking the rest of the public page.

### Acceptance criteria

- [ ] The speaker page shell renders before booking data is available.
- [ ] Booking slot data is fetched separately from the initial route response.
- [ ] The page shows a stable loading state while booking data is pending.
- [ ] Booking availability still renders correctly once the deferred fetch resolves.

## 3. Cacheable public speaker shell

- **Type:** AFK
- **Blocked by:** 1, 2
- **User stories covered:** 1, 6, 7, 14, 15

### What to build

Keep the public speaker route focused on immutable published page content and SEO metadata so the response is cache-friendly on Vercel. Once analytics and booking availability are no longer on the critical path, the shell should be eligible for much better CDN/edge caching behavior.

### Acceptance criteria

- [ ] The public route SSR path only includes the content required for the shell and metadata.
- [ ] Booking and analytics no longer personalize the HTML response.
- [ ] The public route remains based on published campaign content.
- [ ] The implementation preserves JSON-LD and SEO output in the initial response.
