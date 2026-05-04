import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { christophSampleLandingPage, parseLandingPageDocument } from '$lib/page-builder/page';
import { db } from '$lib/server/db';
import { campaign_pages } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { runLandingPageEditFromPrompt } from '$lib/server/agents/landing-page-editor';
import { getCampaignById } from '$lib/server/campaigns/client';

type LandingPageEditFormState = {
	values: {
		changePrompt: string;
	};
	message?: string;
	success?: boolean;
	campaignPageId?: number;
};

export type LandingPagePreviewActionData = {
	pageEdit?: LandingPageEditFormState;
};

export const load: PageServerLoad = async ({ params }) => {
	const campaignId = Number(params.id);

	if (!Number.isFinite(campaignId) || campaignId <= 0) {
		throw error(400, 'Invalid campaign id');
	}

	const campaign = await getCampaignById(campaignId);
	if (!campaign) {
		throw error(404, 'Campaign not found');
	}

	const [pageRecord] = await db
		.select({
			structuredContentJson: campaign_pages.structured_content_json,
			campaignPageId: campaign_pages.id
		})
		.from(campaign_pages)
		.where(eq(campaign_pages.campaign_id, campaignId))
		.orderBy(desc(campaign_pages.version_number))
		.limit(1);

	const page = pageRecord
		? parseLandingPageDocument(pageRecord.structuredContentJson)
		: parseLandingPageDocument(christophSampleLandingPage);

	return {
		page,
		campaign,
		campaignId,
		campaignPageId: pageRecord?.campaignPageId ?? null,
		campaignStatus: campaign.status
	};
};

export const actions: Actions = {
	editPage: async ({ request }) => {
		const formData = await request.formData();
		const candidatePageId = Number(formData.get('campaignPageId'));
		const changePrompt = formData.get('change_prompt')?.toString().trim() ?? '';

		if (!Number.isFinite(candidatePageId) || candidatePageId <= 0) {
			return fail<LandingPagePreviewActionData>(400, {
				pageEdit: {
					values: { changePrompt },
					message: 'Select a valid campaign page before editing.',
					success: false
				}
			});
		}

		if (!changePrompt.length) {
			return fail<LandingPagePreviewActionData>(400, {
				pageEdit: {
					values: { changePrompt },
					message: 'Describe the landing page change you want to apply.',
					success: false
				}
			});
		}

		try {
			const result = await runLandingPageEditFromPrompt(candidatePageId, changePrompt);

			return {
				pageEdit: {
					values: { changePrompt: '' },
					success: true,
					message: 'Landing page updated.',
					campaignPageId: result.campaignPageId
				}
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return fail<LandingPagePreviewActionData>(500, {
				pageEdit: {
					values: { changePrompt },
					message: `Landing page edit failed: ${message}`,
					success: false
				}
			});
		}
	}
};
