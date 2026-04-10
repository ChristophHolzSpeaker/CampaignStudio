import type { LandingPageDocument } from './types';

export const christophSampleLandingPage: LandingPageDocument = {
	version: 1,
	title: 'Christoph Holz | Keynote Booking Preview',
	slug: 'christoph-keynote-preview',
	sections: [
		{
			type: 'seo',
			props: {
				title: 'Christoph Holz Keynote Speaker | AI Leadership for Executive Teams',
				description:
					'Preview page for booking Christoph Holz: practical AI leadership keynote content, event fit guidance, and a clear inquiry path for organizers.',
				canonicalUrl: 'https://christophholz.com/keynotes/ai-leadership',
				robots: 'noindex,nofollow',
				ogImageUrl: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2',
				ogImageAlt: 'Stage lighting and conference audience before a keynote session',
				ogType: 'website',
				twitterCard: 'summary_large_image',
				twitterSite: '@christophholz'
			}
		},
		{
			type: 'immediate_authority_hero',
			props: {
				eyebrow: 'Leadership Keynote Speaker',
				headline:
					'Book Christoph Holz for practical AI leadership insights your team can apply fast.',
				subheadline:
					'For executive teams and innovation leaders who want clear frameworks, grounded examples, and a keynote that drives immediate internal momentum.',
				primaryCtaLabel: 'Request Speaking Availability',
				primaryCtaHref: 'https://christophholz.com/contact',
				videoEmbedUrl: 'https://player.vimeo.com/video/76979871',
				videoThumbnailUrl:
					'https://cdn.prod.website-files.com/61263e0de406f497361dca55/6130408552ea140d707aab8e_christoph-contact-bg.jpg',
				videoThumbnailAlt: 'Christoph presenting on stage to a leadership audience',
				supportingBullets: [
					'Built for leadership teams navigating AI-driven change',
					'Actionable keynote structure with practical takeaways',
					'Clear next steps for post-event execution'
				]
			}
		},
		{
			type: 'logos_of_trust_ribbon',
			props: {
				label: 'Common speaking contexts',
				logos: [
					{
						name: 'Executive Summits',
						imageUrl: 'https://dummyimage.com/220x80/f3f3f3/1a1c1c.png&text=Executive+Summits',
						alt: 'Executive Summits wordmark placeholder'
					},
					{
						name: 'Innovation Forums',
						imageUrl: 'https://dummyimage.com/220x80/f3f3f3/1a1c1c.png&text=Innovation+Forums',
						alt: 'Innovation Forums wordmark placeholder'
					},
					{
						name: 'Corporate Offsites',
						imageUrl: 'https://dummyimage.com/220x80/f3f3f3/1a1c1c.png&text=Corporate+Offsites',
						alt: 'Corporate Offsites wordmark placeholder'
					}
				]
			}
		},
		{
			type: 'proof_of_performance',
			props: {
				title: 'What event organizers value most',
				testimonials: [
					{
						quote:
							'Christoph translated a complex AI topic into language our leadership team could align on immediately. The session sparked concrete follow-up initiatives.',
						name: 'Maya Chen',
						role: 'Director of Strategy',
						company: 'Private Technology Group',
						photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
						photoAlt: 'Portrait of Maya Chen',
						rating: 5,
						featured: true
					},
					{
						quote:
							'The keynote balanced vision and execution. Our managers left with practical frameworks, not just inspiration.',
						name: 'Daniel Romero',
						role: 'Head of Operations',
						company: 'Global Services Firm',
						photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
						photoAlt: 'Portrait of Daniel Romero',
						rating: 5
					}
				]
			}
		},
		{
			type: 'frictionless_funnel_booking',
			props: {
				title: 'Tell us about your event goals',
				description:
					'Share your audience, event timing, and desired outcomes. We will confirm fit and next steps quickly.',
				primaryCtaLabel: 'Start Booking Request',
				introQuestions: [
					{
						id: 'event_type',
						label: 'What type of event are you planning?',
						placeholder: 'Conference, leadership offsite, or internal summit',
						type: 'text'
					},
					{
						id: 'target_date',
						label: 'Preferred speaking date or date range',
						placeholder: 'e.g. September 2026',
						type: 'text'
					},
					{
						id: 'contact_email',
						label: 'Best email for follow-up',
						placeholder: 'name@company.com',
						type: 'email'
					}
				],
				calendlyUrl: 'https://calendly.com/christophholz/speaking-discovery',
				trustNote:
					'Internal preview: response-time and availability details shown here are placeholders.',
				formDisclaimer:
					'By submitting, you agree to be contacted about speaking availability and event fit.'
			}
		},
		{
			type: 'compliance_transparency_footer',
			props: {
				privacyPolicyUrl: 'https://christophholz.com/privacy',
				contactEmail: 'team@christophholz.com',
				businessAddress: 'Vienna, Austria',
				phone: '+43 1 555 0100',
				copyrightText: '© Christoph Holz. All rights reserved.',
				additionalLinks: [
					{
						label: 'Imprint',
						href: 'https://christophholz.com/imprint'
					}
				]
			}
		}
	]
};
