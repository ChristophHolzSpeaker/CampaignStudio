import {
	complianceTransparencyFooterPropsSchema,
	frictionlessFunnelBookingPropsSchema,
	hybridContentSectionPropsSchema,
	immediateAuthorityHeroPropsSchema,
	logosOfTrustRibbonPropsSchema,
	proofOfPerformancePropsSchema,
	seoPropsSchema
} from './schema';
import type { PageSectionSpecMap } from './types';

export const sectionSpecs: PageSectionSpecMap = {
	seo: {
		type: 'seo',
		label: 'SEO Metadata',
		description:
			'Head metadata section for title, description, canonical, and social sharing tags.',
		whenToUse: [
			'Use once near the top of every page section array.',
			'Use when campaign pages need stable metadata for search and link previews.',
			'Use when Open Graph and Twitter cards should be explicitly controlled.'
		],
		whenNotToUse: [
			'Do not place multiple SEO sections on one page.',
			'Do not include unverified or misleading metadata claims.',
			'Do not omit title and description.'
		],
		contentGuidance: [
			'Title should stay concise and intent-driven.',
			'Description should reflect real page value and audience fit.',
			'Canonical URL should be absolute and stable when available.'
		],
		propsSchema: seoPropsSchema
	},
	immediate_authority_hero: {
		type: 'immediate_authority_hero',
		label: 'Immediate Authority Hero',
		description:
			'Primary above-the-fold section for message alignment, video proof, and decisive call-to-action.',
		whenToUse: [
			'Use at the top of every Christoph campaign landing page.',
			'Use when ad promise and landing page narrative need immediate alignment.',
			'Use when video proof should appear in the first viewport.'
		],
		whenNotToUse: [
			'Do not place this section more than once per page.',
			'Do not use when the page has no clear primary call-to-action.',
			'Do not use without a valid video proof asset.'
		],
		contentGuidance: [
			'Headline should be concrete, not abstract.',
			'Subheadline should sharpen outcome and relevance to audience.',
			'CTA copy should describe a clear next step.',
			'Video metadata should reflect real media only.'
		],
		propsSchema: immediateAuthorityHeroPropsSchema
	},
	logos_of_trust_ribbon: {
		type: 'logos_of_trust_ribbon',
		label: 'Logos of Trust Ribbon',
		description:
			'Authority and credibility ribbon that follows the hero with restrained social proof signals.',
		whenToUse: [
			'Use when credible authority markers or known organizations can be shown.',
			'Use directly below the hero in most campaign pages.',
			'Use to quickly establish legitimacy before deeper content.'
		],
		whenNotToUse: [
			'Do not invent logos or organizations.',
			'Do not overfill with low-relevance brands.',
			'Do not repeat trust ribbons in multiple page locations.'
		],
		contentGuidance: [
			'Prefer premium, recognizable, and relevant logos only.',
			'Keep optional title or label short and understated.',
			'Use accurate alt text for accessibility and clarity.'
		],
		propsSchema: logosOfTrustRibbonPropsSchema
	},
	hybrid_content_section: {
		type: 'hybrid_content_section',
		label: 'Hybrid Content Section',
		description:
			'Outcomes-and-credibility block that combines audience takeaways with Christoph qualification proof.',
		whenToUse: [
			'Use when both skim readers and detail-oriented readers must be served.',
			'Use after trust has been established and before conversion push.',
			'Use when the audience needs explicit takeaways plus speaker-qualification context.'
		],
		whenNotToUse: [
			'Do not overload with academic or overly technical language.',
			'Do not use when only a short summary is required.',
			'Do not include deep-dive entries that repeat benefit copy verbatim.',
			'Do not write generic claims that fail to connect audience, topic, and format.'
		],
		contentGuidance: [
			'Intro should bridge audience pain to practical event outcomes.',
			'Benefits should state what the audience will leave with, tied to campaign audience, topic, and format.',
			'Aim for exactly three benefits so the visual grid reads as complete and balanced.',
			'Benefit images should be relevant to each outcome and reinforce audience context, not generic decoration.',
			'Deep-dive title should bias strongly to "Why Christoph".',
			'Deep-dive items should explain why Christoph is qualified to deliver the stated outcomes.',
			'Supporting visuals should clarify content, not decorate it.'
		],
		propsSchema: hybridContentSectionPropsSchema
	},
	proof_of_performance: {
		type: 'proof_of_performance',
		label: 'Proof of Performance',
		description:
			'Testimonial and social proof section that supports credibility with specific, real-world feedback.',
		whenToUse: [
			'Use when legitimate testimonial evidence exists.',
			'Use to reduce skepticism before conversion sections.',
			'Use featured testimonial mode or balanced grid mode depending on available proof.'
		],
		whenNotToUse: [
			'Do not fabricate quotes, names, or companies.',
			'Do not use vague testimonials lacking specificity.',
			'Do not include headshots without permission or attribution context.'
		],
		contentGuidance: [
			'Quotes should be concrete, believable, and role-relevant.',
			'Person and company data should match real references.',
			'Feature flag can highlight one primary story when needed.'
		],
		propsSchema: proofOfPerformancePropsSchema
	},
	frictionless_funnel_booking: {
		type: 'frictionless_funnel_booking',
		label: 'Frictionless Funnel Booking',
		description:
			'Primary conversion section focused on low-friction booking flow and progressive disclosure cues.',
		whenToUse: [
			'Use as the main conversion section for inquiry and booking intent.',
			'Use when user qualification can start with lightweight intro questions.',
			'Use when a scheduler handoff such as Calendly may follow.'
		],
		whenNotToUse: [
			'Do not overload with long or high-friction form asks.',
			'Do not place competing conversion goals in the same section.',
			'Do not include scheduler links that are not ready for public traffic.'
		],
		contentGuidance: [
			'Lead with a clear, low-friction next step.',
			'Intro questions should be short and qualification-focused.',
			'Trust note and disclaimer should reduce uncertainty without legal overreach.'
		],
		propsSchema: frictionlessFunnelBookingPropsSchema
	},
	compliance_transparency_footer: {
		type: 'compliance_transparency_footer',
		label: 'Compliance & Transparency Footer',
		description:
			'Bottom-of-page compliance section carrying privacy, contact, and legitimacy information.',
		whenToUse: [
			'Use at the bottom of every Christoph campaign page.',
			'Use when privacy and legal transparency must be explicit.',
			'Use to provide reliable contact and business identity details.'
		],
		whenNotToUse: [
			'Do not omit from production pages.',
			'Do not hide critical privacy links.',
			'Do not include unverifiable or outdated business information.'
		],
		contentGuidance: [
			'Keep content concise, clear, and compliance-oriented.',
			'Privacy policy URL must be valid and reachable.',
			'Additional links should be relevant and minimal.'
		],
		propsSchema: complianceTransparencyFooterPropsSchema
	}
};
