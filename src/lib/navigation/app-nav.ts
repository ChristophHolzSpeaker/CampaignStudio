export type AppNavItem = {
	label: string;
	href?: string;
	disabled?: boolean;
	match?: 'exact' | 'prefix';
	level?: 0 | 1 | 2;
};

export type AppNavCategory = {
	id: string;
	label: string;
	items: readonly AppNavItem[];
};

type CampaignNavData = {
	campaign?: {
		id: number;
		name?: string | null;
	};
	campaignPageId?: number | null;
	campaignList?: Array<{
		id: number;
		name: string;
	}>;
};

const baseCategories: readonly AppNavCategory[] = [
	{
		id: 'admin',
		label: 'Admin',
		items: [
			{
				label: 'Prompts',
				href: '/admin/prompts',
				match: 'prefix'
			},
			{
				label: 'Bookings settings',
				href: '/admin/bookings',
				match: 'prefix'
			},
			{
				label: 'Logos',
				href: '/admin/logos',
				match: 'prefix'
			},
			{
				label: 'Keynotes',
				href: '/admin/keynotes',
				match: 'prefix'
			}
		]
	}
];

export function getAppNavCategories(
	pathname: string,
	data: CampaignNavData = {}
): readonly AppNavCategory[] {
	const detailMatch = pathname.match(/^\/campaigns\/(\d+)(?:\/.*)?$/);
	const resolvedCampaignId = detailMatch ? (data.campaign?.id ?? Number(detailMatch[1])) : null;
	const previewHref = resolvedCampaignId
		? `/campaigns/${resolvedCampaignId}/landing-page`
		: undefined;

	const campaignItems: AppNavItem[] = [
		{ label: 'Campaigns', href: '/campaigns', match: 'exact', level: 0 }
	];

	for (const campaign of data.campaignList ?? []) {
		campaignItems.push({
			label: campaign.name,
			href: `/campaigns/${campaign.id}`,
			match: 'prefix',
			level: 1
		});

		if (resolvedCampaignId === campaign.id) {
			campaignItems.push(
				{
					label: 'Ads',
					href: `/campaigns/${campaign.id}/ads`,
					match: 'prefix',
					level: 2
				},
				{
					label: 'Landing Page Preview',
					href: previewHref,
					match: 'prefix',
					disabled: !previewHref,
					level: 2
				},
				{
					label: 'Analytics',
					href: `/campaigns/${campaign.id}/analytics`,
					match: 'prefix',
					level: 2
				}
			);
		}
	}

	const campaignsCategory: AppNavCategory = {
		id: 'campaigns',
		label: 'Campaigns',
		items: campaignItems
	};

	return [campaignsCategory, ...baseCategories];
}
