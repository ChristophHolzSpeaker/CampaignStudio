import type { Component } from 'svelte';
import type { ZodType } from 'zod';

export const pageSectionTypes = [
	'seo',
	'immediate_authority_hero',
	'hero_large_email_cta',
	'booklet_download_cta',
	'logos_of_trust_ribbon',
	'keynote_speeches',
	'speaker_in_action',
	'hybrid_content_section',
	'proof_of_performance',
	'frictionless_funnel_booking',
	'compliance_transparency_footer'
] as const;

export type PageSectionType = (typeof pageSectionTypes)[number];

export interface ImmediateAuthorityHeroProps {
	headline: string;
	subheadline: string;
	primaryCtaLabel: string;
	primaryCtaHref?: string;
	primaryCtaAction?: string;
	videoEmbedUrl: string;
	videoThumbnailUrl: string;
	videoThumbnailAlt: string;
	eyebrow?: string;
	supportingBullets?: string[];
}

export interface TrustLogoItem {
	name: string;
	imageUrl: string;
	alt: string;
}

export interface LogosOfTrustRibbonProps {
	title?: string;
	label?: string;
	logos: TrustLogoItem[];
}

export interface HeroLargeEmailCtaProps {
	heading: string;
	labelText: string;
}

export interface KeynoteSpeechItem {
	id: string;
	title: string;
	imageUrl: string;
	summary: string;
}

export interface KeynoteSpeechesProps {
	title: string;
	intro: string;
	keynoteIds: string[];
	keynotes: KeynoteSpeechItem[];
}

export interface BookletDownloadCtaProps {
	labelText: string;
	heading: string;
	paragraph: string;
	buttonCtaText: string;
}

export interface HybridBenefitItem {
	title: string;
	body: string;
	imageUrl: string;
}

export interface HybridDeepDiveItem {
	title: string;
	body: string;
}

export interface HybridSupportingVisualItem {
	imageUrl: string;
	alt: string;
	caption?: string;
}

export interface SpeakerInActionMediaItem {
	assetId: string;
	title: string;
	videoEmbedUrl: string;
	thumbnailUrl: string;
	thumbnailAlt: string;
}

export interface SpeakerInActionProps {
	title?: string;
	mediaAssets: SpeakerInActionMediaItem[];
}

export interface HybridContentSectionProps {
	title: string;
	intro: string;
	benefits: HybridBenefitItem[];
	deepDiveTitle: string;
	deepDiveItems: HybridDeepDiveItem[];
	supportingVisualItems?: HybridSupportingVisualItem[];
	emailCtaTitle?: string;
}

export interface TestimonialItem {
	quote: string;
	name: string;
	role: string;
	company: string;
	photoUrl: string;
	photoAlt: string;
	rating?: number;
	badgeLabel?: string;
	featured?: boolean;
}

export interface ProofOfPerformanceProps {
	title: string;
	testimonials: TestimonialItem[];
}

export type IntroQuestionType = 'text' | 'email' | 'tel' | 'textarea' | 'select';

export interface IntroQuestionItem {
	id: string;
	label: string;
	placeholder: string;
	type: IntroQuestionType;
}

export interface FrictionlessFunnelBookingProps {
	title: string;
	description: string;
	primaryCtaLabel: string;
	introQuestions?: IntroQuestionItem[];
	calendlyUrl?: string;
	trustNote?: string;
	formDisclaimer?: string;
}

export interface ComplianceLinkItem {
	label: string;
	href: string;
}

export interface ComplianceTransparencyFooterProps {
	privacyPolicyUrl: string;
	contactEmail: string;
	businessAddress: string;
	phone?: string;
	copyrightText?: string;
	additionalLinks?: ComplianceLinkItem[];
}

export type OgType = 'website' | 'article';

export type TwitterCardType = 'summary' | 'summary_large_image';

export interface SeoProps {
	title: string;
	description: string;
	canonicalUrl?: string;
	robots?: string;
	ogImageUrl?: string;
	ogImageAlt?: string;
	ogType?: OgType;
	twitterCard?: TwitterCardType;
	twitterSite?: string;
}

export interface SectionPropsByType {
	seo: SeoProps;
	immediate_authority_hero: ImmediateAuthorityHeroProps;
	hero_large_email_cta: HeroLargeEmailCtaProps;
	booklet_download_cta: BookletDownloadCtaProps;
	logos_of_trust_ribbon: LogosOfTrustRibbonProps;
	keynote_speeches: KeynoteSpeechesProps;
	speaker_in_action: SpeakerInActionProps;
	hybrid_content_section: HybridContentSectionProps;
	proof_of_performance: ProofOfPerformanceProps;
	frictionless_funnel_booking: FrictionlessFunnelBookingProps;
	compliance_transparency_footer: ComplianceTransparencyFooterProps;
}

export type PageSection<TType extends PageSectionType = PageSectionType> = {
	[K in PageSectionType]: {
		type: K;
		props: SectionPropsByType[K];
	};
}[TType];

export type PageSectionComponent = Component<any>;

export interface PageSectionSpec<TType extends PageSectionType = PageSectionType> {
	type: TType;
	label: string;
	description: string;
	whenToUse: string[];
	whenNotToUse: string[];
	contentGuidance: string[];
	propsSchema: ZodType<SectionPropsByType[TType]>;
	defaultProps?: Partial<SectionPropsByType[TType]>;
}

export type PageSectionSpecMap = {
	[K in PageSectionType]: PageSectionSpec<K>;
};
