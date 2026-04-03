import type { Actions, PageServerLoad } from './$types';
import { createPrompt } from '$lib/server/prompts/client';
import { buildPromptPayload } from '../utils';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async () => ({
	// Placeholder for future options if needed
});

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const { promptInput, formValues, fieldErrors } = buildPromptPayload(formData);

		if (Object.keys(fieldErrors).length) {
			console.log('submission field in field errors');
			return fail(400, { values: formValues, fieldErrors });
		}

		try {
			await createPrompt(promptInput);
		} catch (error) {
			const message =
				error instanceof Error && error.message.includes('duplicate key')
					? 'A prompt already exists for that audience/format combination'
					: 'Unable to save prompt';
			return fail(400, { values: formValues, formError: message });
		}
		throw redirect(303, '/admin/prompts');
	}
};
