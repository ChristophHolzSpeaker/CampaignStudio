import type { Actions, PageServerLoad } from './$types';
import { createLogo } from '$lib/server/logos/logo';
import { logoFormSchema } from '$lib/validation/logos';
import { fail, redirect } from '@sveltejs/kit';

function getString(formData: FormData, key: string): string {
	return String(formData.get(key) ?? '').trim();
}

export const load: PageServerLoad = async () => ({});

export const actions: Actions = {
	default: async ({ request, locals }) => {
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

		if (!(logoFile instanceof File)) {
			return fail(400, { formError: 'Logo file is required.' });
		}

		try {
			await createLogo(parsed.data, logoFile, locals.supabase);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unable to create logo.';
			return fail(400, { formError: message });
		}

		throw redirect(303, '/admin/logos');
	}
};
