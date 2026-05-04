import type { Actions, PageServerLoad } from './$types';
import { deleteClient, listClients, toggleClientActive } from '$lib/server/clients/client';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	const clients = await listClients();
	return { clients };
};

export const actions: Actions = {
	toggle: async ({ request }) => {
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		const active = String(formData.get('active') ?? 'false') === 'true';

		if (!id) {
			return fail(400, { success: false, message: 'Client ID is required.' });
		}

		await toggleClientActive(id, active);
		return { success: true };
	},
	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();

		if (!id) {
			return fail(400, { success: false, message: 'Client ID is required.' });
		}

		await deleteClient(id, locals.supabase);
		return { success: true };
	}
};
