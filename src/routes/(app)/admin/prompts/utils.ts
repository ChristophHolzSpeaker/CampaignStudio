import type { PromptInput, PromptPurpose } from '$lib/server/prompts/client';

export function buildPromptPayload(formData: FormData) {
	const name = String(formData.get('name') ?? '').trim();
	const purpose = String(formData.get('purpose') ?? '') as PromptPurpose;
	const audience = String(formData.get('audience') ?? '').trim();
	const format = String(formData.get('format') ?? '').trim();
	const model = String(formData.get('model') ?? '').trim();
	const system_prompt = String(formData.get('system_prompt') ?? '').trim();
	const user_prompt_template = String(formData.get('user_prompt_template') ?? '').trim();
	const topic = String(formData.get('topic') ?? '').trim();
	const metadataNotes = String(formData.get('metadata') ?? '').trim();
	const is_active = formData.get('is_active') ? true : false;

	const fieldErrors: Record<string, string> = {};
	if (!name) fieldErrors.name = 'Name is required';
	if (!purpose) fieldErrors.purpose = 'Purpose is required';
	if (!audience) fieldErrors.audience = 'Audience is required';
	if (!format) fieldErrors.format = 'Format is required';
	if (!model) fieldErrors.model = 'Model cannot be empty';
	if (!system_prompt) fieldErrors.system_prompt = 'System prompt is required';
	if (!user_prompt_template) fieldErrors.user_prompt_template = 'User prompt template is required';

	const promptInput: PromptInput = {
		name,
		purpose,
		audience,
		format,
		model,
		system_prompt,
		user_prompt_template,
		topic: topic || undefined,
		metadata: metadataNotes ? { notes: metadataNotes } : null,
		is_active
	};

	const formValues = {
		name,
		purpose,
		audience,
		format,
		model,
		system_prompt,
		user_prompt_template,
		topic,
		metadata: metadataNotes,
		is_active: is_active ? 'true' : 'false'
	};

	return { promptInput, formValues, fieldErrors };
}
