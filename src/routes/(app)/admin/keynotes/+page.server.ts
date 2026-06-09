import type { Actions, PageServerLoad } from './$types';
import {
	deleteKeynote,
	listKeynotes,
	updateKeynoteStatus
} from '$lib/server/keynotes/keynote';
import { fail } from '@sveltejs/kit';

const keynoteStatuses = ['active', 'draft', 'review', 'archived'] as const;
type KeynoteStatus = (typeof keynoteStatuses)[number];

export const load: PageServerLoad = async () => {
	const keynotes = await listKeynotes();
	return { keynotes };
};

export const actions: Actions = {
	status: async ({ request }) => {
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		const status = String(formData.get('status') ?? '').trim() as KeynoteStatus;

		if (!id) {
			return fail(400, { success: false, message: 'Keynote ID is required.' });
		}

		if (!keynoteStatuses.includes(status)) {
			return fail(400, { success: false, message: 'Keynote status is invalid.' });
		}

		await updateKeynoteStatus(id, status);
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
