import type { Actions, PageServerLoad } from './$types';
import { deleteKeynote, listKeynotes, toggleKeynoteActive } from '$lib/server/keynotes/keynote';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	const keynotes = await listKeynotes();
	return { keynotes };
};

export const actions: Actions = {
	toggle: async ({ request }) => {
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		const active = String(formData.get('active') ?? 'false') === 'true';

		if (!id) {
			return fail(400, { success: false, message: 'Keynote ID is required.' });
		}

		await toggleKeynoteActive(id, active);
		return { success: true };
	},
	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();

		if (!id) {
			return fail(400, { success: false, message: 'Keynote ID is required.' });
		}

		await deleteKeynote(id, locals.supabase);
		return { success: true };
	}
};
