import type { Actions, PageServerLoad } from './$types';
import { listPrompts, togglePromptActive } from '$lib/server/prompts/client';

export const load: PageServerLoad = async () => {
	const prompts = await listPrompts();
	return {
		prompts
	};
};

export const actions: Actions = {
	toggle: async ({ request }) => {
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		const active = (formData.get('active') ?? 'true') === 'true';
		if (!id) {
			return { success: false };
		}
		await togglePromptActive(id, !active);
		return { success: true };
	}
};
