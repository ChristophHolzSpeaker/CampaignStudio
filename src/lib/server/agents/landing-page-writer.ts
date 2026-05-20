import type { LandingPageDocument } from '$lib/page-builder/page';
import type { HybridPrimaryVisual, PageSectionType } from '$lib/page-builder/sections';
import type { PageSection } from '$lib/page-builder/sections';
import { traceLlm, type LlmTraceContext } from '$lib/server/telemetry/llm-trace';
import type { ZodIssue } from 'zod';
import {
	buildLandingPageWriterSystemPrompt,
	landingPageWriterUserPrompt
} from './prompts/landing-page';
import { resolvePromptGuidanceForCampaign } from './prompt-guidance';
import { buildSectionCatalog } from './section-catalog';
import { requiredMvpCapabilities, resolvePreferredSectionOrder } from './section-definitions';
import {
	runLandingPageWriterGeneration,
	runLandingPageWriterRepair
} from './landing-page-generation-runner';
import { validateWithHydrationPipeline } from './landing-page-hydration';
import {
	collectLandingPageDocumentMvpIssues,
	validateLandingPageDocumentForMvp
} from './landing-page-policy';
import { getSectionEligibility } from './section-eligibility';
import type { LandingPageGenerationInput } from './schemas/landing-page-input';
import type { LandingPagePlan } from './schemas/landing-page-plan';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function inferBenefitTitle(value: string, index: number): string {
	const [head] = value.split(/[.:,-]/);
	const candidate = head?.trim();
	if (candidate && candidate.length >= 6 && candidate.length <= 64) {
		return candidate;
	}

	return `Audience outcome ${index + 1}`;
}

type HybridTextItem = {
	title: string;
	body: string;
};

type HybridBenefitItem = HybridTextItem & {
	imageUrl: string;
};

const inputFallbackBenefitBody =
	'Your audience leaves with practical outcomes they can apply immediately in their role.';

const finalFallbackHeroVideoEmbedUrl = 'https://www.youtube.com/watch?v=mpbtCg2NSUs';
const finalFallbackHeroImageUrl =
	'https://cdn.prod.website-files.com/61263e0de406f497361dca55/6130408552ea140d707aab8e_christoph-contact-bg.jpg';
const finalFallbackHeroImageAlt = 'Keynote speaker presenting to a business audience';

const finalFallbackHybridImageUrls = [
	'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
	'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80',
	'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80'
];

function buildFallbackSpeakerMediaAssets(input: LandingPageGenerationInput): {
	assetId: string;
	title: string;
	videoEmbedUrl: string;
	thumbnailUrl: string;
	thumbnailAlt: string;
}[] {
	const fallbackVideoEmbedUrl =
		input.assets.heroDefaults.videoEmbedUrl || finalFallbackHeroVideoEmbedUrl;
	const fallbackThumbnailUrl =
		input.assets.heroDefaults.videoThumbnailUrl ??
		input.assets.heroDefaults.heroImageUrl ??
		finalFallbackHeroImageUrl;
	const fallbackThumbnailAlt =
		input.assets.heroDefaults.videoThumbnailAlt ??
		input.assets.heroDefaults.heroImageAlt ??
		finalFallbackHeroImageAlt;

	return Array.from({ length: 4 }, (_, index) => ({
		assetId: `fallback-speaker-${index + 1}`,
		title: `Speaker highlight ${index + 1}`,
		videoEmbedUrl: fallbackVideoEmbedUrl,
		thumbnailUrl: fallbackThumbnailUrl,
		thumbnailAlt: fallbackThumbnailAlt
	}));
}

function buildFallbackKeynotes(input: LandingPageGenerationInput): {
	id: string;
	title: string;
	imageUrl: string;
	summary: string;
}[] {
	const baseTopic = input.campaign.topic;
	const audience = input.campaign.audience;
	const fallbackImage =
		input.assets.heroDefaults.heroImageUrl ??
		input.assets.heroDefaults.videoThumbnailUrl ??
		finalFallbackHeroImageUrl;

	return [
		{
			id: 'fallback-keynote-1',
			title: `${baseTopic}: what leaders must decide now`,
			imageUrl: fallbackImage,
			summary: `A practical keynote for ${audience} focused on the most urgent decisions and immediate actions.`
		},
		{
			id: 'fallback-keynote-2',
			title: `${baseTopic}: from strategy to execution`,
			imageUrl: fallbackImage,
			summary: `A decision-oriented session that translates strategy into concrete execution steps for ${audience}.`
		},
		{
			id: 'fallback-keynote-3',
			title: `${baseTopic}: future trends, present impact`,
			imageUrl: fallbackImage,
			summary: `An outcome-focused view of emerging trends and how ${audience} can act on them now.`
		}
	];
}

function pickImageUrl(imageUrls: string[], index: number): string {
	const selected = imageUrls[index % imageUrls.length];
	if (!selected) {
		throw new Error(
			'Landing page writer: no approved hybrid benefit image available in media assets catalog.'
		);
	}

	return selected;
}

function buildBenefitImagePool(
	input: LandingPageGenerationInput,
	selectedPrimaryVisual: HybridPrimaryVisual | null,
	props: Record<string, unknown>
): string[] {
	const selectedUrls = [getString(selectedPrimaryVisual?.imageUrl)].filter(
		(value): value is string => Boolean(value)
	);
	if (selectedUrls.length > 0) {
		return selectedUrls;
	}

	const catalogUrls = input.assets.assetCatalog.hybridSupportingImages
		.map((item) => getString(item.imageUrl))
		.filter((value): value is string => Boolean(value));
	if (catalogUrls.length > 0) {
		return catalogUrls;
	}

	const rawSupportingVisualItems = Array.isArray(props.supportingVisualItems)
		? props.supportingVisualItems
		: [];
	const existingUrls = rawSupportingVisualItems
		.map((item) => (isRecord(item) ? getString(item.imageUrl) : undefined))
		.filter((value): value is string => Boolean(value));
	if (existingUrls.length > 0) {
		return existingUrls;
	}

	return finalFallbackHybridImageUrls;
}

