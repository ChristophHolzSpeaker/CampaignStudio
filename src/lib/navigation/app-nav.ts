export type AppNavItem = {
	label: string;
	href?: string;
	icon?: string;
	disabled?: boolean;
	match?: 'exact' | 'prefix';
};

export type AppNavCategory = {
	label: string;
	items: readonly AppNavItem[];
};

type CampaignNavData = {
	campaign?: {
		id: number;
	};
	campaignPageId?: number | null;
};

const baseCategories: readonly AppNavCategory[] = [
	{
		label: 'Campaigns',
		items: [
			{ label: 'Campaigns', href: '/campaigns', match: 'exact', icon: 'material-symbols--book' },
			{
				label: 'Campaign Analytics',
				href: '/campaigns/analytics',
				match: 'exact',
				icon: 'mdi--chart-areaspline'
			}
		]
	},
	{
		label: 'Admin',
		items: [
			{
				label: 'Prompts',
				href: '/admin/prompts',
				match: 'prefix',
				icon: 'material-symbols--edit-note'
			},
			{
				label: 'Bookings settings',
				href: '/admin/bookings',
				match: 'prefix',
				icon: 'mdi--calendar-clock-outline'
			},
			{
				label: 'Logos',
				href: '/admin/clients',
				match: 'prefix',
				icon: 'mdi--account-box-multiple'
			},
			{
				label: 'Keynotes',
				href: '/admin/keynotes',
				match: 'prefix',
				icon: 'mdi--microphone-variant'
			}
		]
	}
];

export function getAppNavCategories(
	pathname: string,
	data: CampaignNavData = {}
): readonly AppNavCategory[] {
	const detailMatch = pathname.match(/^\/campaigns\/(\d+)(?:\/.*)?$/);
	if (!detailMatch) return baseCategories;

	const campaignId = Number(detailMatch[1]);
	const resolvedCampaignId = data.campaign?.id ?? campaignId;
	const previewHref = data.campaignPageId
		? `/campaigns/${resolvedCampaignId}/landing-page`
		: undefined;

	const campaignContext: AppNavCategory = {
		label: 'Campaign Context',
		items: [
			{
				label: 'Ads',
				href: `/campaigns/${resolvedCampaignId}`,
				match: 'exact',
				icon: 'mdi--google-ads'
			},
			{
				label: 'Landing Page Preview',
				href: previewHref,
				match: 'prefix',
				disabled: !previewHref,
				icon: 'mdi--page-layout-header'
			},
			{
				label: 'Analytics',
				href: `/campaigns/${resolvedCampaignId}/analytics`,
				match: 'prefix',
				icon: 'mdi--chart-areaspline'
			}
		]
	};

	return [campaignContext, ...baseCategories];
}
