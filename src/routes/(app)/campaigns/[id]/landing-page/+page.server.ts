import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { landingPageDocumentSchema, parseLandingPageDocument } from '$lib/page-builder/page';
import { db } from '$lib/server/db';
import {
	campaign_ad_groups,
	campaign_ad_packages,
	campaign_pages,
	keynotes,
	logos
} from '$lib/server/db/schema';
import { and, asc, desc, eq } from 'drizzle-orm';
import {
	buildLandingPageEditPreview,
	type LandingPageEditPreview
} from '$lib/server/agents/landing-page-editor';
import { getCampaignById } from '$lib/server/campaigns/client';
import {
	persistGeneratedLandingPage,
	runLandingPageGenerationForCampaign
} from '$lib/server/agents/landing-page-pipeline';
import { z } from 'zod';

type LandingPageEditFormState = {
	values: {
		changePrompt: string;
		autoApplySimple?: boolean;
	};
	preview?: LandingPageEditPreview;
	message?: string;
	success?: boolean;
	campaignPageId?: number;
};

const previewModeSchema = z.enum(['preview', 'accept', 'reject']);

const editPreviewPayloadSchema = z.object({
	baseCampaignPageId: z.number().int().positive(),
	changePrompt: z.string().trim().min(1),
	editedPage: landingPageDocumentSchema,
	operationTypes: z.array(z.string().trim().min(1)),
	changeSummary: z.object({
		impactedSections: z.array(z.string()),
		contentChanges: z.array(z.string()),
		layoutChanges: z.array(z.string()),
		mediaChanges: z.array(z.string()),
		reorderedSections: z.array(z.string()),
		fieldDiffs: z.array(
			z.object({
				sectionType: z.string(),
				field: z.string(),
				before: z.string(),
				after: z.string()
			})
		)
	})
});

function isSimplePreview(preview: LandingPageEditPreview): boolean {
	const hasOnlyContentOps = preview.operationTypes.every((operationType) =>
		['update_section_content', 'update_section_layout'].includes(operationType)
	);
	return (
		hasOnlyContentOps &&
		preview.changeSummary.impactedSections.length === 1 &&
		preview.changeSummary.mediaChanges.length === 0 &&
		preview.changeSummary.reorderedSections.length === 0 &&
		preview.changeSummary.fieldDiffs.length <= 3
	);
}

async function persistAcceptedPreview(
	candidatePageId: number,
	previewPayload: LandingPageEditPreview
): Promise<{ campaignPageId: number }> {
	const normalizedPrompt = previewPayload.changePrompt.replace(/\s+/g, ' ').trim();
	const operationSummary = previewPayload.operationTypes.join(', ');
	const changeNote = `AI edit (${operationSummary}): ${normalizedPrompt.slice(0, 140)}${
		normalizedPrompt.length > 140 ? '...' : ''
	}`;

	const createdPage = await db.transaction(async (tx) => {
		const [pageRecord] = await tx
			.select({ campaignId: campaign_pages.campaign_id })
			.from(campaign_pages)
			.where(eq(campaign_pages.id, candidatePageId))
			.limit(1);

		if (!pageRecord) {
			throw new Error('Campaign page not found while saving preview.');
		}

		const persisted = await persistGeneratedLandingPage(
			pageRecord.campaignId,
			previewPayload.editedPage,
			tx,
			changeNote
		);

		const [latestAdPackage] = await tx
			.select({ id: campaign_ad_packages.id })
			.from(campaign_ad_packages)
			.where(eq(campaign_ad_packages.campaign_id, pageRecord.campaignId))
			.orderBy(desc(campaign_ad_packages.version_number))
			.limit(1);

		if (latestAdPackage) {
			await tx
				.update(campaign_ad_groups)
				.set({ campaign_page_id: persisted.campaignPageId, updated_at: new Date() })
				.where(
					and(
						eq(campaign_ad_groups.campaign_page_id, candidatePageId),
						eq(campaign_ad_groups.ad_package_id, latestAdPackage.id)
					)
				);
		}

		return persisted;
	});

	return { campaignPageId: createdPage.campaignPageId };
}

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

	if (url.searchParams.get('version') != null) {
		const requestedVersion = Number(url.searchParams.get('version'));
		if (!Number.isFinite(requestedVersion) || requestedVersion <= 0) {
			throw error(400, 'Invalid version id');
		}
	}

	return {};
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
		const autoApplySimple = formData.get('auto_apply_simple')?.toString() === 'on';
		const mode = previewModeSchema.safeParse(formData.get('mode')?.toString().trim() ?? 'preview');
		const campaignId = Number(params.id);

		if (!mode.success) {
			return fail<LandingPagePreviewActionData>(400, {
				pageEdit: {
					values: { changePrompt },
					message: 'Invalid edit mode.',
					success: false
				}
			});
		}

		if (mode.data === 'reject') {
			return {
				pageEdit: {
					values: { changePrompt: '', autoApplySimple },
					success: true,
					message: 'Edit preview discarded.'
				}
			};
		}

		if (!Number.isFinite(campaignId) || campaignId <= 0) {
			return fail<LandingPagePreviewActionData>(400, {
				pageEdit: {
					values: { changePrompt, autoApplySimple },
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

		if (!changePrompt.length && mode.data === 'preview') {
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

		if (mode.data === 'preview') {
			try {
				const result = await buildLandingPageEditPreview(candidatePageId, changePrompt);
				if (autoApplySimple && isSimplePreview(result.preview)) {
					const persisted = await persistAcceptedPreview(candidatePageId, result.preview);
					return {
						pageEdit: {
							values: { changePrompt: '', autoApplySimple },
							success: true,
							message: 'Simple edit auto-applied.',
							campaignPageId: persisted.campaignPageId
						}
					};
				}

				return {
					pageEdit: {
						values: { changePrompt, autoApplySimple },
						success: true,
						message: 'Preview generated. Review changes before saving.',
						preview: result.preview
					}
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return fail<LandingPagePreviewActionData>(500, {
					pageEdit: {
						values: { changePrompt, autoApplySimple },
						message: `Landing page edit preview failed: ${message}`,
						success: false
					}
				});
			}
		}

		const rawPreviewPayload = formData.get('preview_payload')?.toString() ?? '';
		let parsedPreviewPayload: LandingPageEditPreview;
		try {
			const parsedJson = JSON.parse(rawPreviewPayload);
			const parsed = editPreviewPayloadSchema.safeParse(parsedJson);
			if (!parsed.success) {
				return fail<LandingPagePreviewActionData>(400, {
					pageEdit: {
						values: { changePrompt },
						message: 'Preview payload is invalid. Regenerate preview before saving.',
						success: false
					}
				});
			}
			parsedPreviewPayload = parsed.data as LandingPageEditPreview;
		} catch {
			return fail<LandingPagePreviewActionData>(400, {
				pageEdit: {
					values: { changePrompt },
					message: 'Preview payload is missing. Regenerate preview before saving.',
					success: false
				}
			});
		}

		if (parsedPreviewPayload.baseCampaignPageId !== candidatePageId) {
			return fail<LandingPagePreviewActionData>(400, {
				pageEdit: {
					values: { changePrompt },
					message: 'Preview does not match the selected campaign page version.',
					success: false
				}
			});
		}

		try {
			const createdPage = await persistAcceptedPreview(candidatePageId, parsedPreviewPayload);

			return {
				pageEdit: {
					values: { changePrompt: '', autoApplySimple },
					success: true,
					message: 'Landing page updated from preview.',
					campaignPageId: createdPage.campaignPageId
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
