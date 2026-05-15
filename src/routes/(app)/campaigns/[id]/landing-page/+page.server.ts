import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { christophSampleLandingPage, parseLandingPageDocument } from '$lib/page-builder/page';
import { db } from '$lib/server/db';
import {
	campaign_ad_groups,
	campaign_ad_packages,
	campaign_pages,
	keynotes,
	logos
} from '$lib/server/db/schema';
import { asc, desc, eq } from 'drizzle-orm';
import { runLandingPageEditFromPrompt } from '$lib/server/agents/landing-page-editor';
import { getCampaignById } from '$lib/server/campaigns/client';
import {
	persistGeneratedLandingPage,
	runLandingPageGenerationForCampaign
} from '$lib/server/agents/landing-page-pipeline';

function isMissingChangeNoteColumnError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	const message = error.message.toLowerCase();
	return message.includes('change_note') && message.includes('does not exist');
}

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

export const load: PageServerLoad = async ({ params, url }) => {
	const campaignId = Number(params.id);

	if (!Number.isFinite(campaignId) || campaignId <= 0) {
		throw error(400, 'Invalid campaign id');
	}

	const campaign = await getCampaignById(campaignId);
	if (!campaign) {
		throw error(404, 'Campaign not found');
	}

	let pageRecords: Array<{
		structuredContentJson: unknown;
		campaignPageId: number;
		versionNumber: number;
		changeNote: string | null;
		slug: string;
		createdAt: Date;
	}> = [];

	try {
		pageRecords = await db
			.select({
				structuredContentJson: campaign_pages.structured_content_json,
				campaignPageId: campaign_pages.id,
				versionNumber: campaign_pages.version_number,
				changeNote: campaign_pages.change_note,
				slug: campaign_pages.slug,
				createdAt: campaign_pages.created_at
			})
			.from(campaign_pages)
			.where(eq(campaign_pages.campaign_id, campaignId))
			.orderBy(desc(campaign_pages.version_number))
			.limit(30);
	} catch (error) {
		if (!isMissingChangeNoteColumnError(error)) {
			throw error;
		}

		const legacyRecords = await db
			.select({
				structuredContentJson: campaign_pages.structured_content_json,
				campaignPageId: campaign_pages.id,
				versionNumber: campaign_pages.version_number,
				slug: campaign_pages.slug,
				createdAt: campaign_pages.created_at
			})
			.from(campaign_pages)
			.where(eq(campaign_pages.campaign_id, campaignId))
			.orderBy(desc(campaign_pages.version_number))
			.limit(30);

		pageRecords = legacyRecords.map((record) => ({ ...record, changeNote: null }));
	}

	const [latestPageRecord] = pageRecords;
	const requestedVersionPageId = Number(url.searchParams.get('version'));
	const selectedPageRecord =
		Number.isFinite(requestedVersionPageId) && requestedVersionPageId > 0
			? (pageRecords.find((record) => record.campaignPageId === requestedVersionPageId) ??
				latestPageRecord)
			: latestPageRecord;

	const page = selectedPageRecord
		? parseLandingPageDocument(selectedPageRecord.structuredContentJson)
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
		campaignPageId: selectedPageRecord?.campaignPageId ?? null,
		latestCampaignPageId: latestPageRecord?.campaignPageId ?? null,
		versionHistory: pageRecords.map((record) => ({
			id: record.campaignPageId,
			versionNumber: record.versionNumber,
			changeNote: record.changeNote,
			slug: record.slug,
			createdAt: record.createdAt
		})),
		campaignStatus: campaign.status
	};
};

