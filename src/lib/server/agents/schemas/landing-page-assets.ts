import {
	complianceTransparencyFooterPropsSchema,
	logosOfTrustRibbonPropsSchema,
	proofOfPerformancePropsSchema
} from '$lib/page-builder/sections';
import { z } from 'zod';

const heroDefaultsSchema = z
	.object({
		videoEmbedUrl: z.string().trim().url(),
		videoThumbnailUrl: z.string().trim().url().optional(),
		videoThumbnailAlt: z.string().trim().min(1).optional(),
		primaryCtaLabelDefault: z.string().trim().min(1),
		primaryCtaHref: z
			.string()
			.trim()
			.refine((value) => value.startsWith('#') || z.string().url().safeParse(value).success, {
				message: 'primaryCtaHref must be an absolute URL or an in-page anchor (e.g. #briefing).'
			})
			.optional(),
		primaryCtaAction: z.string().trim().min(1).optional()
	})
	.refine((value) => Boolean(value.primaryCtaHref || value.primaryCtaAction), {
		message: 'Either primaryCtaHref or primaryCtaAction must be provided in heroDefaults.',
		path: ['primaryCtaHref']
	});

const bookingDefaultsSchema = z.object({
	defaultSectionTitle: z.string().trim().min(1),
	defaultSectionDescription: z.string().trim().min(1),
	primaryCtaLabelDefault: z.string().trim().min(1),
	calendlyUrl: z.string().trim().url().optional(),
	trustNote: z.string().trim().min(1).optional(),
	formDisclaimer: z.string().trim().min(1).optional()
});

export const heroVideoOptionSchema = z.object({
	id: z.string().trim().min(1),
	title: z.string().trim().min(1),
	description: z.string().trim().min(1),
	usageNotes: z.string().trim().min(1),
	avoidNotes: z.string().trim().min(1).optional(),
	videoEmbedUrl: z.string().trim().url(),
	videoThumbnailUrl: z.string().trim().url(),
	videoThumbnailAlt: z.string().trim().min(1)
});

export const hybridSupportingImageOptionSchema = z.object({
	id: z.string().trim().min(1),
	title: z.string().trim().min(1),
	description: z.string().trim().min(1),
	usageNotes: z.string().trim().min(1),
	avoidNotes: z.string().trim().min(1).optional(),
	imageUrl: z.string().trim().url(),
	alt: z.string().trim().min(1),
	caption: z.string().trim().min(1).optional()
});

export const speakerInActionVideoOptionSchema = z.object({
	id: z.string().trim().min(1),
	title: z.string().trim().min(1),
	description: z.string().trim().min(1),
	usageNotes: z.string().trim().min(1),
	avoidNotes: z.string().trim().min(1).optional(),
	videoEmbedUrl: z.string().trim().url(),
	videoThumbnailUrl: z.string().trim().url(),
	videoThumbnailAlt: z.string().trim().min(1)
});

const assetCatalogSchema = z.object({
	heroVideos: z.array(heroVideoOptionSchema),
	hybridSupportingImages: z.array(hybridSupportingImageOptionSchema),
	speakerInActionVideos: z.array(speakerInActionVideoOptionSchema)
});

export const landingPageAssetsSchema = z.object({
	heroDefaults: heroDefaultsSchema,
	fixedLogosRibbon: logosOfTrustRibbonPropsSchema,
	fixedProofOfPerformance: proofOfPerformancePropsSchema,
	bookingDefaults: bookingDefaultsSchema,
	complianceDefaults: complianceTransparencyFooterPropsSchema,
	assetCatalog: assetCatalogSchema.default({
		heroVideos: [],
		hybridSupportingImages: [],
		speakerInActionVideos: []
	})
});

export type LandingPageAssets = z.infer<typeof landingPageAssetsSchema>;
export type HeroVideoOption = z.infer<typeof heroVideoOptionSchema>;
export type HybridSupportingImageOption = z.infer<typeof hybridSupportingImageOptionSchema>;
export type SpeakerInActionVideoOption = z.infer<typeof speakerInActionVideoOptionSchema>;