function resolveLegacyPrimaryVisualFromProps(
	props: Record<string, unknown>
): HybridPrimaryVisual | null {
	const rawPrimaryVisual = isRecord(props.primaryVisual) ? props.primaryVisual : null;
	if (rawPrimaryVisual) {
		const imageUrl = getString(rawPrimaryVisual.imageUrl);
		const alt = getString(rawPrimaryVisual.alt);
		if (imageUrl && alt) {
			return {
				imageUrl,
				alt,
				caption: getString(rawPrimaryVisual.caption)
			};
		}
	}

	const rawSupportingVisualItems = Array.isArray(props.supportingVisualItems)
		? props.supportingVisualItems
		: [];
	const firstLegacyItem = rawSupportingVisualItems[0];
	if (!isRecord(firstLegacyItem)) {
		return null;
	}

	const imageUrl = getString(firstLegacyItem.imageUrl);
	const alt = getString(firstLegacyItem.alt);
	if (!imageUrl || !alt) {
		return null;
	}

	return {
		imageUrl,
		alt,
		caption: getString(firstLegacyItem.caption)
	};
}

function buildHybridBenefitFallbacks(input: LandingPageGenerationInput): HybridTextItem[] {
	const audience = input.campaign.audience;
	const topic = input.campaign.topic;
	const format = input.campaign.format;

	return [
		{
			title: 'Decision-ready understanding',
			body: `${audience} leave this ${format} with a clear understanding of ${topic} and what matters most now.`
		},
		{
			title: 'Practical application playbook',
			body: `${audience} get concrete ways to apply ${topic} insights in the exact decisions and workflows this ${format} is designed to influence.`
		},
		{
			title: 'Immediate next actions',
			body: `${audience} walk away with specific next actions they can execute right after the ${format} to convert ${topic} into measurable progress.`
		}
	];
}

function normalizeBenefitsToThree(
	normalizedBenefits: HybridTextItem[],
	fallbackBenefits: HybridTextItem[],
	benefitImageUrls: string[]
): HybridBenefitItem[] {
	let resolvedTextBenefits: HybridTextItem[];

	if (normalizedBenefits.length >= 3) {
		resolvedTextBenefits = normalizedBenefits.slice(0, 3);
	} else if (normalizedBenefits.length === 0) {
		resolvedTextBenefits = fallbackBenefits;
	} else {
		const usedTitles = new Set(normalizedBenefits.map((benefit) => benefit.title));
		const result = [...normalizedBenefits];

		for (const fallback of fallbackBenefits) {
			if (result.length >= 3) {
				break;
			}

			if (usedTitles.has(fallback.title)) {
				continue;
			}

			result.push(fallback);
			usedTitles.add(fallback.title);
		}

		while (result.length < 3) {
			result.push({
				title: `Audience outcome ${result.length + 1}`,
				body: inputFallbackBenefitBody
			});
		}

		resolvedTextBenefits = result;
	}

	return resolvedTextBenefits.map((benefit, index) => ({
		...benefit,
		imageUrl: pickImageUrl(benefitImageUrls, index)
	}));
}

function buildWhyChristophFallbacks(
	input: LandingPageGenerationInput,
	benefits: HybridTextItem[]
): HybridTextItem[] {
	const audience = input.campaign.audience;
	const topic = input.campaign.topic;
	const format = input.campaign.format;

	return [
		{
			title: 'Proven translator of complex AI',
			body: `Christoph has a track record of turning complex ${topic} shifts into clear decisions that ${audience} can act on immediately.`
		},
		{
			title: 'Built for this audience and format',
			body: `He structures each ${format} for ${audience}, balancing strategic perspective with practical guidance that can be used the same day.`
		},
		{
			title: 'Outcome-focused delivery',
			body: `His approach is designed to deliver outcomes like ${benefits[0]?.title?.toLowerCase() ?? 'clear next steps'}, not abstract theory.`
		}
	];
}

function resolveHeroVideoSelection(
	input: LandingPageGenerationInput,
	plan: LandingPagePlan
): LandingPageGenerationInput['assets']['assetCatalog']['heroVideos'][number] | null {
	const selectedId = plan.assetPlan?.hero?.videoAssetId;
	if (!selectedId) {
		return null;
	}

	const selected = input.assets.assetCatalog.heroVideos.find((asset) => asset.id === selectedId);
	if (!selected) {
		console.warn(
			`Landing page writer: hero asset selection '${selectedId}' not found in approved catalog; using fallback defaults.`
		);
		return null;
	}

	return selected;
}

function resolveHeroImageSelection(
	input: LandingPageGenerationInput,
	plan: LandingPagePlan
): LandingPageGenerationInput['assets']['assetCatalog']['heroImages'][number] | null {
	const selectedId = plan.assetPlan?.hero?.imageAssetId;
	if (!selectedId) {
		return null;
	}

	const selected = input.assets.assetCatalog.heroImages.find((asset) => asset.id === selectedId);
	if (!selected) {
		console.warn(
			`Landing page writer: hero image asset selection '${selectedId}' not found in approved catalog; using fallback defaults.`
		);
		return null;
	}

	return selected;
}

function resolveHybridPrimaryVisualSelection(
	input: LandingPageGenerationInput,
	plan: LandingPagePlan
): HybridPrimaryVisual | null {
	const selectedId = plan.assetPlan?.hybridContentSection?.primaryImageAssetId;
	if (!selectedId) {
		return null;
	}

	const catalogById = new Map(
		input.assets.assetCatalog.hybridSupportingImages.map((asset) => [asset.id, asset])
	);
	const selected = catalogById.get(selectedId);
	if (!selected) {
		console.warn(
			`Landing page writer: hybrid primary image '${selectedId}' not found in approved catalog; using fallback values.`
		);
		return null;
	}

	return {
		imageUrl: selected.imageUrl,
		alt: selected.alt,
		caption: selected.caption
	};
}

