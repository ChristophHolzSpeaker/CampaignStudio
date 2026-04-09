import {
	complianceTransparencyFooterPropsSchema,
	logosOfTrustRibbonPropsSchema,
	proofOfPerformancePropsSchema
} from '$lib/page-builder/sections';
import { z } from 'zod';

const heroDefaultsSchema = z
	.object({
		videoEmbedUrl: z.string().trim().url(),
		videoThumbnailUrl: z.string().trim().url(),
		videoThumbnailAlt: z.string().trim().min(1),
		primaryCtaLabelDefault: z.string().trim().min(1),
		primaryCtaHref: z.string().trim().url().optional(),
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

export const landingPageAssetsSchema = z.object({
	heroDefaults: heroDefaultsSchema,
	fixedLogosRibbon: logosOfTrustRibbonPropsSchema,
	fixedProofOfPerformance: proofOfPerformancePropsSchema,
	bookingDefaults: bookingDefaultsSchema,
	complianceDefaults: complianceTransparencyFooterPropsSchema
});

export type LandingPageAssets = z.infer<typeof landingPageAssetsSchema>;
