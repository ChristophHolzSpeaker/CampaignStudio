import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { christophSampleLandingPage, parseLandingPageDocument } from '$lib/page-builder/page';
import { db } from '$lib/server/db';
import { campaign_pages, keynotes, logos } from '$lib/server/db/schema';
import { asc, desc, eq } from 'drizzle-orm';
import { runLandingPageEditFromPrompt } from '$lib/server/agents/landing-page-editor';
import { getCampaignById } from '$lib/server/campaigns/client';
import { persistGeneratedLandingPage } from '$lib/server/agents/landing-page-pipeline';

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

	const availableLogos = await db
		.select({
			id: logos.id,
			name: logos.name,
			logoUrl: logos.logo_url,
			logoAlt: logos.logo_alt
		})
		.from(logos)
		.where(eq(logos.is_active, true))
		.orderBy(asc(logos.priority), asc(logos.name), asc(logos.id));

	const availableKeynotes = await db
		.select({
			id: keynotes.id,
			title: keynotes.keynote_title,
			summary: keynotes.keynote_summary,
			imageUrl: keynotes.image_url,
			imageAlt: keynotes.image_alt
		})
		.from(keynotes)
		.where(eq(keynotes.is_active, true))
		.orderBy(asc(keynotes.keynote_title), asc(keynotes.id));

	return {
		page,
		availableLogos,
		availableKeynotes,
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
	},
	setLogos: async ({ request }) => {
		const formData = await request.formData();
		const candidatePageId = Number(formData.get('campaignPageId'));
		const selectedLogoIds = formData
			.getAll('logoIds')
			.map((value) => value.toString().trim())
			.filter((value) => value.length > 0)
			.slice(0, 4);

		if (!Number.isFinite(candidatePageId) || candidatePageId <= 0) {
			return fail<LandingPagePreviewActionData>(400, {
				pageEdit: {
					values: { changePrompt: '' },
					message: 'Select a valid campaign page before setting logos.',
					success: false
				}
			});
		}

		if (selectedLogoIds.length === 0) {
			return fail<LandingPagePreviewActionData>(400, {
				pageEdit: {
					values: { changePrompt: '' },
					message: 'Choose at least one logo.',
					success: false
				}
			});
		}

		const [pageRecord] = await db
			.select({
				campaignId: campaign_pages.campaign_id,
				structuredContentJson: campaign_pages.structured_content_json
			})
			.from(campaign_pages)
			.where(eq(campaign_pages.id, candidatePageId))
			.limit(1);

		if (!pageRecord) {
			return fail<LandingPagePreviewActionData>(404, {
				pageEdit: {
					values: { changePrompt: '' },
					message: 'Campaign page not found.',
					success: false
				}
			});
		}

		const availableLogos = await db
			.select({
				id: logos.id,
				name: logos.name,
				logoUrl: logos.logo_url,
				logoAlt: logos.logo_alt
			})
			.from(logos)
			.where(eq(logos.is_active, true))
			.orderBy(asc(logos.priority), asc(logos.name), asc(logos.id));

		const logosById = new Map(availableLogos.map((logo) => [logo.id, logo]));
		const resolvedLogos = selectedLogoIds
			.map((id) => logosById.get(id))
			.filter((logo): logo is NonNullable<typeof logo> => Boolean(logo))
			.map((logo) => ({ name: logo.name, imageUrl: logo.logoUrl, alt: logo.logoAlt }));

		if (resolvedLogos.length === 0) {
			return fail<LandingPagePreviewActionData>(400, {
				pageEdit: {
					values: { changePrompt: '' },
					message: 'Selected logos are not available.',
					success: false
				}
			});
		}

		const page = parseLandingPageDocument(pageRecord.structuredContentJson);
		const updatedPage = {
			...page,
			sections: page.sections.map((section) =>
				section.type === 'logos_of_trust_ribbon'
					? { ...section, props: { ...section.props, logos: resolvedLogos } }
					: section
			)
		};

		const persisted = await persistGeneratedLandingPage(pageRecord.campaignId, updatedPage);

		return {
			pageEdit: {
				values: { changePrompt: '' },
				success: true,
				message: 'Logos updated.',
				campaignPageId: persisted.campaignPageId
			}
		};
	},
	setKeynotes: async ({ request }) => {
		const formData = await request.formData();
		const candidatePageId = Number(formData.get('campaignPageId'));
		const selectedKeynoteIds = formData
			.getAll('keynoteIds')
			.map((value) => value.toString().trim())
			.filter((value) => value.length > 0)
			.slice(0, 3);

		if (!Number.isFinite(candidatePageId) || candidatePageId <= 0) {
			return fail<LandingPagePreviewActionData>(400, {
				pageEdit: {
					values: { changePrompt: '' },
					message: 'Select a valid campaign page before setting keynotes.',
					success: false
				}
			});
		}

		if (selectedKeynoteIds.length !== 3) {
			return fail<LandingPagePreviewActionData>(400, {
				pageEdit: {
					values: { changePrompt: '' },
					message: 'Select exactly 3 keynotes.',
					success: false
				}
			});
		}

		const [pageRecord] = await db
			.select({
				campaignId: campaign_pages.campaign_id,
				structuredContentJson: campaign_pages.structured_content_json
			})
			.from(campaign_pages)
			.where(eq(campaign_pages.id, candidatePageId))
			.limit(1);

		if (!pageRecord) {
			return fail<LandingPagePreviewActionData>(404, {
				pageEdit: {
					values: { changePrompt: '' },
					message: 'Campaign page not found.',
					success: false
				}
			});
		}

		const availableKeynotes = await db
			.select({
				id: keynotes.id,
				title: keynotes.keynote_title,
				summary: keynotes.keynote_summary,
				imageUrl: keynotes.image_url
			})
			.from(keynotes)
			.where(eq(keynotes.is_active, true))
			.orderBy(asc(keynotes.keynote_title), asc(keynotes.id));

		const keynotesById = new Map(availableKeynotes.map((keynote) => [keynote.id, keynote]));
		const resolvedKeynotes = selectedKeynoteIds
			.map((id) => keynotesById.get(id))
			.filter((keynote): keynote is NonNullable<typeof keynote> => Boolean(keynote))
			.map((keynote) => ({
				id: keynote.id,
				title: keynote.title,
				imageUrl: keynote.imageUrl,
				summary: keynote.summary
			}));

		if (resolvedKeynotes.length !== 3) {
			return fail<LandingPagePreviewActionData>(400, {
				pageEdit: {
					values: { changePrompt: '' },
					message: 'Selected keynotes are not available.',
					success: false
				}
			});
		}

		const page = parseLandingPageDocument(pageRecord.structuredContentJson);
		const keynoteSectionExists = page.sections.some(
			(section) => section.type === 'keynote_speeches'
		);
		if (!keynoteSectionExists) {
			return fail<LandingPagePreviewActionData>(400, {
				pageEdit: {
					values: { changePrompt: '' },
					message: 'This page has no keynote section to update.',
					success: false
				}
			});
		}

		const updatedPage = {
			...page,
			sections: page.sections.map((section) =>
				section.type === 'keynote_speeches'
					? {
							...section,
							props: {
								...section.props,
								keynoteIds: selectedKeynoteIds,
								keynotes: resolvedKeynotes
							}
						}
					: section
			)
		};

		const persisted = await persistGeneratedLandingPage(pageRecord.campaignId, updatedPage);

		return {
			pageEdit: {
				values: { changePrompt: '' },
				success: true,
				message: 'Keynotes updated.',
				campaignPageId: persisted.campaignPageId
			}
		};
	}
};