function resolveSpeakerInActionSelection(
	input: LandingPageGenerationInput,
	plan: LandingPagePlan
): {
	assetId: string;
	title: string;
	videoEmbedUrl: string;
	thumbnailUrl: string;
	thumbnailAlt: string;
}[] {
	const selectedIds = plan.assetPlan?.speakerInAction?.videoAssetIds ?? [];
	const catalog = input.assets.assetCatalog.speakerInActionVideos;
	const catalogById = new Map(catalog.map((asset) => [asset.id, asset]));
	const resolved: {
		assetId: string;
		title: string;
		videoEmbedUrl: string;
		thumbnailUrl: string;
		thumbnailAlt: string;
	}[] = [];

	for (const id of selectedIds) {
		const selected = catalogById.get(id);
		if (!selected) {
			console.warn(
				`Landing page writer: youtube_grid video '${id}' not found in approved catalog; skipping this asset.`
			);
			continue;
		}

		resolved.push({
			assetId: selected.id,
			title: selected.title,
			videoEmbedUrl: selected.videoEmbedUrl,
			thumbnailUrl: selected.videoThumbnailUrl,
			thumbnailAlt: selected.videoThumbnailAlt
		});
	}

	if (resolved.length >= 4) {
		return resolved.slice(0, 4);
	}

	for (const fallbackAsset of catalog) {
		if (resolved.length >= 4) {
			break;
		}

		if (resolved.some((item) => item.assetId === fallbackAsset.id)) {
			continue;
		}

		resolved.push({
			assetId: fallbackAsset.id,
			title: fallbackAsset.title,
			videoEmbedUrl: fallbackAsset.videoEmbedUrl,
			thumbnailUrl: fallbackAsset.videoThumbnailUrl,
			thumbnailAlt: fallbackAsset.videoThumbnailAlt
		});
	}

	if (resolved.length < 4) {
		const fallbackMedia = buildFallbackSpeakerMediaAssets(input);
		for (const fallback of fallbackMedia) {
			if (resolved.length >= 4) {
				break;
			}

			resolved.push(fallback);
		}
	}

	return resolved.slice(0, 4);
}

function resolveLogosOfTrustSelection(
	input: LandingPageGenerationInput,
	_plan: LandingPagePlan
): { name: string; imageUrl: string; alt: string }[] {
	const logoCatalog = input.assets.assetCatalog.logoCatalog;
	if (logoCatalog.length === 0) {
		return input.assets.fixedLogosRibbon.logos.slice(0, 4);
	}

	const fallbackFromCatalog = logoCatalog.slice(0, 4).map((logo) => ({
		name: logo.name,
		imageUrl: logo.logoUrl,
		alt: logo.logoAlt
	}));

	if (fallbackFromCatalog.length >= 1) {
		return fallbackFromCatalog;
	}

	const fixedFallback = input.assets.fixedLogosRibbon.logos.slice(0, 4);
	if (fixedFallback.length >= 1) {
		return fixedFallback;
	}

	return [
		{
			name: 'Trusted organization',
			imageUrl: '/CeBIT-Logo.png',
			alt: 'Trusted organization logo'
		}
	];
}

function resolveKeynoteSelection(
	input: LandingPageGenerationInput,
	_plan: LandingPagePlan,
	requestedIds: string[] = []
): { id: string; title: string; imageUrl: string; summary: string }[] {
	const catalog = input.assets.assetCatalog.keynoteCatalog;
	const selectedIds = requestedIds;
	const catalogById = new Map(catalog.map((keynote) => [keynote.id, keynote]));
	const resolved: { id: string; title: string; imageUrl: string; summary: string }[] = [];

	for (const id of selectedIds) {
		const keynote = catalogById.get(id);
		if (!keynote) {
			console.warn(
				`Landing page writer: keynote '${id}' not found in approved catalog; skipping this keynote.`
			);
			continue;
		}

		resolved.push({
			id: keynote.id,
			title: keynote.title,
			imageUrl: keynote.imageUrl,
			summary: keynote.summary
		});
	}

	if (resolved.length >= 3) {
		return resolved.slice(0, 3);
	}

	const normalizeText = (value: string): string => value.trim().toLowerCase();
	const tokenizeText = (value: string): string[] =>
		normalizeText(value)
			.split(/[^a-z0-9]+/)
			.filter((token) => token.length >= 3);
	const contextTokens = new Set(
		[
			input.campaign.audience,
			input.campaign.topic,
			input.campaign.format,
			input.adPackage.messagingAngle,
			input.adGroup.intentSummary
		].flatMap((value) => tokenizeText(value))
	);
	const scoreKeynoteFit = (keynote: (typeof catalog)[number]): number => {
		if (contextTokens.size === 0) {
			return 0;
		}

		const weightedFields = [
			{ text: keynote.audience, weight: 4 },
			{ text: keynote.keynoteShort || keynote.summary, weight: 3 },
			{ text: keynote.title, weight: 2 },
			{ text: keynote.summary, weight: 1 }
		];

		let score = 0;
		for (const field of weightedFields) {
			const tokens = tokenizeText(field.text);
			if (tokens.length === 0) {
				continue;
			}

			for (const token of tokens) {
				if (contextTokens.has(token)) {
					score += field.weight;
				}
			}
		}

		return score;
	};

	const rankedCatalog = [...catalog].sort((left, right) => {
		const scoreDelta = scoreKeynoteFit(right) - scoreKeynoteFit(left);
		if (scoreDelta !== 0) {
			return scoreDelta;
		}

		return left.id.localeCompare(right.id);
	});

	for (const fallbackKeynote of rankedCatalog) {
		if (resolved.length >= 3) {
			break;
		}

		if (resolved.some((item) => item.id === fallbackKeynote.id)) {
			continue;
		}

		resolved.push({
			id: fallbackKeynote.id,
			title: fallbackKeynote.title,
			imageUrl: fallbackKeynote.imageUrl,
			summary: fallbackKeynote.summary
		});
	}

	if (resolved.length < 3) {
		const fallbackKeynotes = buildFallbackKeynotes(input);
		for (const fallbackKeynote of fallbackKeynotes) {
			if (resolved.length >= 3) {
				break;
			}

			if (resolved.some((item) => item.id === fallbackKeynote.id)) {
				continue;
			}

			resolved.push(fallbackKeynote);
		}
	}

	return resolved.slice(0, 3);
}

