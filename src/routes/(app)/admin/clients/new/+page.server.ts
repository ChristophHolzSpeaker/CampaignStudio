import type { Actions, PageServerLoad } from './$types';
import { createClient } from '$lib/server/clients/client';
import { clientFormSchema } from '$lib/validation/clients';
import { fail, redirect } from '@sveltejs/kit';

function getString(formData: FormData, key: string): string {
	return String(formData.get(key) ?? '').trim();
}

export const load: PageServerLoad = async () => ({});

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const logoFile = formData.get('logoFile');
		const parsed = clientFormSchema.safeParse({
			name: getString(formData, 'name'),
			logoAlt: getString(formData, 'logoAlt'),
			industry: getString(formData, 'industry'),
			keynoteCaseStudy: getString(formData, 'keynoteCaseStudy'),
			audiences: getString(formData, 'audiences'),
			topics: getString(formData, 'topics'),
			formats: getString(formData, 'formats'),
			geographies: getString(formData, 'geographies'),
			intentTags: getString(formData, 'intentTags'),
			priority: getString(formData, 'priority')
		});

		if (!parsed.success) {
			return fail(400, {
				formError: parsed.error.issues[0]?.message ?? 'Invalid client form input.'
			});
		}

		if (!(logoFile instanceof File)) {
			return fail(400, { formError: 'Logo file is required.' });
		}

		try {
			await createClient(parsed.data, logoFile, locals.supabase);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unable to create client.';
			return fail(400, { formError: message });
		}

		throw redirect(303, '/admin/clients');
	}
};