export const actions: Actions = {
	retryGeneration: async ({ params }) => {
		const campaignId = Number(params.id);
		if (!Number.isFinite(campaignId) || campaignId <= 0) {
			return fail<LandingPagePreviewActionData>(400, {
				pageEdit: {
					values: { changePrompt: '' },
					message: 'Invalid campaign id.',
					success: false
				}
			});
		}

		const campaign = await getCampaignById(campaignId);
		if (!campaign) {
			return fail<LandingPagePreviewActionData>(404, {
				pageEdit: {
					values: { changePrompt: '' },
					message: 'Campaign not found.',
					success: false
				}
			});
		}

		if (campaign.status === 'published') {
			return fail<LandingPagePreviewActionData>(400, {
				pageEdit: {
					values: { changePrompt: '' },
					message: 'Cannot retry generation while campaign is published. Archive first.',
					success: false
				}
			});
		}

		try {
			const result = await runLandingPageGenerationForCampaign(campaignId);
			return {
				pageEdit: {
					values: { changePrompt: '' },
					success: true,
					message: 'Landing page regenerated.',
					campaignPageId: result.campaignPageId
				}
			};
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			return fail<LandingPagePreviewActionData>(500, {
				pageEdit: {
					values: { changePrompt: '' },
					message: `Landing page regeneration failed: ${detail}`,
					success: false
				}
			});
		}
	},
	editPage: async ({ request, params }) => {
		const formData = await request.formData();
		const candidatePageId = Number(formData.get('campaignPageId'));
		const changePrompt = formData.get('change_prompt')?.toString().trim() ?? '';
		const campaignId = Number(params.id);

		if (!Number.isFinite(campaignId) || campaignId <= 0) {
			return fail<LandingPagePreviewActionData>(400, {
				pageEdit: {
					values: { changePrompt },
					message: 'Invalid campaign id.',
					success: false
				}
			});
		}

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

		const [latestPageRecord] = await db
			.select({
				id: campaign_pages.id
			})
			.from(campaign_pages)
			.where(eq(campaign_pages.campaign_id, campaignId))
			.orderBy(desc(campaign_pages.version_number))
			.limit(1);

		if (!latestPageRecord || latestPageRecord.id !== candidatePageId) {
			return fail<LandingPagePreviewActionData>(400, {
				pageEdit: {
					values: { changePrompt },
					message: 'AI edits are only available on the latest landing page version.',
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

		const persisted = await persistGeneratedLandingPage(
			pageRecord.campaignId,
			updatedPage,
			undefined,
			'Updated trust logos'
		);

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

		const persisted = await persistGeneratedLandingPage(
			pageRecord.campaignId,
			updatedPage,
			undefined,
			'Updated keynotes'
		);

		return {
			pageEdit: {
				values: { changePrompt: '' },
				success: true,
				message: 'Keynotes updated.',
				campaignPageId: persisted.campaignPageId
			}
		};
	},
	restoreVersion: async ({ request, params }) => {
		const campaignId = Number(params.id);
		const formData = await request.formData();
		const selectedPageId = Number(formData.get('campaignPageId'));

		if (!Number.isFinite(campaignId) || campaignId <= 0) {
			return fail<LandingPagePreviewActionData>(400, {
				pageEdit: {
					values: { changePrompt: '' },
					message: 'Invalid campaign id.',
					success: false
				}
			});
		}

		const campaign = await getCampaignById(campaignId);
		if (!campaign) {
			return fail<LandingPagePreviewActionData>(404, {
				pageEdit: {
					values: { changePrompt: '' },
					message: 'Campaign not found.',
					success: false
				}
			});
		}

		if (campaign.status === 'published') {
			return fail<LandingPagePreviewActionData>(400, {
				pageEdit: {
					values: { changePrompt: '' },
					message: 'Cannot restore landing page while campaign is published. Archive first.',
					success: false
				}
			});
		}

		if (!Number.isFinite(selectedPageId) || selectedPageId <= 0) {
			return fail<LandingPagePreviewActionData>(400, {
				pageEdit: {
					values: { changePrompt: '' },
					message: 'Select a valid version to restore.',
					success: false
				}
			});
		}

		const [sourcePage] = await db
			.select({
				campaignId: campaign_pages.campaign_id,
				structuredContentJson: campaign_pages.structured_content_json,
				versionNumber: campaign_pages.version_number
			})
			.from(campaign_pages)
			.where(eq(campaign_pages.id, selectedPageId))
			.limit(1);

		if (!sourcePage || sourcePage.campaignId !== campaignId) {
			return fail<LandingPagePreviewActionData>(404, {
				pageEdit: {
					values: { changePrompt: '' },
					message: 'Selected version was not found for this campaign.',
					success: false
				}
			});
		}

		const pageToRestore = parseLandingPageDocument(sourcePage.structuredContentJson);
		const restored = await db.transaction(async (tx) => {
			const persisted = await persistGeneratedLandingPage(
				campaignId,
				pageToRestore,
				tx,
				`Restored from v${sourcePage.versionNumber}`
			);
			const [latestAdPackage] = await tx
				.select({ id: campaign_ad_packages.id })
				.from(campaign_ad_packages)
				.where(eq(campaign_ad_packages.campaign_id, campaignId))
				.orderBy(desc(campaign_ad_packages.version_number))
				.limit(1);

			if (latestAdPackage) {
				await tx
					.update(campaign_ad_groups)
					.set({ campaign_page_id: persisted.campaignPageId, updated_at: new Date() })
					.where(eq(campaign_ad_groups.ad_package_id, latestAdPackage.id));
			}

			return persisted;
		});

		return {
			pageEdit: {
				values: { changePrompt: '' },
				success: true,
				message: `Restored version v${sourcePage.versionNumber} as the latest landing page.`,
				campaignPageId: restored.campaignPageId
			}
		};
	}
};
