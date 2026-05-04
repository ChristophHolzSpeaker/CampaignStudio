import type { Actions, PageServerLoad } from './$types';
import { createKeynote } from '$lib/server/keynotes/keynote';
import { keynoteFormSchema } from '$lib/validation/keynotes';
import { fail, redirect } from '@sveltejs/kit';

function getString(formData: FormData, key: string): string {
	return String(formData.get(key) ?? '').trim();
}

export const load: PageServerLoad = async () => ({});

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const imageFile = formData.get('imageFile');
		const parsed = keynoteFormSchema.safeParse({
			keynoteTitle: getString(formData, 'keynoteTitle'),
			keynoteSummary: getString(formData, 'keynoteSummary'),
			imageAlt: getString(formData, 'imageAlt'),
			audiences: getString(formData, 'audiences'),
			topics: getString(formData, 'topics'),
			formats: getString(formData, 'formats'),
			geographies: getString(formData, 'geographies'),
			intentTags: getString(formData, 'intentTags'),
			priority: getString(formData, 'priority')
		});

		if (!parsed.success) {
			return fail(400, {
				formError: parsed.error.issues[0]?.message ?? 'Invalid keynote form input.'
			});
		}

		if (!(imageFile instanceof File)) {
			return fail(400, { formError: 'Keynote image file is required.' });
		}

		try {
			await createKeynote(parsed.data, imageFile, locals.supabase);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unable to create keynote.';
			return fail(400, { formError: message });
		}

		throw redirect(303, '/admin/keynotes');
	}
};
