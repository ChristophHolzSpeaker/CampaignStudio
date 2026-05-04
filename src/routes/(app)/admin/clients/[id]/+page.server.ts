import type { Actions, PageServerLoad } from './$types';
import { getClientById, updateClient } from '$lib/server/clients/client';
import { clientFormSchema } from '$lib/validation/clients';
import { error, fail, redirect } from '@sveltejs/kit';

function getString(formData: FormData, key: string): string {
	return String(formData.get(key) ?? '').trim();
}

export const load: PageServerLoad = async ({ params }) => {
	const client = await getClientById(params.id);
	if (!client) {
		throw error(404, 'Client not found');
	}

	return { client };
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		const existing = await getClientById(params.id);
		if (!existing) {
			throw error(404, 'Client not found');
		}

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

		const parsedLogoFile = logoFile instanceof File ? logoFile : null;

		try {
			await updateClient(params.id, parsed.data, parsedLogoFile, locals.supabase);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unable to update client.';
			return fail(400, { formError: message });
		}

		throw redirect(303, '/admin/clients');
	}
};
