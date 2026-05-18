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
			theme: getString(formData, 'theme'),
			audience: getString(formData, 'audience'),
			language: getString(formData, 'language'),
			subtitle: getString(formData, 'subtitle'),
			moderation: getString(formData, 'moderation'),
			keynoteLong: getString(formData, 'keynoteLong'),
			keynoteShort: getString(formData, 'keynoteShort'),
			speaker: getString(formData, 'speaker')
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
