import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import markdown from '$lib/content/campaign-studio-user-journey.md?raw';

export const load: PageServerLoad = async () => {
	try {
		return {
			markdown
		};
	} catch (readError) {
		console.error('Unable to load campaign documentation markdown.', readError);
		throw error(500, 'Could not load documentation content.');
	}
};