function hydrateSectionWithAssets(
	section: PageSection,
	input: LandingPageGenerationInput,
	plan: LandingPagePlan
): PageSection {
	const { assets } = input;

	switch (section.type) {
		case 'immediate_authority_hero': {
			const fallbackHeadline = `${plan.pageTitle}`;
			const fallbackSubheadline = input.adGroup.intentSummary || input.adPackage.messagingAngle;
			const selectedHeroVideo = resolveHeroVideoSelection(input, plan);
			const selectedHeroImage = resolveHeroImageSelection(input, plan);
			const primaryCtaLabel =
				section.props.primaryCtaLabel?.trim() || assets.heroDefaults.primaryCtaLabelDefault;
			const resolvedVideoThumbnailUrl =
				selectedHeroVideo?.videoThumbnailUrl ??
				section.props.videoThumbnailUrl ??
				assets.heroDefaults.videoThumbnailUrl ??
				assets.heroDefaults.heroImageUrl ??
				finalFallbackHeroImageUrl;
			const resolvedVideoThumbnailAlt =
				selectedHeroVideo?.videoThumbnailAlt ||
				section.props.videoThumbnailAlt ||
				assets.heroDefaults.videoThumbnailAlt ||
				assets.heroDefaults.heroImageAlt ||
				finalFallbackHeroImageAlt;
			const resolvedHeroImageUrl =
				selectedHeroImage?.imageUrl ??
				section.props.heroImageUrl ??
				assets.heroDefaults.heroImageUrl ??
				resolvedVideoThumbnailUrl;
			const resolvedHeroImageAlt =
				selectedHeroImage?.alt ||
				section.props.heroImageAlt ||
				assets.heroDefaults.heroImageAlt ||
				resolvedVideoThumbnailAlt;

			const ctaHref = section.props.primaryCtaHref ?? assets.heroDefaults.primaryCtaHref;
			const ctaAction = section.props.primaryCtaAction ?? assets.heroDefaults.primaryCtaAction;

			return {
				...section,
				props: {
					...section.props,
					headline: section.props.headline?.trim() || fallbackHeadline,
					subheadline: section.props.subheadline?.trim() || fallbackSubheadline,
					primaryCtaLabel,
					primaryCtaHref: ctaHref,
					primaryCtaAction: ctaAction,
					videoEmbedUrl:
						selectedHeroVideo?.videoEmbedUrl ??
						section.props.videoEmbedUrl ??
						assets.heroDefaults.videoEmbedUrl ??
						finalFallbackHeroVideoEmbedUrl,
					heroImageUrl: resolvedHeroImageUrl,
					heroImageAlt: resolvedHeroImageAlt,
					videoThumbnailUrl: resolvedVideoThumbnailUrl,
					videoThumbnailAlt: resolvedVideoThumbnailAlt
				}
			};
		}

		case 'logos_of_trust_ribbon': {
			const logos = resolveLogosOfTrustSelection(input, plan);
			return {
				...section,
				props: {
					...section.props,
					title: section.props.title ?? assets.fixedLogosRibbon.title,
					label: section.props.label ?? assets.fixedLogosRibbon.label,
					logos
				}
			};
		}

		case 'proof_of_performance': {
			return {
				...section,
				props: {
					...section.props,
					title: section.props.title ?? assets.fixedProofOfPerformance.title,
					testimonials: assets.fixedProofOfPerformance.testimonials
				}
			};
		}

		case 'keynote_speeches': {
			const keynoteIdsFromProps = Array.isArray(section.props.keynoteIds)
				? section.props.keynoteIds
						.map((value) => (typeof value === 'string' ? value.trim() : ''))
						.filter((value) => value.length > 0)
				: [];
			const keynotes = resolveKeynoteSelection(input, plan, keynoteIdsFromProps);

			return {
				...section,
				props: {
					...section.props,
					title: section.props.title?.trim() || 'Keynote topics that resonate with this audience',
					intro:
						section.props.intro?.trim() ||
						`Choose from proven keynote topics tailored for ${input.campaign.audience}. Each talk is optimized for ${input.campaign.format} impact and practical relevance.`,
					keynoteIds: keynotes.map((keynote) => keynote.id),
					keynotes
				}
			};
		}

		case 'youtube_grid': {
			const mediaAssets = resolveSpeakerInActionSelection(input, plan);
			return {
				...section,
				props: {
					videos: mediaAssets.map((asset) => ({
						url: asset.videoEmbedUrl
					}))
				}
			};
		}

		case 'hybrid_content_section': {
			const props: Record<string, unknown> = isRecord(section.props) ? section.props : {};
			const selectedPrimaryVisual = resolveHybridPrimaryVisualSelection(input, plan);
			const fallbackPrimaryVisual = resolveLegacyPrimaryVisualFromProps(props);
			const benefitImageUrls = buildBenefitImagePool(input, selectedPrimaryVisual, props);
			const hybridBenefitFallbacks = buildHybridBenefitFallbacks(input);

			const rawBenefits: unknown[] = Array.isArray(props.benefits) ? props.benefits : [];
			const normalizedBenefits = rawBenefits
				.map((item: unknown, index: number) => {
					if (isRecord(item)) {
						const title = getString(item.title) ?? `Audience outcome ${index + 1}`;
						const body =
							getString(item.body) ??
							hybridBenefitFallbacks[index % hybridBenefitFallbacks.length]?.body ??
							inputFallbackBenefitBody;
						return { title, body };
					}

					if (typeof item === 'string') {
						const body = getString(item);
						if (!body) {
							return null;
						}

						return {
							title: inferBenefitTitle(body, index),
							body
						};
					}

					return null;
				})
				.filter(
					(item: { title: string; body: string } | null): item is { title: string; body: string } =>
						item !== null
				);

			const benefits = normalizeBenefitsToThree(
				normalizedBenefits,
				hybridBenefitFallbacks,
				benefitImageUrls
			);
			const deepDiveFallbacks = buildWhyChristophFallbacks(input, benefits);

			const rawDeepDiveItems: unknown[] = Array.isArray(props.deepDiveItems)
				? props.deepDiveItems
				: [];
			const normalizedDeepDiveItems = rawDeepDiveItems
				.map((item: unknown, index: number) => {
					if (isRecord(item)) {
						const title = getString(item.title) ?? `Detail ${index + 1}`;
						const body =
							getString(item.body) ?? deepDiveFallbacks[index % deepDiveFallbacks.length]?.body;
						if (!body) {
							return null;
						}

						return { title, body };
					}

					if (typeof item === 'string') {
						const body = getString(item);
						if (!body) {
							return null;
						}

						return {
							title: `Detail ${index + 1}`,
							body
						};
					}

					return null;
				})
				.filter(
					(item: { title: string; body: string } | null): item is { title: string; body: string } =>
						item !== null
				);

			const deepDiveItems =
				normalizedDeepDiveItems.length > 0 ? normalizedDeepDiveItems : deepDiveFallbacks;

			const title =
				getString(props.title) || 'What your audience will leave with from this session';

			const intro =
				getString(props.intro) ||
				`Most ${input.campaign.format} sessions stay abstract. This section clarifies what ${input.campaign.audience} will leave with on ${input.campaign.topic} and why those outcomes are achievable.`;

			const deepDiveTitle = getString(props.deepDiveTitle) || 'Why Christoph';

			return {
				...section,
				props: {
					...props,
					title,
					intro,
					benefits,
					deepDiveTitle,
					deepDiveItems,
					primaryVisual: selectedPrimaryVisual ?? fallbackPrimaryVisual ?? undefined
				}
			};
		}

		case 'frictionless_funnel_booking': {
			return {
				...section,
				props: {
					...section.props,
					title: section.props.title?.trim() || assets.bookingDefaults.defaultSectionTitle,
					description:
						section.props.description?.trim() || assets.bookingDefaults.defaultSectionDescription,
					primaryCtaLabel:
						section.props.primaryCtaLabel?.trim() || assets.bookingDefaults.primaryCtaLabelDefault,
					calendlyUrl: section.props.calendlyUrl ?? assets.bookingDefaults.calendlyUrl,
					trustNote: section.props.trustNote ?? assets.bookingDefaults.trustNote,
					formDisclaimer: section.props.formDisclaimer ?? assets.bookingDefaults.formDisclaimer
				}
			};
		}

		case 'booklet_download_cta': {
			return {
				...section,
				props: {
					...section.props,
					labelText: section.props.labelText?.trim() || 'Free resource',
					heading: section.props.heading?.trim() || 'Meet Christoph through the booklet',
					paragraph:
						section.props.paragraph?.trim() ||
						"Get a concise introduction to Christoph's keynote themes, style, and real-world relevance. No form and no email required.",
					buttonCtaText: section.props.buttonCtaText?.trim() || 'Download the booklet'
				}
			};
		}

		case 'compliance_transparency_footer': {
			return {
				...section,
				props: {
					...section.props,
					privacyPolicyUrl:
						section.props.privacyPolicyUrl ?? assets.complianceDefaults.privacyPolicyUrl,
					contactEmail: section.props.contactEmail ?? assets.complianceDefaults.contactEmail,
					businessAddress:
						section.props.businessAddress ?? assets.complianceDefaults.businessAddress,
					phone: section.props.phone ?? assets.complianceDefaults.phone,
					copyrightText: section.props.copyrightText ?? assets.complianceDefaults.copyrightText,
					additionalLinks:
						section.props.additionalLinks ?? assets.complianceDefaults.additionalLinks
				}
			};
		}

		default:
			return section;
	}
}

