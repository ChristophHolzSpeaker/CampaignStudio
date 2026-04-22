import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { christophSampleLandingPage, parseLandingPageDocument } from '$lib/page-builder/page';
import { db } from '$lib/server/db';
import { campaign_pages, campaigns } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { runLandingPageEditFromPrompt } from '$lib/server/agents/landing-page-editor';

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

export const load: PageServerLoad = async ({ url }) => {
	const candidatePageId = url.searchParams.get('campaignPageId');

	if (!candidatePageId) {
		const page = parseLandingPageDocument(christophSampleLandingPage);

		return {
			page,
			campaignId: null,
			campaignPageId: null,
			campaignStatus: null
		};
	}

	const campaignPageId = Number(candidatePageId);
	if (!Number.isFinite(campaignPageId) || campaignPageId <= 0) {
		throw error(400, 'Invalid campaignPageId');
	}

	const [pageRecord] = await db
		.select({
			structuredContentJson: campaign_pages.structured_content_json,
			campaignId: campaign_pages.campaign_id,
			campaignPageId: campaign_pages.id,
			campaignStatus: campaigns.status
		})
		.from(campaign_pages)
		.innerJoin(campaigns, eq(campaigns.id, campaign_pages.campaign_id))
		.where(eq(campaign_pages.id, campaignPageId))
		.limit(1);

	if (!pageRecord) {
		throw error(404, `Campaign page ${campaignPageId} not found`);
	}

	const page = parseLandingPageDocument(pageRecord.structuredContentJson);

	return {
		page,
		campaignId: pageRecord.campaignId,
		campaignPageId: pageRecord.campaignPageId,
		campaignStatus: pageRecord.campaignStatus
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
