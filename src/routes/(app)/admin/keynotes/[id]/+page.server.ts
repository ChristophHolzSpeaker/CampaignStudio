import type { Actions, PageServerLoad } from './$types';
import { getKeynoteById, updateKeynote } from '$lib/server/keynotes/keynote';
import { keynoteFormSchema } from '$lib/validation/keynotes';
import { error, fail, redirect } from '@sveltejs/kit';

function getString(formData: FormData, key: string): string {
	return String(formData.get(key) ?? '').trim();
}

export const load: PageServerLoad = async ({ params }) => {
	const keynote = await getKeynoteById(params.id);
	if (!keynote) {
		throw error(404, 'Keynote not found');
	}

	return { keynote };
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		const existing = await getKeynoteById(params.id);
		if (!existing) {
			throw error(404, 'Keynote not found');
		}

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

		const parsedImageFile = imageFile instanceof File ? imageFile : null;

		try {
			await updateKeynote(params.id, parsed.data, parsedImageFile, locals.supabase);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unable to update keynote.';
			return fail(400, { formError: message });
		}

		throw redirect(303, '/admin/keynotes');
	}
};
