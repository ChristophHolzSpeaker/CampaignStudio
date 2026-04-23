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
		label: "Trusted by the world's bold leaders",
		logos: [
			{
				name: 'Executive Summits',
				imageUrl: '/CeBIT-Logo.png',
				alt: 'CeBIT'
			},
			{
				name: 'Cisco',
				imageUrl: '/cisco-svgrepo-com.svg',
				alt: 'Cisco'
			},
			{
				name: 'Redbull',
				imageUrl: '/redbull-logo-svgrepo-com.svg',
				alt: 'Redbull'
			},
			{
				name: 'Google',
				imageUrl: '/68231e19a6b5c7afb9fdbf99_Google_2015_logo.svg.webp',
				alt: 'Google'
			},
			{
				name: 'Atos',
				imageUrl: '/68231e18e79c638d8f3661bb_Atos.svg',
				alt: 'Atos'
			},
			{
				name: 'BMW Group',
				imageUrl: '/68231e4f2fdb78ace3f120ee_BMW_Group.svg',
				alt: 'BMW Group'
			}
		]
	},
	fixedProofOfPerformance: {
		title: 'What organizers say after the keynote',
		testimonials: [
			{
				quote:
					'ER IST WOHL EINER DER PROFILIERTESTEN SEINES FACHES. KAUM JEMAND HAT DIE DIGITALE TRANSFORMATION SO UMFASSEND, KRITISCH UND GLEICHZEITIG SO UNTERHALTSAM AUF DEM SCHIRM WIE ER.',
				name: 'Jörg Rositzke',
				role: 'Managing Director',
				company: 'Hamburg 1 Fernsehen',
				photoUrl: '/Hamburg1-Joerg-Rositzke-ic40years-300x300.jpg',
				photoAlt: 'Portrait for Jörg Rositzke',
				rating: 5,
				featured: true
			},
			{
				quote:
					'Christoph hat ein unglaublich breites Fachwissen und schafft es die Themen der Zukunft in den heutigen Alltag zu übersetzen. Als Zuhörer wird man immer wieder in seine Spannungsbögen gezogen.',
				name: 'Armin Skoff',
				role: 'Channel Marketing',
				company: 'Microsoft Austria',
				photoUrl: '/1695903089730.jpeg',
				photoAlt: 'Portrait for Armin Skoff',
				rating: 5
			},
			{
				quote:
					'Vielen Dank, Christoph! Deine Begeisterung und Leidenschaft, verbunden mit einem hohen Grad an Professionalität, welche Deinen Vortrag erlebbar machen, ist eine große Freude und Bereicherung für unsere Veranstaltung gewesen.',
				name: 'Ivonne Dombrowe',
				role: 'Senior Project Manager',
				company: 'FLEET Education Events',
				photoUrl: '/ivonne-dombrowe-geb-redmann.256x256.jpg',
				photoAlt: 'Portrait for Ivonne Dombrowe',
				rating: 5
			}
		]
	},
	bookingDefaults: {
		defaultSectionTitle: 'Tell us about your event goals',
		defaultSectionDescription:
			'Share your audience, timeline, and outcomes. We will respond quickly with fit and next steps.',
		primaryCtaLabelDefault: 'Start Booking Request',
		trustNote: 'This page uses curated campaign assets and messaging for internal MVP generation.',
		formDisclaimer:
			'By submitting, you agree to be contacted regarding speaking availability and event fit.'
	},
	complianceDefaults: {
		privacyPolicyUrl: 'https://christophholz.com/privacy',
		contactEmail: 'speaker@christophholz.com',
		businessAddress: 'Dipl.-Informatiker Christoph Holz Achenallee 16A 6380 St. Johann in Tirol',
		phone: '+4369917407401',
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
