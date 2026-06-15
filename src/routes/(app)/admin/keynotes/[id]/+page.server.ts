import type { PageServerLoad } from './$types';
import { getKeynoteById } from '$lib/server/keynotes/keynote';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const keynote = await getKeynoteById(params.id);
	if (!keynote) {
		throw error(404, 'Keynote not found');
	}

	return { keynote };
};