function removeHybridSections(response: unknown): { result: unknown; removed: boolean } {
	if (!isRecord(response) || !Array.isArray(response.sections)) {
		return { result: response, removed: false };
	}

	const filteredSections = response.sections.filter((section) => {
		if (!isRecord(section)) {
			return false;
		}

		return section.type !== 'hybrid_content_section';
	});

	const removed = filteredSections.length !== response.sections.length;
	if (!removed) {
		return { result: response, removed: false };
	}

	return {
		result: {
			...response,
			sections: filteredSections
		},
		removed: true
	};
}

export function includeGeographyInSeoText(value: string, geography: string): string {
	const normalizedValue = value.trim();
	const normalizedGeography = geography.trim();

	if (!normalizedValue.length || !normalizedGeography.length) {
		return normalizedValue;
	}

	if (normalizedValue.toLowerCase().includes(normalizedGeography.toLowerCase())) {
		return normalizedValue;
	}

	return `${normalizedValue} in ${normalizedGeography}`;
}

function ensureSeoSection(
	sections: PageSection[],
	fallbackTitle: string,
	fallbackDescription: string,
	fallbackGeography: string
): PageSection[] {
	const seoIndex = sections.findIndex((section) => section.type === 'seo');
	const existingSeo = seoIndex >= 0 ? sections[seoIndex] : null;
	const existingSeoProps =
		existingSeo && isRecord(existingSeo.props)
			? existingSeo.props
			: ({} as Record<string, unknown>);

	const seoTitleBase = getString(existingSeoProps.title) ?? fallbackTitle;
	const seoDescriptionBase = getString(existingSeoProps.description) ?? fallbackDescription;
	const seoTitle = includeGeographyInSeoText(seoTitleBase, fallbackGeography);
	const seoDescription = includeGeographyInSeoText(seoDescriptionBase, fallbackGeography);

	const seoSection: PageSection = {
		type: 'seo',
		props: {
			title: seoTitle,
			description: seoDescription,
			canonicalUrl: getString(existingSeoProps.canonicalUrl),
			robots: getString(existingSeoProps.robots),
			ogImageUrl: getString(existingSeoProps.ogImageUrl),
			ogImageAlt: getString(existingSeoProps.ogImageAlt),
			ogType:
				existingSeoProps.ogType === 'website' || existingSeoProps.ogType === 'article'
					? existingSeoProps.ogType
					: undefined,
			twitterCard:
				existingSeoProps.twitterCard === 'summary' ||
				existingSeoProps.twitterCard === 'summary_large_image'
					? existingSeoProps.twitterCard
					: undefined,
			twitterSite: getString(existingSeoProps.twitterSite)
		}
	};

	const withoutSeo = sections.filter((section) => section.type !== 'seo');
	return [seoSection, ...withoutSeo];
}

function enforceNarrativeSoftOrder(
	sections: PageSection[],
	preferredSectionOrder: readonly PageSectionType[]
): PageSection[] {
	const preferredSequence = preferredSectionOrder.filter((sectionType) => sectionType !== 'seo');

	const presentSequence = preferredSequence.filter((type) =>
		sections.some((section) => section.type === type)
	);

	if (presentSequence.length < 2) {
		return sections;
	}

	const ordered = [...sections];
	for (let index = 1; index < presentSequence.length; index += 1) {
		const previousType = presentSequence[index - 1];
		const currentType = presentSequence[index];
		const previousIndex = ordered.findIndex((section) => section.type === previousType);
		const currentIndex = ordered.findIndex((section) => section.type === currentType);

		if (previousIndex < 0 || currentIndex < 0 || currentIndex > previousIndex) {
			continue;
		}

		const [sectionToMove] = ordered.splice(currentIndex, 1);
		const insertAfterIndex = ordered.findIndex((section) => section.type === previousType);
		ordered.splice(insertAfterIndex + 1, 0, sectionToMove);
	}

	return ordered;
}

