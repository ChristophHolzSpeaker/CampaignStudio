import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { campaignFormSchema, type CampaignFormSubmission } from '$lib/validation/campaign';
import { createCampaign } from '$lib/server/campaigns/client';
import { runCampaignPlanner } from '$lib/server/agents/campaign-planner';
import { runGoogleAdsGenerationForCampaign } from '$lib/server/agents/google-ads-pipeline';
import { runLandingPageGenerationForCampaign } from '$lib/server/agents/landing-page-pipeline';
import { publishCampaignPipelineEvent } from '$lib/server/campaign-pipeline-progress';
import { createRunId } from '$lib/server/telemetry/llm-trace';
import {
	completeGenerationJob,
	createGenerationJob,
	failGenerationJob,
	markGenerationJobStage
} from '$lib/server/generation-jobs';
import type { PlannerRequiredField } from '$lib/server/agents/schemas/campaign-planner';

type FieldErrors = Record<string, string[] | undefined>;

type PlannerResolvedFields = CampaignFormSubmission & {
	decisionMakerAudience: string;
	attendeeAudience: string;
};

type PlannerMessage = {
	role: 'user' | 'assistant';
	content: string;
};

type PlannerState = {
	messages: PlannerMessage[];
	resolvedFields: PlannerResolvedFields;
	planMarkdown: string;
	questions: string[];
	missingFields: PlannerRequiredField[];
	readyToCreate: boolean;
};

export type CampaignFormActionData = {
	values?: CampaignFormSubmission;
	errors?: FieldErrors;
	message?: string;
	pipelineMessage?: string;
	pipelineRunId?: string;
	createdCampaignId?: number;
	planner?: PlannerState;
	mode?: 'manual' | 'planner';
};

const getTrimmedField = (formData: FormData, key: string) =>
	formData.get(key)?.toString().trim() ?? '';

const requiredPlannerFields: PlannerRequiredField[] = [
	'name',
	'decisionMakerAudience',
	'attendeeAudience',
	'format',
	'topic',
	'language',
	'geography'
];

const getEmptyValues = (): PlannerResolvedFields => ({
	name: '',
	audience: '',
	decisionMakerAudience: '',
	attendeeAudience: '',
	format: '',
	topic: '',
	language: '',
	geography: '',
	notes: ''
});

const getInitialPlannerState = (): PlannerState => ({
	messages: [],
	resolvedFields: getEmptyValues(),
	planMarkdown: '',
	questions: [],
	missingFields: [...requiredPlannerFields],
	readyToCreate: false
});

const parsePlannerState = (rawValue: FormDataEntryValue | null): PlannerState => {
	if (!rawValue) {
		return getInitialPlannerState();
	}

	try {
		const parsed = JSON.parse(rawValue.toString()) as Partial<PlannerState>;
		const resolved = (parsed.resolvedFields ?? {}) as Partial<PlannerResolvedFields>;
		const messages = Array.isArray(parsed.messages)
			? parsed.messages
					.filter(
						(message): message is PlannerMessage =>
							typeof message === 'object' &&
							message !== null &&
							(message.role === 'user' || message.role === 'assistant') &&
							typeof message.content === 'string' &&
							message.content.trim().length > 0
					)
					.slice(-30)
			: [];

		const state: PlannerState = {
			messages,
			resolvedFields: {
				name: typeof resolved.name === 'string' ? resolved.name : '',
				audience: typeof resolved.audience === 'string' ? resolved.audience : '',
				decisionMakerAudience:
					typeof resolved.decisionMakerAudience === 'string' ? resolved.decisionMakerAudience : '',
				attendeeAudience:
					typeof resolved.attendeeAudience === 'string' ? resolved.attendeeAudience : '',
				format: typeof resolved.format === 'string' ? resolved.format : '',
				topic: typeof resolved.topic === 'string' ? resolved.topic : '',
				language: typeof resolved.language === 'string' ? resolved.language : '',
				geography: typeof resolved.geography === 'string' ? resolved.geography : '',
				notes: typeof resolved.notes === 'string' ? resolved.notes : ''
			},
			planMarkdown: typeof parsed.planMarkdown === 'string' ? parsed.planMarkdown : '',
			questions:
				Array.isArray(parsed.questions) &&
				parsed.questions.every((item) => typeof item === 'string')
					? parsed.questions
					: [],
			missingFields:
				Array.isArray(parsed.missingFields) &&
				parsed.missingFields.every((field) => requiredPlannerFields.includes(field))
					? parsed.missingFields
					: [...requiredPlannerFields],
			readyToCreate: parsed.readyToCreate === true
		};

		return state;
	} catch {
		return getInitialPlannerState();
	}
};

