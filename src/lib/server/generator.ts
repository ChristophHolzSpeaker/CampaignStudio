import { env } from '$env/dynamic/private';
import { callOpenRouter } from '$lib/server/openrouter/client';
import {
	defaultPromptLibrary,
	findPromptTemplate,
	renderPromptTemplate,
	type PromptPurpose
} from '$lib/server/prompts/client';
import {
	PageSchema,
	IntermediatePageSchema,
	EditPlanSchema,
	type Page,
	type IntermediatePage,
	type EditPlan
} from '$lib/schema';

export const generationProgress = new Map<string, string>();

export interface CampaignPromptMetadata {
	audience?: string;
	format?: string;
	topic?: string;
	notes?: string;
	campaignName?: string;
}

const DEFAULT_AUDIENCE = 'general';
const DEFAULT_FORMAT = 'general';

async function buildPromptPayload(
	stage: PromptPurpose,
	templateData: Record<string, string>,
	metadata?: CampaignPromptMetadata
) {
	const audienceCandidate = metadata?.audience?.trim();
	const formatCandidate = metadata?.format?.trim();
	const topicCandidate = metadata?.topic?.trim();

	const audience =
		audienceCandidate && audienceCandidate.length ? audienceCandidate : DEFAULT_AUDIENCE;
	const format = formatCandidate && formatCandidate.length ? formatCandidate : DEFAULT_FORMAT;
	const topic = topicCandidate && topicCandidate.length ? topicCandidate : null;

	const promptTemplate = await findPromptTemplate({
		purpose: stage,
		audience,
		format,
		topic
	});

	const stageDefaults = defaultPromptLibrary[stage];
	const systemPrompt = promptTemplate?.system_prompt ?? stageDefaults.systemPrompt;
	const model = promptTemplate?.model ?? stageDefaults.model;
	const userPromptTemplate =
		promptTemplate?.user_prompt_template ?? stageDefaults.userPromptTemplate;

	const templateValues = {
		audience,
		format,
		topic: metadata?.topic ?? '',
		notes: metadata?.notes ?? '',
		campaignName: metadata?.campaignName ?? '',
		...templateData
	};

	const userPrompt = renderPromptTemplate(userPromptTemplate, templateValues);

	return { model, systemPrompt, userPrompt };
}

// Step 1
async function generateIntermediateContent(
	prompt: string,
	metadata?: CampaignPromptMetadata
): Promise<IntermediatePage> {
	const templateData = {
		prompt,
		audience: metadata?.audience ?? '',
		format: metadata?.format ?? '',
		topic: metadata?.topic ?? '',
		notes: metadata?.notes ?? '',
		campaignName: metadata?.campaignName ?? ''
	};

	const { model, systemPrompt, userPrompt } = await buildPromptPayload(
		'intermediate',
		templateData,
		metadata
	);
	const rawJson = await callOpenRouter({ model, systemPrompt, userPrompt });

	return IntermediatePageSchema.parse(rawJson);
}

// Step 2
async function transformContentToPage(
	intermediate: IntermediatePage,
	metadata?: CampaignPromptMetadata
): Promise<Page> {
	const templateData = {
		intermediate_json: JSON.stringify(intermediate, null, 2),
		audience: metadata?.audience ?? '',
		format: metadata?.format ?? '',
		topic: metadata?.topic ?? '',
		notes: metadata?.notes ?? '',
		campaignName: metadata?.campaignName ?? ''
	};

	const { model, systemPrompt, userPrompt } = await buildPromptPayload(
		'final',
		templateData,
		metadata
	);
	const rawJson = await callOpenRouter({ model, systemPrompt, userPrompt });

	return PageSchema.parse(rawJson);
}