function buildRequiredSectionFallback(
	sectionType: PageSectionType,
	input: LandingPageGenerationInput,
	plan: LandingPagePlan
): PageSection {
	const fallbackHeadline = plan.pageTitle || input.campaign.name;
	const fallbackSubheadline = input.adGroup.intentSummary || input.adPackage.messagingAngle;

	switch (sectionType) {
		case 'seo':
			return {
				type: 'seo',
				props: {
					title: includeGeographyInSeoText(fallbackHeadline, input.campaign.geography),
					description: includeGeographyInSeoText(fallbackSubheadline, input.campaign.geography)
				}
			};
		case 'immediate_authority_hero':
			return {
				type: 'immediate_authority_hero',
				props: {
					headline: fallbackHeadline,
					subheadline: fallbackSubheadline,
					primaryCtaLabel:
						input.assets.heroDefaults.primaryCtaLabelDefault || 'Request speaking availability',
					videoEmbedUrl: input.assets.heroDefaults.videoEmbedUrl || finalFallbackHeroVideoEmbedUrl,
					heroImageUrl:
						input.assets.heroDefaults.heroImageUrl ??
						input.assets.heroDefaults.videoThumbnailUrl ??
						finalFallbackHeroImageUrl,
					heroImageAlt:
						input.assets.heroDefaults.heroImageAlt ??
						input.assets.heroDefaults.videoThumbnailAlt ??
						finalFallbackHeroImageAlt,
					videoThumbnailUrl:
						input.assets.heroDefaults.videoThumbnailUrl ??
						input.assets.heroDefaults.heroImageUrl ??
						finalFallbackHeroImageUrl,
					videoThumbnailAlt:
						input.assets.heroDefaults.videoThumbnailAlt ??
						input.assets.heroDefaults.heroImageAlt ??
						finalFallbackHeroImageAlt
				}
			};
		case 'logos_of_trust_ribbon':
			return {
				type: 'logos_of_trust_ribbon',
				props: {
					title: input.assets.fixedLogosRibbon.title,
					label: input.assets.fixedLogosRibbon.label,
					logos: resolveLogosOfTrustSelection(input, plan)
				}
			};
		case 'keynote_speeches': {
			const keynotes = resolveKeynoteSelection(input, plan, []);
			return {
				type: 'keynote_speeches',
				props: {
					title: 'Keynote topics that resonate with this audience',
					intro: `Choose from proven keynote topics tailored for ${input.campaign.audience}.`,
					keynoteIds: keynotes.map((keynote) => keynote.id),
					keynotes
				}
			};
		}
		case 'hybrid_content_section': {
			const benefitImageUrls = buildBenefitImagePool(input, null, {});
			const fallbackBenefits = normalizeBenefitsToThree(
				[],
				buildHybridBenefitFallbacks(input),
				benefitImageUrls
			);
			const deepDiveItems = buildWhyChristophFallbacks(input, fallbackBenefits);
			return {
				type: 'hybrid_content_section',
				props: {
					title: 'What your audience will leave with from this session',
					intro: `This section clarifies what ${input.campaign.audience} will leave with on ${input.campaign.topic}.`,
					benefits: fallbackBenefits,
					deepDiveTitle: 'Why Christoph',
					deepDiveItems
				}
			};
		}
		case 'youtube_grid':
			return {
				type: 'youtube_grid',
				props: {
					videos: resolveSpeakerInActionSelection(input, plan).map((asset) => ({
						url: asset.videoEmbedUrl
					}))
				}
			};
		case 'frictionless_funnel_booking':
			return {
				type: 'frictionless_funnel_booking',
				props: {
					title: input.assets.bookingDefaults.defaultSectionTitle,
					description: input.assets.bookingDefaults.defaultSectionDescription,
					primaryCtaLabel: input.assets.bookingDefaults.primaryCtaLabelDefault,
					calendlyUrl: input.assets.bookingDefaults.calendlyUrl,
					trustNote: input.assets.bookingDefaults.trustNote,
					formDisclaimer: input.assets.bookingDefaults.formDisclaimer
				}
			};
		case 'proof_of_performance':
			return {
				type: 'proof_of_performance',
				props: {
					title: input.assets.fixedProofOfPerformance.title,
					testimonials: input.assets.fixedProofOfPerformance.testimonials
				}
			};
		case 'booklet_download_cta':
			return {
				type: 'booklet_download_cta',
				props: {
					labelText: 'Free resource',
					heading: 'Meet Christoph through the booklet',
					paragraph:
						"Get a concise introduction to Christoph's keynote themes, style, and real-world relevance. No form and no email required.",
					buttonCtaText: 'Download the booklet'
				}
			};
		case 'compliance_transparency_footer':
			return {
				type: 'compliance_transparency_footer',
				props: {
					privacyPolicyUrl: input.assets.complianceDefaults.privacyPolicyUrl,
					contactEmail: input.assets.complianceDefaults.contactEmail,
					businessAddress: input.assets.complianceDefaults.businessAddress,
					phone: input.assets.complianceDefaults.phone,
					copyrightText: input.assets.complianceDefaults.copyrightText,
					additionalLinks: input.assets.complianceDefaults.additionalLinks
				}
			};
		default:
			return {
				type: 'seo',
				props: {
					title: includeGeographyInSeoText(fallbackHeadline, input.campaign.geography),
					description: includeGeographyInSeoText(fallbackSubheadline, input.campaign.geography)
				}
			};
	}
}

function ensureRequiredMvpSections(
	sections: PageSection[],
	input: LandingPageGenerationInput,
	plan: LandingPagePlan,
	requiredSectionTypes: readonly PageSectionType[]
): PageSection[] {
	const existingByType = new Map<PageSectionType, PageSection>();
	for (const section of sections) {
		if (requiredSectionTypes.includes(section.type)) {
			existingByType.set(section.type, section);
		}
	}

	return requiredSectionTypes.map(
		(sectionType) =>
			existingByType.get(sectionType) ?? buildRequiredSectionFallback(sectionType, input, plan)
	);
}