const mergeResolvedFields = (
	previous: PlannerResolvedFields,
	proposed: Partial<PlannerResolvedFields>
): PlannerResolvedFields => {
	const normalizeText = (value: string | undefined, fallback: string) => {
		if (typeof value !== 'string') {
			return fallback;
		}

		const trimmed = value.trim();
		return trimmed.length ? trimmed : fallback;
	};

	return {
		name: normalizeText(proposed.name, previous.name),
		decisionMakerAudience: normalizeText(
			proposed.decisionMakerAudience,
			previous.decisionMakerAudience
		),
		attendeeAudience: normalizeText(proposed.attendeeAudience, previous.attendeeAudience),
		audience: normalizeText(proposed.audience, previous.audience),
		format: normalizeText(proposed.format, previous.format),
		topic: normalizeText(proposed.topic, previous.topic),
		language: normalizeText(proposed.language, previous.language),
		geography: normalizeText(proposed.geography, previous.geography),
		notes: normalizeText(proposed.notes, previous.notes)
	};
};

const getMissingPlannerFields = (values: PlannerResolvedFields): PlannerRequiredField[] => {
	const missing: PlannerRequiredField[] = [];

	if (!values.name.trim()) {
		missing.push('name');
	}

	if (!values.decisionMakerAudience.trim()) {
		missing.push('decisionMakerAudience');
	}

	if (!values.attendeeAudience.trim()) {
		missing.push('attendeeAudience');
	}

	if (!values.format.trim()) {
		missing.push('format');
	}

	if (!values.topic.trim()) {
		missing.push('topic');
	}

	if (!values.language.trim()) {
		missing.push('language');
	}

	if (!values.geography.trim()) {
		missing.push('geography');
	}

	return missing;
};

const toCampaignSubmission = (values: PlannerResolvedFields): CampaignFormSubmission => {
	const attendeeAudience = values.attendeeAudience.trim() || values.audience.trim();
	const decisionMakerAudience = values.decisionMakerAudience.trim();
	const notesParts: string[] = [];
	if (decisionMakerAudience.length > 0) {
		notesParts.push(`Decision maker audience: ${decisionMakerAudience}`);
	}
	if (values.notes.trim().length > 0) {
		notesParts.push(values.notes.trim());
	}

	return {
		name: values.name,
		audience: attendeeAudience,
		format: values.format,
		topic: values.topic,
		language: values.language,
		geography: values.geography,
		notes: notesParts.join('\n')
	};
};

