import { landingPageAssetsSchema, type LandingPageAssets } from '../schemas/landing-page-assets';

export const landingPageAssets: LandingPageAssets = landingPageAssetsSchema.parse({
	heroDefaults: {
		videoEmbedUrl: 'https://player.vimeo.com/video/76979871',
		videoThumbnailUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978',
		videoThumbnailAlt: 'Keynote speaker presenting to a business audience',
		primaryCtaLabelDefault: 'Request Speaking Availability',
		primaryCtaHref: 'https://christophholz.com/contact'
	},
	fixedLogosRibbon: {
		label: 'Trusted in executive and innovation contexts',
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
	},
	fixedProofOfPerformance: {
		title: 'What organizers say after the keynote',
		testimonials: [
			{
				quote:
					'Christoph turned a complex AI topic into actionable direction our leadership team could align around immediately.',
				name: 'Alex Morgan',
				role: 'Director of Strategy',
				company: 'Enterprise Leadership Forum',
				photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
				photoAlt: 'Portrait placeholder for Alex Morgan',
				rating: 5,
				featured: true
			},
			{
				quote:
					'Clear, commercially grounded, and highly relevant to executives deciding how to apply AI in real operations.',
				name: 'Jordan Reyes',
				role: 'Head of Operations',
				company: 'Global Services Summit',
				photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
				photoAlt: 'Portrait placeholder for Jordan Reyes',
				rating: 5
			}
		]
	},
	bookingDefaults: {
		defaultSectionTitle: 'Tell us about your event goals',
		defaultSectionDescription:
			'Share your audience, timeline, and outcomes. We will respond quickly with fit and next steps.',
		primaryCtaLabelDefault: 'Start Booking Request',
		calendlyUrl: 'https://calendly.com/christophholz/speaking-discovery',
		trustNote: 'This page uses curated campaign assets and messaging for internal MVP generation.',
		formDisclaimer:
			'By submitting, you agree to be contacted regarding speaking availability and event fit.'
	},
	complianceDefaults: {
		privacyPolicyUrl: 'https://christophholz.com/privacy',
		contactEmail: 'team@christophholz.com',
		businessAddress: 'Vienna, Austria',
		phone: '+43 1 555 0100',
		copyrightText: '© Christoph Holz. All rights reserved.',
		additionalLinks: [{ label: 'Imprint', href: 'https://christophholz.com/imprint' }]
	}
});