function normalizeRootResponse(response: unknown): unknown {
	if (Array.isArray(response)) {
		const sectionCandidates = response
			.filter((item): item is Record<string, unknown> => isRecord(item))
			.filter((item) => typeof item.type === 'string')
			.map((item) => {
				if (isRecord(item.props)) {
					return {
						type: item.type,
						props: item.props
					};
				}

				const { type, ...rest } = item;
				return {
					type,
					props: rest
				};
			});

		if (sectionCandidates.length > 0) {
			traceLlm(
				'writer_normalized_shape',
				{ stage: 'landing_page_writer' },
				{
					inputShape: 'array_of_sections',
					sectionCount: sectionCandidates.length
				}
			);
			return {
				version: 1,
				sections: sectionCandidates
			};
		}

		traceLlm(
			'writer_normalized_shape',
			{ stage: 'landing_page_writer' },
			{
				inputShape: 'array_non_section',
				sectionCount: 0
			}
		);
		return {};
	}

	return response;
}

function buildWriterRepairPrompt(
	input: LandingPageGenerationInput,
	plan: LandingPagePlan,
	invalidResponse: unknown,
	issues: ZodIssue[],
	mvpIssues: string[],
	allowedSectionTypes: readonly PageSectionType[],
	requiredSectionTypes: readonly PageSectionType[]
): string {
	return `Your previous JSON failed schema validation. Return a corrected JSON object only.

Corrective rules:
- Keep the same landing page intent and section narrative.
- Do not output commentary.
- Do not output markdown.
- Use assets from input.assets for proof, media, and compliance values.
- For hero media, use plan.assetPlan.hero.videoAssetId with input.assets.assetCatalog.heroVideos.
- For youtube_grid media, use plan.assetPlan.speakerInAction.videoAssetIds with input.assets.assetCatalog.speakerInActionVideos.
- For hybrid primary visual, use plan.assetPlan.hybridContentSection.primaryImageAssetId with input.assets.assetCatalog.hybridSupportingImages.
- For keynote_speeches, use plan.assetPlan.keynoteSpeeches.keynoteIds resolved against input.assets.assetCatalog.keynoteCatalog.
- Never invent media IDs or media URLs.
- Use only these allowed section types: ${allowedSectionTypes.join(', ')}.
- Include these required section types: ${requiredSectionTypes.join(', ')}.
- Top-level JSON must be a single object, never an array.
- Preferred section order for narrative flow: ${requiredSectionTypes.join(', ')}.
- Soft preference: when immediate_authority_hero, youtube_grid, keynote_speeches, and logos_of_trust_ribbon are all present, place them in this narrative order: immediate_authority_hero, youtube_grid, keynote_speeches, logos_of_trust_ribbon.
- Root title is required.
- seo.props.title and seo.props.description are required.
- For hybrid_content_section, intro is required.
- For hybrid_content_section, benefits must be an array of objects with title, body, and imageUrl fields.
- For hybrid_content_section, benefits should contain exactly 3 items aligned to what the audience will leave with.
- For hybrid_content_section, each benefit imageUrl must resolve from approved hybrid images in input.assets.assetCatalog.hybridSupportingImages.
- For hybrid_content_section, props.primaryVisual should resolve from plan.assetPlan.hybridContentSection.primaryImageAssetId.
- For hybrid_content_section, deepDiveTitle and deepDiveItems are required.
- For hybrid_content_section, bias deepDiveTitle to "Why Christoph" and focus deepDiveItems on qualification proof.
- For keynote_speeches, title and intro are required.
- For keynote_speeches, include keynoteIds with exactly 3 values from plan.assetPlan.keynoteSpeeches.keynoteIds.

Landing page generation input:
${JSON.stringify(input, null, 2)}

Landing page plan:
${JSON.stringify(plan, null, 2)}

Previous invalid JSON:
${JSON.stringify(invalidResponse, null, 2)}

Validation errors:
${JSON.stringify(issues, null, 2)}

MVP validation errors:
${JSON.stringify(mvpIssues, null, 2)}`;
}

function hydrateLandingPageWithAssets(
	response: unknown,
	input: LandingPageGenerationInput,
	plan: LandingPagePlan,
	requiredSectionTypes: readonly PageSectionType[],
	preferredSectionOrder: readonly PageSectionType[]
): unknown {
	if (!isRecord(response)) {
		return response;
	}

	const hydrated = { ...response };
	if (hydrated.version === undefined) {
		hydrated.version = 1;
	}

	const fallbackPageTitle = getString(hydrated.title) ?? plan.pageTitle ?? input.campaign.name;
	hydrated.title = fallbackPageTitle;

	const fallbackSeoDescription =
		input.adGroup.intentSummary ||
		plan.messagingAngle ||
		input.adPackage.messagingAngle ||
		input.adPackage.targetingSummary ||
		input.campaign.topic;

	if (!Array.isArray(hydrated.sections)) {
		const fallbackSections = ensureRequiredMvpSections([], input, plan, requiredSectionTypes).map(
			(section) => hydrateSectionWithAssets(section, input, plan)
		);
		return {
			...hydrated,
			sections: ensureSeoSection(
				fallbackSections,
				fallbackPageTitle,
				fallbackSeoDescription,
				input.campaign.geography
			)
		};
	}

	const sections = hydrated.sections
		.filter((section): section is PageSection => {
			if (!isRecord(section)) {
				return false;
			}

			if (typeof section.type !== 'string') {
				return false;
			}

			if (!isRecord(section.props)) {
				section.props = {};
			}

			return true;
		})
		.map((section) => hydrateSectionWithAssets(section, input, plan));

	const mvpSections = ensureRequiredMvpSections(sections, input, plan, requiredSectionTypes).map(
		(section) => hydrateSectionWithAssets(section, input, plan)
	);

	const orderedSections = enforceNarrativeSoftOrder(mvpSections, preferredSectionOrder);
	const sectionsWithSeo = ensureSeoSection(
		orderedSections,
		fallbackPageTitle,
		fallbackSeoDescription,
		input.campaign.geography
	);

	return {
		...hydrated,
		sections: sectionsWithSeo
	};
}