// Fallback logic
export async function generateMockPage(prompt: string): Promise<Page> {
	const defaultTitle = `Landing Page for "${prompt.slice(0, 30)}..."`;

	return {
		title: defaultTitle,
		goal: 'Capture leads and explain value proposition',
		audience: 'General audience interested in the product',
		sections: [
			{
				type: 'hero',
				props: {
					headline: `Welcome to the solution for: ${prompt.split(' ')[0] || 'Everything'}`,
					subheadline: `Discover how we can help you achieve your goals with our innovative approach to ${prompt.slice(0, 50)}.`,
					ctaLabel: 'Get Started Today'
				}
			},
			{
				type: 'benefits',
				props: {
					title: 'Why Choose Us?',
					items: [
						{
							title: 'Lightning Fast',
							body: 'Our platform is optimized for speed.'
						},
						{
							title: 'High Conversion',
							body: 'Built using templates proven to turn visitors into customers.'
						},
						{
							title: 'Fully Reliable',
							body: 'Uptime you can count on, 24/7 support.'
						}
					]
				}
			},
			{
				type: 'lead_form',
				props: {
					title: 'Ready to learn more?',
					description: 'Sign up for our newsletter to receive the latest updates.',
					buttonLabel: 'Subscribe Now'
				}
			}
		]
	};
}

// Orchestrator
export async function generatePageFromJson(
	prompt: string,
	id: string,
	metadata?: CampaignPromptMetadata
): Promise<Page> {
	const setProgress = (msg: string) => {
		console.log(`[${id}] ${msg}`);
		generationProgress.set(id, msg);
	};

	try {
		setProgress('Initializing generator...');
		if (!env.OPENROUTER_API_KEY) {
			setProgress('API Key missing. Falling back to mock generator...');
			return await generateMockPage(prompt);
		}

		setProgress('Step 1: Planning content and copywriting...');
		const intermediate = await generateIntermediateContent(prompt, metadata);

		setProgress('Step 2: Generating final page schema...');
		const finalPage = await transformContentToPage(intermediate, metadata);

		setProgress('Finalizing display...');
		return finalPage;
	} catch (error) {
		console.error(
			'Error generating page via OpenRouter pipeline. Falling back to mock generator.',
			error
		);
		setProgress('Error occurred. Falling back to mock generator...');
		return await generateMockPage(prompt);
	}
}

// Editor Step 1
async function generatePageEditPlan(
	page: Page,
	changePrompt: string,
	metadata?: CampaignPromptMetadata
): Promise<EditPlan> {
	const templateData = {
		current_page_json: JSON.stringify(page, null, 2),
		change_prompt: changePrompt,
		audience: metadata?.audience ?? '',
		format: metadata?.format ?? '',
		topic: metadata?.topic ?? '',
		notes: metadata?.notes ?? '',
		campaignName: metadata?.campaignName ?? ''
	};

	const { model, systemPrompt, userPrompt } = await buildPromptPayload(
		'edit_plan',
		templateData,
		metadata
	);
	const rawJson = await callOpenRouter({ model, systemPrompt, userPrompt });

	return EditPlanSchema.parse(rawJson);
}

// Editor Step 2
async function applyPageEditPlan(
	page: Page,
	editPlan: EditPlan,
	metadata?: CampaignPromptMetadata
): Promise<Page> {
	const templateData = {
		current_page_json: JSON.stringify(page, null, 2),
		edit_plan_json: JSON.stringify(editPlan, null, 2),
		audience: metadata?.audience ?? '',
		format: metadata?.format ?? '',
		topic: metadata?.topic ?? '',
		notes: metadata?.notes ?? '',
		campaignName: metadata?.campaignName ?? ''
	};

	const { model, systemPrompt, userPrompt } = await buildPromptPayload(
		'apply_plan',
		templateData,
		metadata
	);
	const rawJson = await callOpenRouter({ model, systemPrompt, userPrompt });

	return PageSchema.parse(rawJson);
}

export async function updatePageFromPrompt(
	page: Page,
	changePrompt: string,
	id: string,
	metadata?: CampaignPromptMetadata
): Promise<Page> {
	const setProgress = (msg: string) => {
		console.log(`[${id}] ${msg}`);
		generationProgress.set(id, msg);
	};

	try {
		if (!env.OPENROUTER_API_KEY) {
			setProgress('Error: API Key missing. Editing not possible without OpenRouter.');
			throw new Error('API Key missing');
		}

		setProgress('Step 1: Planning page edits...');
		const editPlan = await generatePageEditPlan(page, changePrompt, metadata);

		setProgress('Step 2: Applying page edits...');
		const updatedPage = await applyPageEditPlan(page, editPlan, metadata);

		setProgress('Refreshed display.');
		return updatedPage;
	} catch (error) {
		console.error('Error in edit pipeline.', error);
		setProgress('Error occurred during editing.');
		throw error;
	}
}
