import {
	bookletDownloadCtaPropsSchema,
	complianceTransparencyFooterPropsSchema,
	frictionlessFunnelBookingPropsSchema,
	heroLargeEmailCtaPropsSchema,
	hybridContentSectionPropsSchema,
	immediateAuthorityHeroPropsSchema,
	keynoteSpeechesPropsSchema,
	logosOfTrustRibbonPropsSchema,
	speakerInActionPropsSchema,
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
			'Primary above-the-fold hero for campaigns that need instant credibility, strong message alignment, visual proof, and a decisive next step.',
		whenToUse: [
			'Use as the top section when the landing page needs to immediately prove Christoph’s authority, energy, and relevance.',
			'Use when the ad promise should connect directly to a strong keynote outcome in the first viewport.',
			'Use when video proof, stage presence, or a visual showreel is available and should carry the first impression.',
			'Use when the page needs a richer hero than a simple contact-first email CTA.',
			'Use for campaigns where visitors still need to understand why Christoph is credible before they are asked to enquire.'
		],
		whenNotToUse: [
			'Do not place this section more than once per page.',
			'Do not use together with another full hero section at the top of the same page.',
			'Do not use when there is no suitable video, stage, showreel, or authority-building media asset.',
			'Do not use when the campaign strategy is intentionally minimal and contact-first.',
			'Do not write generic speaker copy that could apply to any keynote presenter.'
		],
		contentGuidance: [
			'Headline should be concrete, punchy, and specific to the campaign audience, topic, and promised transformation.',
			'Subheadline should connect the audience’s business challenge to Christoph’s distinctive mix of AI, transformation, aviation, robotics, science, humour, and stage energy.',
			'Copy should feel bold, curious, and alive — more “this will be memorable” than standard corporate keynote language.',
			'Label text should create immediate authority or relevance, using ideas like “Keynote speaker”, “AI transformation keynote”, “For leaders navigating change”, or campaign-specific audience framing.',
			'CTA copy should describe a confident next step, such as starting a conversation, watching the showreel, checking availability, or enquiring about a keynote.',
			'Media copy and metadata should describe real assets only, preferably stage footage, keynote clips, audience reactions, or Christoph’s distinctive visual identity.',
			'Avoid vague phrases like “unlock your potential”, “inspire innovation”, or “future-ready success” unless they are anchored to a specific audience outcome.'
		],
		propsSchema: immediateAuthorityHeroPropsSchema
	},

	hero_large_email_cta: {
		type: 'hero_large_email_cta',
		label: 'Hero Large Email CTA',
		description:
			'Bold, minimal, contact-first hero for campaigns where the fastest useful action is to email Christoph’s team directly.',
		whenToUse: [
			'Use as the top section when the page strategy is direct outreach rather than video-led persuasion.',
			'Use when the campaign is aimed at high-intent visitors who already understand they may want Christoph for an event.',
			'Use when a monitored inbox is the preferred conversion path and a mailto handoff is more appropriate than a form or booking widget.',
			'Use when the page needs a striking, simple, high-contrast opening with very little friction.',
			'Use as an alternative to immediate_authority_hero, not as an additional hero directly after it.'
		],
		whenNotToUse: [
			'Do not use if the campaign requires multi-step qualification before contact.',
			'Do not use when no monitored inbox is available for fast response.',
			'Do not use with non-email primary conversion goals.',
			'Do not use below another hero section as a repeated opening block.',
			'Do not use when the visitor needs substantial proof, context, or video evidence before the first CTA.'
		],
		contentGuidance: [
			'Heading should be short, bold, and memorable, with a clear event or audience outcome rather than generic speaker positioning.',
			'Heading should still feel like Christoph: energetic, slightly unexpected, intelligent, and colourful rather than safe corporate copy.',
			'Label text should frame readiness, urgency, or relevance in plain language, using ideas like “Planning an event?”, “Need a keynote speaker?”, “For bold business events”, or campaign-specific audience framing.',
			'Supporting copy should make direct email feel easy, human, and low-friction: invite the visitor to ask about availability, fit, topic, or event format.',
			'Where appropriate, reference Christoph’s distinctive territory — AI, transformation, aviation, robotics, science, humour, bow ties, and memorable stage energy — without overloading the hero.',
			'CTA copy should be direct and email-led, such as “Email Christoph’s team”, “Ask about availability”, “Start the keynote conversation”, or “Send an enquiry”.',
			'Treat this as copy-only content; contact routing is provided by the rendering pipeline.'
		],
		propsSchema: heroLargeEmailCtaPropsSchema
	},
	booklet_download_cta: {
		type: 'booklet_download_cta',
		label: 'Booklet Download CTA',
		description:
			'Low-friction, no-opt-in section for offering Christoph’s free booklet as a personality-rich introduction to his themes, stories, and stage energy.',
		whenToUse: [
			'Use when visitors would benefit from a quick, visual introduction to Christoph before making contact.',
			'Use when the campaign needs a generous free resource that builds trust without asking for an email address.',
			'Use when the page should give visitors something easy to read, save, share, or forward to a colleague.',
			'Use as a mid-to-lower page conversion assist before stronger contact, enquiry, or booking CTAs.'
		],
		whenNotToUse: [
			'Do not use when no real booklet asset is available.',
			'Do not use as the only conversion path on high-intent booking pages.',
			'Do not make the booklet feel like a generic lead magnet, report, brochure, or gated PDF.',
			'Do not write vague copy that only says “download our booklet” without capturing Christoph’s personality or themes.'
		],
		contentGuidance: [
			'Label should clearly reduce friction, using ideas like “Free resource”, “No signup required”, or “Free booklet”.',
			'Heading should make the offer feel immediate and human, preferably framing the booklet as a way to “meet Christoph” or get a quick taste of his world.',
			'Paragraph should mention Christoph’s distinctive mix of topics, such as AI, aviation, robotics, science, transformation, and his energetic keynote style.',
			'Paragraph should feel generous and light, making it clear that there is no form, no email requirement, and no hidden opt-in.',
			'Copy should be more characterful than corporate: curious, visual, slightly playful, and specific to Christoph rather than generic business-download language.',
			'Button CTA should be short, action-led, and explicit about the free download, such as “Download the booklet”, “Download booklet free”, or “Get the free booklet”.'
		],
		propsSchema: bookletDownloadCtaPropsSchema
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
	keynote_speeches: {
		type: 'keynote_speeches',
		label: 'Keynote Speeches',
		description:
			'Curated keynote gallery section with three approved talks resolved from the keynote library by ID.',
		whenToUse: [
			'Use directly after logos_of_trust_ribbon to transition from trust markers into concrete keynote topics.',
			'Use when at least three approved keynotes are available in the keynote catalog.',
			'Use when visitors need specific talk options before deeper proof and conversion sections.'
		],
		whenNotToUse: [
			'Do not use when fewer than three approved keynotes are available.',
			'Do not invent keynote titles, summaries, or images outside the curated keynote catalog.',
			'Do not place this section below conversion-heavy sections where keynote discovery is no longer useful.'
		],
		contentGuidance: [
			'Write a clear section title and intro aligned to campaign audience and topic.',
			'Select exactly three keynote IDs from approved catalog entries.',
			'Keep keynote cards concrete, distinctive, and aligned to real talk themes.'
		],
		propsSchema: keynoteSpeechesPropsSchema
	},
	speaker_in_action: {
		type: 'speaker_in_action',
		label: 'Speaker in Action',
		description:
			'Video-first proof gallery section that showcases Christoph on stage through curated clips and supporting stills.',
		whenToUse: [
			'Use when at least four approved stage videos are available in the media asset catalog.',
			'Use before proof_of_performance when visual authority should be established before written testimonials.',
			'Use when the campaign audience values speaking style, stage presence, and delivery energy as decision factors.'
		],
		whenNotToUse: [
			'Do not use when fewer than four suitable approved video assets are available.',
			'Do not use with unverified, off-brand, or non-stage footage.',
			'Do not replace proof_of_performance if strong testimonial evidence should also be shown.'
		],
		contentGuidance: [
			'Prefer high-authority keynote footage aligned to audience and event format intent.',
			'Grid assets should feel cohesive in quality, framing, and visual tone.',
			'Asset titles should be short and informative for accessibility and editorial clarity.'
		],
		propsSchema: speakerInActionPropsSchema
	},
	hybrid_content_section: {
		type: 'hybrid_content_section',
		label: 'Hybrid Content Section',
		description:
			'Signature outcomes-and-credibility section that pairs three concrete audience takeaways with a “Why Christoph” proof block, using a more visual, characterful, Christoph-specific framing.',
		whenToUse: [
			'Use when the page needs to show what the audience will actually leave with after Christoph’s keynote, workshop, or session.',
			'Use when both skim readers and detail-oriented readers must be served: quick outcome cards first, deeper credibility context second.',
			'Use after the hero has established the campaign promise and before stronger conversion CTAs.',
			'Use when the audience needs to connect the topic to practical business value, not just inspiration.',
			'Use when the page should explain why Christoph is the right person to deliver this particular message.'
		],
		whenNotToUse: [
			'Do not overload with academic, technical, or consultant-style language.',
			'Do not use when only a short summary or simple feature list is required.',
			'Do not include deep-dive entries that repeat the benefit cards verbatim.',
			'Do not write generic claims that could apply to any keynote speaker, futurist, or innovation consultant.',
			'Do not make the section feel like a standard “three benefits” SaaS block; it should carry Christoph’s personality, curiosity, and stage energy.',
			'Do not use abstract buzzwords unless they are tied to a clear audience outcome.'
		],
		contentGuidance: [
			'Intro should bridge the audience’s real challenge to practical event outcomes, while keeping the tone lively, curious, and human.',
			'Benefits should state what the audience will leave with, tied directly to the campaign audience, topic, and format.',
			'Aim for exactly three benefits so the visual grid reads as complete and balanced.',
			'Each benefit should feel concrete and memorable: a useful lens, a new way to think, a practical conversation starter, or a shift the audience can apply after the event.',
			'Benefit titles should be punchy and specific, not vague phrases like “Inspiration”, “Innovation”, or “Transformation”.',
			'Benefit descriptions should avoid generic corporate language and instead connect business relevance with Christoph’s distinctive territory: AI, transformation, aviation, robotics, science, humour, curiosity, and memorable stagecraft.',
			'Benefit images should feel visually cohesive across all three cards, using a shared colour mood, lighting style, or abstract editorial system rather than mismatched stock imagery.',
			'Benefit images should support the outcome directly, but they may be semi-abstract or metaphorical when that better captures the feeling of the idea.',
			'Deep-dive title should bias strongly to “Why Christoph”.',
			'Deep-dive intro should make the credibility argument feel natural: why this speaker, why this topic, why this audience, why now.',
			'Deep-dive items should explain why Christoph is qualified to deliver the stated outcomes, drawing on his mix of keynote experience, AI and technology themes, aviation, robotics, science communication, humour, and distinctive stage presence.',
			'Supporting visuals should clarify and amplify the content, not decorate it.',
			'Overall, the section should feel like three useful takeaways plus a credible reason to believe Christoph can make them land in the room.'
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
