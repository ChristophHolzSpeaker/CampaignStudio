import { z } from 'zod';
import { pageSectionTypes } from './types';

export const pageSectionTypeSchema = z.enum(pageSectionTypes);

export const ogTypeSchema = z.enum(['website', 'article']);

export const twitterCardTypeSchema = z.enum(['summary', 'summary_large_image']);
export const layoutOrientationsSchema = z.enum(['right', 'left']);

export const seoPropsSchema = z.object({
	title: z.string().trim().min(1),
	description: z.string().trim().min(1),
	canonicalUrl: z.string().trim().optional(),
	robots: z.string().trim().min(1).optional(),
	ogImageUrl: z.string().trim().optional(),
	ogImageAlt: z.string().trim().min(1).optional(),
	ogType: ogTypeSchema.optional(),
	twitterCard: twitterCardTypeSchema.optional(),
	twitterSite: z.string().trim().min(1).optional()
});

export const immediateAuthorityHeroPropsSchema = z.object({
	headline: z.string().trim().min(1),
	subheadline: z.string().trim().min(1),
	primaryCtaLabel: z.string().trim().min(1),
	primaryCtaHref: z.string().trim().optional(),
	primaryCtaAction: z.string().trim().min(1).optional(),
	videoEmbedUrl: z.string().trim(),
	heroImageUrl: z.string().trim().optional(),
	heroImageAlt: z.string().trim().min(1).optional(),
	videoThumbnailUrl: z.string().trim(),
	videoThumbnailAlt: z.string().trim().min(1),
	eyebrow: z.string().trim().min(1).optional(),
	supportingBullets: z.array(z.string().trim().min(1)).optional(),
	layout: layoutOrientationsSchema.optional()
});

export const trustLogoItemSchema = z.object({
	name: z.string().trim().min(1),
	imageUrl: z.string().trim(),
	alt: z.string().trim().min(1)
});

export const logosOfTrustRibbonPropsSchema = z.object({
	title: z.string().trim().min(1).optional(),
	label: z.string().trim().min(1).optional(),
	logos: z.array(trustLogoItemSchema).min(1)
});

export const youtubeGridVideoItemSchema = z.object({
	url: z.string().trim()
});

export const youtubeGridPropsSchema = z.object({
	videos: z.array(youtubeGridVideoItemSchema).min(1)
});

export const keynoteSpeechItemSchema = z.object({
	id: z.string().trim().min(1),
	title: z.string().trim().min(1),
	imageUrl: z.string().trim(),
	summary: z.string().trim().min(1)
});

export const keynoteSpeechesPropsSchema = z.object({
	title: z.string().trim().min(1),
	intro: z.string().trim().min(1),
	keynoteIds: z.array(z.string().trim().min(1)).min(3).max(3),
	keynotes: z.array(keynoteSpeechItemSchema).min(3).max(3)
});

export const speakerInActionMediaItemSchema = z.object({
	assetId: z.string().trim().min(1),
	title: z.string().trim().min(1),
	videoEmbedUrl: z.string().trim(),
	thumbnailUrl: z.string().trim(),
	thumbnailAlt: z.string().trim().min(1)
});

export const speakerInActionPropsSchema = z.object({
	title: z.string().trim().min(1).optional(),
	mediaAssets: z.array(speakerInActionMediaItemSchema).min(4)
});

export const heroLargeEmailCtaPropsSchema = z.object({
	heading: z.string().trim().min(1),
	labelText: z.string().trim().min(1)
});

export const bookletDownloadCtaPropsSchema = z.object({
	labelText: z.string().trim().min(1),
	heading: z.string().trim().min(1),
	paragraph: z.string().trim().min(1),
	buttonCtaText: z.string().trim().min(1)
});

export const hybridBenefitItemSchema = z.object({
	title: z.string().trim().min(1),
	body: z.string().trim().min(1),
	imageUrl: z.string().trim()
});

export const hybridDeepDiveItemSchema = z.object({
	title: z.string().trim().min(1),
	body: z.string().trim().min(1)
});

export const hybridPrimaryVisualSchema = z.object({
	imageUrl: z.string().trim(),
	alt: z.string().trim().min(1),
	caption: z.string().trim().min(1).optional()
});

export const hybridContentSectionPropsSchema = z.object({
	title: z.string().trim().min(1),
	intro: z.string().trim().min(1),
	benefits: z.array(hybridBenefitItemSchema).min(1),
	deepDiveTitle: z.string().trim().min(1),
	deepDiveItems: z.array(hybridDeepDiveItemSchema).min(1),
	primaryVisual: hybridPrimaryVisualSchema.optional(),
	emailCtaTitle: z.string().optional(),
	layout: layoutOrientationsSchema.optional()
});

export const testimonialItemSchema = z.object({
	quote: z.string().trim().min(1),
	name: z.string().trim().min(1),
	role: z.string().trim().min(1),
	company: z.string().trim().min(1),
	photoUrl: z.string().trim(),
	photoAlt: z.string().trim().min(1),
	rating: z.number().int().min(1).max(5).optional(),
	badgeLabel: z.string().trim().min(1).optional(),
	featured: z.boolean().optional()
});

