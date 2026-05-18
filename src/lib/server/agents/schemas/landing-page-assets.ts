import {
	complianceTransparencyFooterPropsSchema,
	logosOfTrustRibbonPropsSchema,
	proofOfPerformancePropsSchema
} from '$lib/page-builder/sections';
import { z } from 'zod';

const heroDefaultsSchema = z.object({
	videoEmbedUrl: z.string().trim().url(),
	heroImageUrl: z.string().trim().url().optional(),
	heroImageAlt: z.string().trim().min(1).optional(),
	videoThumbnailUrl: z.string().trim().url().optional(),
	videoThumbnailAlt: z.string().trim().min(1).optional(),
	primaryCtaLabelDefault: z.string().trim().min(1),
	primaryCtaHref: z
		.string()
		.trim()
		.refine((value) => value.startsWith('#') || z.string().safeParse(value).success, {
			message: 'primaryCtaHref must be an absolute URL or an in-page anchor (e.g. #briefing).'
		})
		.optional(),
	primaryCtaAction: z.string().trim().min(1).optional()
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

export const heroImageOptionSchema = z.object({
	id: z.string().trim().min(1),
	title: z.string().trim().min(1),
	description: z.string().trim().min(1),
	usageNotes: z.string().trim().min(1),
	avoidNotes: z.string().trim().min(1).optional(),
	imageUrl: z.string().trim().url(),
	alt: z.string().trim().min(1),
	caption: z.string().trim().min(1).optional()
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

export const logoOptionSchema = z.object({
	id: z.string().trim().min(1),
	name: z.string().trim().min(1),
	logoUrl: z.string().trim().min(1),
	logoAlt: z.string().trim().min(1)
});

export const keynoteOptionSchema = z.object({
	id: z.string().trim().min(1),
	title: z.string().trim().min(1),
	summary: z.string().trim().min(1),
	audience: z.string().trim(),
	keynoteShort: z.string().trim(),
	imageUrl: z.string().trim().url(),
	imageAlt: z.string().trim().min(1)
});

const assetCatalogSchema = z.object({
	heroVideos: z.array(heroVideoOptionSchema),
	heroImages: z.array(heroImageOptionSchema),
	hybridSupportingImages: z.array(hybridSupportingImageOptionSchema),
	speakerInActionVideos: z.array(speakerInActionVideoOptionSchema),
	logoCatalog: z.array(logoOptionSchema).default([]),
	keynoteCatalog: z.array(keynoteOptionSchema).default([])
});

export const landingPageAssetsSchema = z.object({
	heroDefaults: heroDefaultsSchema,
	fixedLogosRibbon: logosOfTrustRibbonPropsSchema,
	fixedProofOfPerformance: proofOfPerformancePropsSchema,
	bookingDefaults: bookingDefaultsSchema,
	complianceDefaults: complianceTransparencyFooterPropsSchema,
	assetCatalog: assetCatalogSchema.default({
		heroVideos: [],
		heroImages: [],
		hybridSupportingImages: [],
		speakerInActionVideos: [],
		logoCatalog: [],
		keynoteCatalog: []
	})
});

export type LandingPageAssets = z.infer<typeof landingPageAssetsSchema>;
export type HeroVideoOption = z.infer<typeof heroVideoOptionSchema>;
export type HeroImageOption = z.infer<typeof heroImageOptionSchema>;
export type HybridSupportingImageOption = z.infer<typeof hybridSupportingImageOptionSchema>;
export type SpeakerInActionVideoOption = z.infer<typeof speakerInActionVideoOptionSchema>;
export type LogoOption = z.infer<typeof logoOptionSchema>;
export type KeynoteOption = z.infer<typeof keynoteOptionSchema>;
