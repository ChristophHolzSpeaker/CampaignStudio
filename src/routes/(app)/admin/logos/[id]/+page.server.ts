import type { Actions, PageServerLoad } from './$types';
import { getLogoById, updateLogo } from '$lib/server/logos/logo';
import { logoFormSchema } from '$lib/validation/logos';
import { error, fail, redirect } from '@sveltejs/kit';

function getString(formData: FormData, key: string): string {
	return String(formData.get(key) ?? '').trim();
}

export const load: PageServerLoad = async ({ params }) => {
	const logo = await getLogoById(params.id);
	if (!logo) {
		throw error(404, 'Logo not found');
	}

	return { logo };
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		const existing = await getLogoById(params.id);
		if (!existing) {
			throw error(404, 'Logo not found');
		}

		const formData = await request.formData();
		const logoFile = formData.get('logoFile');
		const parsed = logoFormSchema.safeParse({
			name: getString(formData, 'name'),
			logoAlt: getString(formData, 'logoAlt'),
			priority: getString(formData, 'priority')
		});

		if (!parsed.success) {
			return fail(400, {
				formError: parsed.error.issues[0]?.message ?? 'Invalid logo form input.'
			});
		}

		const parsedLogoFile = logoFile instanceof File ? logoFile : null;

		try {
			await updateLogo(params.id, parsed.data, parsedLogoFile, locals.supabase);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unable to update logo.';
			return fail(400, { formError: message });
		}

		throw redirect(303, '/admin/logos');
	}
};
