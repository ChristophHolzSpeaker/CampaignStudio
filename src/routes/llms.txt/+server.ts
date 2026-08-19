import { renderLlmsIndex } from '$lib/artifacts/authoring-contract';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) =>
	new Response(renderLlmsIndex(url.origin), {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			'Cache-Control': 'public, max-age=300, s-maxage=3600',
			'X-Content-Type-Options': 'nosniff'
		}
	});
