import template from '$lib/artifacts/google-consent-v6.tpl?raw';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	new Response(template, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'content-disposition': 'attachment; filename="campaign-studio-consent-v6.tpl"',
			'cache-control': 'public, max-age=3600',
			'x-content-type-options': 'nosniff'
		}
	});