export const proofOfPerformancePropsSchema = z.object({
	title: z.string().trim().min(1),
	testimonials: z.array(testimonialItemSchema).min(1)
});

export const introQuestionTypeSchema = z.enum(['text', 'email', 'tel', 'textarea', 'select']);

export const introQuestionItemSchema = z.object({
	id: z.string().trim().min(1),
	label: z.string().trim().min(1),
	placeholder: z.string().trim().min(1),
	type: introQuestionTypeSchema
});

export const frictionlessFunnelBookingPropsSchema = z.object({
	title: z.string().trim().min(1),
	description: z.string().trim().min(1),
	primaryCtaLabel: z.string().trim().min(1),
	introQuestions: z.array(introQuestionItemSchema).optional(),
	calendlyUrl: z.string().trim().optional(),
	trustNote: z.string().trim().min(1).optional(),
	formDisclaimer: z.string().trim().min(1).optional()
});

export const complianceLinkItemSchema = z.object({
	label: z.string().trim().min(1),
	href: z.string().trim()
});

export const complianceTransparencyFooterPropsSchema = z.object({
	privacyPolicyUrl: z.string().trim(),
	contactEmail: z.string().trim().email(),
	businessAddress: z.string().trim().min(1),
	phone: z.string().trim().min(1).optional(),
	copyrightText: z.string().trim().min(1).optional(),
	additionalLinks: z.array(complianceLinkItemSchema).optional()
});

export const immediateAuthorityHeroSectionSchema = z.object({
	type: z.literal('immediate_authority_hero'),
	props: immediateAuthorityHeroPropsSchema
});

export const logosOfTrustRibbonSectionSchema = z.object({
	type: z.literal('logos_of_trust_ribbon'),
	props: logosOfTrustRibbonPropsSchema
});

export const youtubeGridSectionSchema = z.object({
	type: z.literal('youtube_grid'),
	props: youtubeGridPropsSchema
});

export const speakerInActionSectionSchema = z.object({
	type: z.literal('speaker_in_action'),
	props: speakerInActionPropsSchema
});

export const keynoteSpeechesSectionSchema = z.object({
	type: z.literal('keynote_speeches'),
	props: keynoteSpeechesPropsSchema
});

export const heroLargeEmailCtaSectionSchema = z.object({
	type: z.literal('hero_large_email_cta'),
	props: heroLargeEmailCtaPropsSchema
});

export const bookletDownloadCtaSectionSchema = z.object({
	type: z.literal('booklet_download_cta'),
	props: bookletDownloadCtaPropsSchema
});

export const hybridContentSectionSchema = z.object({
	type: z.literal('hybrid_content_section'),
	props: hybridContentSectionPropsSchema
});

export const proofOfPerformanceSectionSchema = z.object({
	type: z.literal('proof_of_performance'),
	props: proofOfPerformancePropsSchema
});

export const frictionlessFunnelBookingSectionSchema = z.object({
	type: z.literal('frictionless_funnel_booking'),
	props: frictionlessFunnelBookingPropsSchema
});

export const complianceTransparencyFooterSectionSchema = z.object({
	type: z.literal('compliance_transparency_footer'),
	props: complianceTransparencyFooterPropsSchema
});

export const seoSectionSchema = z.object({
	type: z.literal('seo'),
	props: seoPropsSchema
});

export const pageSectionSchema = z.discriminatedUnion('type', [
	seoSectionSchema,
	immediateAuthorityHeroSectionSchema,
	heroLargeEmailCtaSectionSchema,
	bookletDownloadCtaSectionSchema,
	logosOfTrustRibbonSectionSchema,
	youtubeGridSectionSchema,
	keynoteSpeechesSectionSchema,
	speakerInActionSectionSchema,
	hybridContentSectionSchema,
	proofOfPerformanceSectionSchema,
	frictionlessFunnelBookingSectionSchema,
	complianceTransparencyFooterSectionSchema
]);

export const pageSectionsSchema = z.array(pageSectionSchema).min(1);

export type ImmediateAuthorityHeroSection = z.infer<typeof immediateAuthorityHeroSectionSchema>;
export type HeroLargeEmailCtaSection = z.infer<typeof heroLargeEmailCtaSectionSchema>;
export type BookletDownloadCtaSection = z.infer<typeof bookletDownloadCtaSectionSchema>;
export type LogosOfTrustRibbonSection = z.infer<typeof logosOfTrustRibbonSectionSchema>;
export type YoutubeGridSection = z.infer<typeof youtubeGridSectionSchema>;
export type KeynoteSpeechesSection = z.infer<typeof keynoteSpeechesSectionSchema>;
export type SpeakerInActionSection = z.infer<typeof speakerInActionSectionSchema>;
export type HybridContentSection = z.infer<typeof hybridContentSectionSchema>;
export type ProofOfPerformanceSection = z.infer<typeof proofOfPerformanceSectionSchema>;
export type FrictionlessFunnelBookingSection = z.infer<
	typeof frictionlessFunnelBookingSectionSchema
>;
export type ComplianceTransparencyFooterSection = z.infer<
	typeof complianceTransparencyFooterSectionSchema
>;
export type SeoSection = z.infer<typeof seoSectionSchema>;
export type PageSectionSchemaType = z.infer<typeof pageSectionSchema>;