export async function generateLandingPageDocument(
	input: LandingPageGenerationInput,
	plan: LandingPagePlan,
	traceContext: LlmTraceContext = {}
): Promise<LandingPageDocument> {
	const eligibility = getSectionEligibility(input);
	const preferredSectionOrder = resolvePreferredSectionOrder(eligibility.requiredSectionTypes);
	const sectionCatalog = buildSectionCatalog(eligibility.allowedSectionTypes);
	const promptContext = {
		allowedSectionTypes: eligibility.allowedSectionTypes,
		requiredSectionTypes: eligibility.requiredSectionTypes,
		requiredCapabilities: [...requiredMvpCapabilities],
		preferredSectionOrder,
		sectionCatalog,
		disallowedReasonByType: eligibility.disallowedReasonByType
	};

	const userPrompt = landingPageWriterUserPrompt(input, plan, promptContext);
	const selectedSectionTypes = plan.sectionPlan.map((section) => section.type);

	let promptLibraryGuidance = '';
	try {
		const guidance = await resolvePromptGuidanceForCampaign('final', {
			name: input.campaign.name,
			audience: input.campaign.audience,
			format: input.campaign.format,
			topic: input.campaign.topic,
			language: input.campaign.language,
			geography: input.campaign.geography,
			notes: input.campaign.notes
		});
		promptLibraryGuidance = guidance.guidance;
		traceLlm(
			'agent_prompt_guidance',
			{ ...traceContext, stage: 'landing_page_writer' },
			{
				found: guidance.matchedPromptId !== null,
				promptId: guidance.matchedPromptId,
				promptName: guidance.matchedPromptName,
				audience: guidance.matchedAudience,
				format: guidance.matchedFormat
			}
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn('Landing page writer: prompt guidance lookup failed', message);
		traceLlm(
			'agent_prompt_guidance_error',
			{ ...traceContext, stage: 'landing_page_writer' },
			{
				message
			}
		);
	}

	const systemPrompt = buildLandingPageWriterSystemPrompt(
		promptContext,
		selectedSectionTypes,
		promptLibraryGuidance
	);

	const response = await runLandingPageWriterGeneration({
		systemPrompt,
		userPrompt,
		traceContext
	});

	const firstValidation = validateWithHydrationPipeline(
		response,
		{
			normalizeRootResponse,
			hydrateLandingPageWithAssets: (normalizedResponse) =>
				hydrateLandingPageWithAssets(
					normalizedResponse,
					input,
					plan,
					eligibility.requiredSectionTypes,
					preferredSectionOrder
				),
			removeHybridSections
		},
		traceContext
	);
	let repairUserPrompt: string;
	if (firstValidation.success) {
		const firstMvpIssues = collectLandingPageDocumentMvpIssues(
			firstValidation.data,
			eligibility.allowedSectionTypes,
			eligibility.requiredSectionTypes
		);
		if (firstMvpIssues.length === 0) {
			console.log('Landing page writer: document validated');
			return firstValidation.data;
		}

		console.error('Landing page writer: MVP validation failed', firstMvpIssues);
		traceLlm(
			'agent_stage_validation_error',
			{ ...traceContext, stage: 'landing_page_writer' },
			{
				issues: firstMvpIssues,
				phase: 'initial_mvp_validation'
			}
		);
		traceLlm(
			'validation_failed',
			{ ...traceContext, stage: 'landing_page_writer' },
			{
				issues: firstMvpIssues,
				phase: 'initial_mvp_validation'
			}
		);

		repairUserPrompt = buildWriterRepairPrompt(
			input,
			plan,
			firstValidation.data,
			[],
			firstMvpIssues,
			eligibility.allowedSectionTypes,
			eligibility.requiredSectionTypes
		);
	} else {
		console.error('Landing page writer: validation failed', firstValidation.issues);
		traceLlm(
			'agent_stage_validation_error',
			{ ...traceContext, stage: 'landing_page_writer' },
			{
				issues: firstValidation.issues,
				phase: 'initial_validation'
			}
		);
		traceLlm(
			'validation_failed',
			{ ...traceContext, stage: 'landing_page_writer' },
			{
				issues: firstValidation.issues,
				phase: 'initial_validation'
			}
		);

		repairUserPrompt = buildWriterRepairPrompt(
			input,
			plan,
			firstValidation.hydratedResponse,
			firstValidation.issues,
			[],
			eligibility.allowedSectionTypes,
			eligibility.requiredSectionTypes
		);
	}

	const repairedResponse = await runLandingPageWriterRepair({
		systemPrompt,
		userPrompt: repairUserPrompt,
		traceContext
	});

	const secondValidation = validateWithHydrationPipeline(
		repairedResponse,
		{
			normalizeRootResponse,
			hydrateLandingPageWithAssets: (normalizedResponse) =>
				hydrateLandingPageWithAssets(
					normalizedResponse,
					input,
					plan,
					eligibility.requiredSectionTypes,
					preferredSectionOrder
				),
			removeHybridSections
		},
		traceContext
	);
	if (!secondValidation.success) {
		console.error('Landing page writer: repair validation failed', secondValidation.issues);
		traceLlm(
			'agent_stage_validation_error',
			{ ...traceContext, stage: 'landing_page_writer' },
			{
				issues: secondValidation.issues,
				phase: 'repair_validation'
			}
		);
		traceLlm(
			'validation_failed',
			{ ...traceContext, stage: 'landing_page_writer' },
			{
				issues: secondValidation.issues,
				phase: 'repair_validation'
			}
		);
		throw new Error(
			`Invalid landing page document: ${JSON.stringify(secondValidation.issues, null, 2)}`
		);
	}

	const secondMvpIssues = collectLandingPageDocumentMvpIssues(
		secondValidation.data,
		eligibility.allowedSectionTypes,
		eligibility.requiredSectionTypes
	);
	if (secondMvpIssues.length > 0) {
		console.error('Landing page writer: repair MVP validation failed', secondMvpIssues);
		traceLlm(
			'agent_stage_validation_error',
			{ ...traceContext, stage: 'landing_page_writer' },
			{
				issues: secondMvpIssues,
				phase: 'repair_mvp_validation'
			}
		);
		traceLlm(
			'validation_failed',
			{ ...traceContext, stage: 'landing_page_writer' },
			{
				issues: secondMvpIssues,
				phase: 'repair_mvp_validation'
			}
		);
		throw new Error(
			`Invalid landing page document (MVP validation): ${secondMvpIssues.join(' | ')}`
		);
	}

	validateLandingPageDocumentForMvp(
		secondValidation.data,
		eligibility.allowedSectionTypes,
		eligibility.requiredSectionTypes
	);
	console.log('Landing page writer: document validated');
	return secondValidation.data;
}
