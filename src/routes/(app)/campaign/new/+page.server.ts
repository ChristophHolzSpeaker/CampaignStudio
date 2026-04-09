import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { campaignFormSchema, type CampaignFormSubmission } from '$lib/validation/campaign';
import { createCampaign } from '$lib/server/campaigns/client';
import { runGoogleAdsGenerationForCampaign } from '$lib/server/agents/google-ads-pipeline';
import { runLandingPageGenerationForCampaign } from '$lib/server/agents/landing-page-pipeline';

type FieldErrors = Record<string, string[] | undefined>;

export type CampaignFormActionData = {
	values?: CampaignFormSubmission;
	errors?: FieldErrors;
	message?: string;
	pipelineMessage?: string;
};

const getTrimmedField = (formData: FormData, key: string) =>
	formData.get(key)?.toString().trim() ?? '';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();

		const values: CampaignFormSubmission = {
			name: getTrimmedField(formData, 'name'),
			audience: getTrimmedField(formData, 'audience'),
			format: getTrimmedField(formData, 'format'),
			topic: getTrimmedField(formData, 'topic'),
			language: getTrimmedField(formData, 'language'),
			geography: getTrimmedField(formData, 'geography'),
			notes: formData.get('notes')?.toString().trim() ?? ''
		};

		const parseResult = campaignFormSchema.safeParse(values);

		if (!parseResult.success) {
			const { fieldErrors } = parseResult.error.flatten();
			return fail<CampaignFormActionData>(400, {
				errors: fieldErrors,
				values
			});
		}

		const campaignData = parseResult.data;

		const { data: userData } = await locals.supabase.auth.getUser();
		const createdBy = userData?.user?.id ?? null;

		let createdCampaign;
		try {
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
			console.log(`Campaign ${createdCampaign.id} saved, starting Google Ads pipeline.`);
		} catch (error) {
			console.error('Failed to create campaign:', error);
			return fail<CampaignFormActionData>(500, {
				message: 'Unable to save the campaign right now. Please try again.',
				values
			});
		}

		try {
			await runGoogleAdsGenerationForCampaign(createdCampaign.id);
			console.log('Google Ads generation completed for campaign', createdCampaign.id);
		} catch (error) {
			console.error('Google Ads generation failed:', error);
			return fail<CampaignFormActionData>(500, {
				message: 'Campaign saved, but Google Ads generation failed. Please retry.',
				pipelineMessage: error instanceof Error ? error.message : String(error),
				values
			});
		}

		try {
			await runLandingPageGenerationForCampaign(createdCampaign.id);
			console.log('Landing page generation completed for campaign', createdCampaign.id);
		} catch (error) {
			console.error('Landing page generation failed:', error);
			return fail<CampaignFormActionData>(500, {
				message: 'Campaign saved, but landing page generation failed. Please retry.',
				pipelineMessage: error instanceof Error ? error.message : String(error),
				values
			});
		}

		throw redirect(303, '/campaigns/' + createdCampaign.id);
	}
};
