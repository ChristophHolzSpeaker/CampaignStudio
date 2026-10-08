import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import { GET } from './+server';

it('serves executable attribution code and does no work in preview', async () => {
	const response = await GET({} as Parameters<typeof GET>[0]);
	const source = await response.text();
	const fetch = vi.fn(async () => Response.json({ data: {} }));
	const addEventListener = vi.fn();
	const execute = (preview: boolean) =>
		runInNewContext(source, {
			document: {
				getElementById: () => ({ textContent: JSON.stringify({ campaignPageId: 287, preview }) }),
				querySelectorAll: () => [],
				addEventListener
			},
			fetch,
			AbortSignal,
			setTimeout,
			URL,
			Element: class {},
			HTMLAnchorElement: class {}
		});
	execute(true);
	expect(fetch).not.toHaveBeenCalled();
	expect(addEventListener).not.toHaveBeenCalled();
	execute(false);
	expect(fetch).toHaveBeenCalledWith(
		'/api/runtime/v1/email-reference',
		expect.objectContaining({ body: JSON.stringify({ campaignPageId: 287 }) })
	);
	expect(addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
});