const getSubmittedValues = (formData: FormData): CampaignFormSubmission => ({
	name: getTrimmedField(formData, 'name'),
	audience: getTrimmedField(formData, 'audience'),
	format: getTrimmedField(formData, 'format'),
	topic: getTrimmedField(formData, 'topic'),
	language: getTrimmedField(formData, 'language'),
	geography: getTrimmedField(formData, 'geography'),
	notes: formData.get('notes')?.toString().trim() ?? ''
});

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const formData = await request.formData();
		const mode = getTrimmedField(formData, 'mode') === 'planner' ? 'planner' : 'manual';
		const planner =
			mode === 'planner' ? parsePlannerState(formData.get('plannerState')) : undefined;
		const pipelineRunId =
			getTrimmedField(formData, 'pipelineRunId') || createRunId('campaign_create');

		const values = getSubmittedValues(formData);
		const valuesForValidation =
			mode === 'planner' && planner ? toCampaignSubmission(planner.resolvedFields) : values;

		publishCampaignPipelineEvent(pipelineRunId, {
			step: 'queued',
			level: 'info',
			message: 'Request received. Validating campaign brief.'
		});

		const parseResult = campaignFormSchema.safeParse(valuesForValidation);

		if (!parseResult.success) {
			const { fieldErrors } = parseResult.error.flatten();
			publishCampaignPipelineEvent(pipelineRunId, {
				step: 'failed',
				level: 'error',
				message: 'Validation failed. Please review the highlighted fields and retry.'
			});

			return fail<CampaignFormActionData>(400, {
				errors: fieldErrors,
				values: valuesForValidation,
				pipelineRunId,
				planner,
				mode
			});
		}

		const campaignData = parseResult.data;

		const { data: userData } = await locals.supabase.auth.getUser();
		const createdBy = userData?.user?.id ?? null;

		let createdCampaign;
		let generationJobId: number | null = null;
		try {
			publishCampaignPipelineEvent(pipelineRunId, {
				step: 'saving_campaign',
				level: 'info',
				message: 'Saving campaign metadata.'
			});

			createdCampaign = await createCampaign({
				name: campaignData.name,
				audience: campaignData.audience,
				format: campaignData.format,
				topic: campaignData.topic,
				language: campaignData.language,
				geography: campaignData.geography,
				notes: campaignData.notes?.length ? campaignData.notes : null,
				created_by: createdBy
			});
			publishCampaignPipelineEvent(pipelineRunId, {
				step: 'campaign_saved',
				level: 'success',
				message: `Campaign #${createdCampaign.id} saved.`
			});
			const createdJob = await createGenerationJob({
				campaignId: createdCampaign.id,
				runId: pipelineRunId,
				pipeline: 'campaign_create',
				inputPayload: {
					mode,
					campaignDraft: campaignData
				}
			});
			generationJobId = createdJob.id;
			await markGenerationJobStage({
				jobId: generationJobId,
				stage: 'campaign_create',
				status: 'processing',
				message: 'Campaign record created and pipeline initialized.'
			});
			console.log(`Campaign ${createdCampaign.id} saved, starting Google Ads pipeline.`);
		} catch (error) {
			console.error('Failed to create campaign:', error);
			publishCampaignPipelineEvent(pipelineRunId, {
				step: 'failed',
				level: 'error',
				message: 'Could not save campaign metadata.'
			});

			return fail<CampaignFormActionData>(500, {
				message: 'Unable to save the campaign right now. Please try again.',
				values: valuesForValidation,
				pipelineRunId,
				planner,
				mode
			});
		}

		try {
			if (generationJobId) {
				await markGenerationJobStage({
					jobId: generationJobId,
					stage: 'google_ads',
					status: 'processing',
					message: 'Generating Google Ads assets.'
				});
			}
			publishCampaignPipelineEvent(pipelineRunId, {
				step: 'generating_google_ads',
				level: 'info',
				message: 'Generating Google Ads assets.'
			});
			await runGoogleAdsGenerationForCampaign(createdCampaign.id);
			if (generationJobId) {
				await markGenerationJobStage({
					jobId: generationJobId,
					stage: 'google_ads',
					status: 'completed',
					message: 'Google Ads assets generated.',
					level: 'success'
				});
			}
			publishCampaignPipelineEvent(pipelineRunId, {
				step: 'google_ads_done',
				level: 'success',
				message: 'Google Ads assets generated.'
			});
			console.log('Google Ads generation completed for campaign', createdCampaign.id);
		} catch (error) {
			console.error('Google Ads generation failed:', error);
			if (generationJobId) {
				await failGenerationJob({
					jobId: generationJobId,
					errorMessage: error instanceof Error ? error.message : String(error),
					stage: 'google_ads'
				});
			}
			publishCampaignPipelineEvent(pipelineRunId, {
				step: 'failed',
				level: 'error',
				message: 'Google Ads generation failed.'
			});

			return fail<CampaignFormActionData>(500, {
				message: 'Campaign saved, but Google Ads generation failed. Please retry.',
				pipelineMessage: error instanceof Error ? error.message : String(error),
				values: valuesForValidation,
				pipelineRunId,
				planner,
				mode
			});
		}

		try {
			if (generationJobId) {
				await markGenerationJobStage({
					jobId: generationJobId,
					stage: 'assembly',
					status: 'processing',
					message: 'Generating landing page.'
				});
			}
			publishCampaignPipelineEvent(pipelineRunId, {
				step: 'generating_landing_page',
				level: 'info',
				message: 'Generating landing page structure.'
			});
			await runLandingPageGenerationForCampaign(createdCampaign.id, {
				jobId: generationJobId ?? undefined,
				runId: pipelineRunId
			});
			publishCampaignPipelineEvent(pipelineRunId, {
				step: 'landing_page_done',
				level: 'success',
				message: 'Landing page generated.'
			});
			console.log('Landing page generation completed for campaign', createdCampaign.id);
		} catch (error) {
			console.error('Landing page generation failed:', error);
			if (generationJobId) {
				await failGenerationJob({
					jobId: generationJobId,
					errorMessage: error instanceof Error ? error.message : String(error),
					stage: 'assembly'
				});
			}
			publishCampaignPipelineEvent(pipelineRunId, {
				step: 'failed',
				level: 'error',
				message: 'Landing page generation failed.'
			});

			return fail<CampaignFormActionData>(500, {
				message: 'Campaign saved, but landing page generation failed. Please retry.',
				pipelineMessage: error instanceof Error ? error.message : String(error),
				createdCampaignId: createdCampaign.id,
				values: valuesForValidation,
				pipelineRunId,
				planner,
				mode
			});
		}

		publishCampaignPipelineEvent(pipelineRunId, {
			step: 'done',
			level: 'success',
			message: 'Campaign pipeline completed. Redirecting to campaign details.'
		});

		if (generationJobId) {
			await completeGenerationJob({
				jobId: generationJobId,
				outputPayload: {
					message: 'Campaign creation pipeline completed successfully.'
				}
			});
		}

		throw redirect(303, '/campaigns/' + createdCampaign.id);
	},
	startPlanner: async ({ request }) => {
		const formData = await request.formData();
		const userMessage = getTrimmedField(formData, 'plannerMessage');

		if (!userMessage) {
			return fail<CampaignFormActionData>(400, {
				mode: 'planner',
				message: 'Add a campaign request to start planner mode.',
				planner: getInitialPlannerState()
			});
		}

		const runId = createRunId('campaign_planner');
		const initial = getInitialPlannerState();
		const conversation: PlannerMessage[] = [{ role: 'user', content: userMessage }];

		try {
			const plannerOutput = await runCampaignPlanner(
				{
					conversation,
					latestUserMessage: userMessage,
					resolvedFields: initial.resolvedFields
				},
				{ runId, pipeline: 'campaign_planner' }
			);

			const resolvedFields = mergeResolvedFields(
				initial.resolvedFields,
				plannerOutput.resolvedFields
			);
			const missingFields = getMissingPlannerFields(resolvedFields);
			const readyToCreate = missingFields.length === 0;

			return {
				mode: 'planner' as const,
				planner: {
					messages: [...conversation, { role: 'assistant', content: plannerOutput.planMarkdown }],
					resolvedFields,
					planMarkdown: plannerOutput.planMarkdown,
					questions: readyToCreate ? [] : plannerOutput.questions,
					missingFields,
					readyToCreate
				}
			};
		} catch (error) {
			console.error('Campaign planner failed:', error);
			return fail<CampaignFormActionData>(500, {
				mode: 'planner',
				message: 'Planner could not complete this step. Please try again.',
				planner: {
					...initial,
					messages: [
						{ role: 'user', content: userMessage },
						{
							role: 'assistant',
							content: 'I could not complete the plan on this turn. Please retry your request.'
						}
					],
					questions: ['Could you rephrase your campaign request in one short paragraph?']
				}
			});
		}
	},
	continuePlanner: async ({ request }) => {
		const formData = await request.formData();
		const userMessage = getTrimmedField(formData, 'plannerMessage');
		const currentState = parsePlannerState(formData.get('plannerState'));

		if (!userMessage) {
			return fail<CampaignFormActionData>(400, {
				mode: 'planner',
				message: 'Reply with details so the planner can finish the campaign brief.',
				planner: currentState
			});
		}

		const runId = createRunId('campaign_planner');
		const conversation = [
			...currentState.messages,
			{ role: 'user' as const, content: userMessage }
		].slice(-30);

		try {
			const plannerOutput = await runCampaignPlanner(
				{
					conversation,
					latestUserMessage: userMessage,
					resolvedFields: currentState.resolvedFields
				},
				{ runId, pipeline: 'campaign_planner' }
			);

			const resolvedFields = mergeResolvedFields(
				currentState.resolvedFields,
				plannerOutput.resolvedFields
			);
			const missingFields = getMissingPlannerFields(resolvedFields);
			const readyToCreate = missingFields.length === 0;

			return {
				mode: 'planner' as const,
				planner: {
					messages: [...conversation, { role: 'assistant', content: plannerOutput.planMarkdown }],
					resolvedFields,
					planMarkdown: plannerOutput.planMarkdown,
					questions: readyToCreate ? [] : plannerOutput.questions,
					missingFields,
					readyToCreate
				}
			};
		} catch (error) {
			console.error('Campaign planner failed:', error);
			return fail<CampaignFormActionData>(500, {
				mode: 'planner',
				message: 'Planner could not process that reply. Please try again.',
				planner: {
					...currentState,
					messages: [
						...conversation,
						{
							role: 'assistant',
							content:
								'I hit an issue while planning this turn. Please answer again with concise details.'
						}
					]
				}
			});
		}
	}
};
