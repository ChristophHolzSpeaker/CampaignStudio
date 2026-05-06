import type { Actions, PageServerLoad } from './$types';
import { deleteLogo, listLogos, toggleLogoActive } from '$lib/server/logos/logo';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	const logos = await listLogos();
	return { logos };
};

export const actions: Actions = {
	toggle: async ({ request }) => {
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		const active = String(formData.get('active') ?? 'false') === 'true';

		if (!id) {
			return fail(400, { success: false, message: 'Logo ID is required.' });
		}

		await toggleLogoActive(id, active);
		return { success: true };
	},
	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();

		if (!id) {
			return fail(400, { success: false, message: 'Logo ID is required.' });
		}

		await deleteLogo(id, locals.supabase);
		return { success: true };
	}
};
