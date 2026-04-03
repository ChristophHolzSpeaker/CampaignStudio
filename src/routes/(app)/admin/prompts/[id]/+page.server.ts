import type { Actions, PageServerLoad } from './$types';
import { getPromptById, updatePrompt } from '$lib/server/prompts/client';
import { buildPromptPayload } from '../utils';
import { error, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	const prompt = await getPromptById(id);
	if (!prompt) {
		throw error(404, 'Prompt not found');
	}

	return {
		prompt
	};
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const id = Number(params.id);
		const prompt = await getPromptById(id);
		if (!prompt) {
			throw error(404, 'Prompt not found');
		}

		const formData = await request.formData();
		const { promptInput, formValues, fieldErrors } = buildPromptPayload(formData);

		if (Object.keys(fieldErrors).length) {
			return fail(400, { values: formValues, fieldErrors });
		}

		try {
			await updatePrompt(id, promptInput);
			return { success: true };
		} catch (err) {
			const message =
				err instanceof Error && err.message.includes('duplicate key')
					? 'A prompt already exists for that audience/format combination'
					: 'Unable to update prompt';
			return fail(400, { values: formValues, formError: message });
		}
	}
};
