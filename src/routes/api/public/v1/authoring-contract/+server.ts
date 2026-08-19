import { json } from '@sveltejs/kit';
import { ARTIFACT_AUTHORING_CONTRACT } from '$lib/artifacts/authoring-contract';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	json(
		{ ok: true, data: ARTIFACT_AUTHORING_CONTRACT },
		{
			headers: {
				'Cache-Control': 'public, max-age=300, s-maxage=3600',
				'X-Content-Type-Options': 'nosniff'
			}
		}
	);
