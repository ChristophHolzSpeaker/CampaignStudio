import { landingPageAssetsSchema, type LandingPageAssets } from '../schemas/landing-page-assets';

export const landingPageAssets: LandingPageAssets = landingPageAssetsSchema.parse({
	heroDefaults: {
		videoEmbedUrl: 'https://www.youtube.com/watch?v=mpbtCg2NSUs',
		videoThumbnailUrl:
			'https://cdn.prod.website-files.com/61263e0de406f497361dca55/6130408552ea140d707aab8e_christoph-contact-bg.jpg',
		videoThumbnailAlt: 'Keynote speaker presenting to a business audience',
		primaryCtaLabelDefault: 'Request Speaking Availability',
		primaryCtaHref: 'https://christophholz.com/contact'
	},
	fixedLogosRibbon: {
		label: 'Trusted in executive and innovation contexts',
		logos: [
			{
				name: 'Executive Summits',
				imageUrl: '/CeBIT-Logo.png',
				alt: 'Executive Summits wordmark placeholder'
			},
			{
				name: 'Innovation Forums',
				imageUrl: '/cisco-svgrepo-com.svg',
				alt: 'Innovation Forums wordmark placeholder'
			},
			{
				name: 'Corporate Offsites',
				imageUrl: '/redbull-logo-svgrepo-com.svg',
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
	},
	assetCatalog: {
		heroVideos: [
			{
				id: 'hero-executive-stage-ai-strategy-v1',
				title: 'Executive keynote stage reel',
				description:
					'High-authority keynote footage focused on strategic AI transformation themes.',
				usageNotes:
					'Use when the campaign needs immediate executive credibility and strategic positioning.',
				avoidNotes: 'Avoid for small-room workshop framing.',
				videoEmbedUrl: 'https://www.youtube.com/watch?v=mpbtCg2NSUs',
				videoThumbnailUrl:
					'https://cdn.prod.website-files.com/61263e0de406f497361dca55/6130408552ea140d707aab8e_christoph-contact-bg.jpg',
				videoThumbnailAlt: 'Christoph Holz speaking on stage to an executive audience'
			},
			{
				id: 'hero-innovation-forum-q-and-a-v1',
				title: 'Innovation forum segment',
				description:
					'Conference clip with a practical innovation angle and audience engagement context.',
				usageNotes:
					'Use for campaigns emphasizing applied innovation and practical implementation.',
				avoidNotes: 'Avoid for conservative governance-only topics.',
				videoEmbedUrl: 'https://www.youtube.com/watch?v=mpbtCg2NSUs',
				videoThumbnailUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978',
				videoThumbnailAlt: 'Conference panel stage with a presenter addressing a business audience'
			}
		],
		hybridSupportingImages: [
			{
				id: 'hybrid-ai-roadmap-visual-v1',
				title: 'AI roadmap workshop board',
				description: 'Collaborative planning board that visualizes phased AI implementation.',
				usageNotes:
					'Use for sections that explain structured rollout plans and strategic sequencing.',
				imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40',
				alt: 'Workshop whiteboard covered with strategy notes and roadmap planning',
				caption: 'From experimentation to scaled operational execution'
			},
			{
				id: 'hybrid-executive-discussion-v1',
				title: 'Executive alignment discussion',
				description: 'Leadership group in an active strategy discussion setting.',
				usageNotes: 'Use for messaging focused on alignment, buy-in, and decision quality.',
				imageUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952',
				alt: 'Executive team in a strategic discussion around a conference table',
				caption: 'Alignment accelerates execution'
			}
		]
	}
});
