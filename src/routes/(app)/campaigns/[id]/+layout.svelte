<script lang="ts">
	import { page } from '$app/state';
	import CampaignHeader from '$lib/components/campaign/CampaignHeader.svelte';
	import type {
		CampaignAdGroupWithDetails,
		CampaignAdPackageWithDetails,
		CampaignRecord
	} from '$lib/server/campaigns/client';
	import type { CampaignVisitMetrics } from '$lib/validation/campaign-visit-metrics';

	let { data, children } = $props();

	const getPageData = () =>
		data as {
			campaign?: CampaignRecord;
			visitMetrics?: CampaignVisitMetrics | null;
			adGroups?: CampaignAdGroupWithDetails[];
			adPackage?: CampaignAdPackageWithDetails | null;
			campaignPageId?: number | null;
			liveLandingUrl?: string | null;
		};

	const getCampaign = () => getPageData().campaign ?? null;

	const getLiveLandingUrl = () => getPageData().liveLandingUrl ?? null;
	const hideHeader = $derived(page.url.pathname.endsWith('/landing-page'));
</script>

{#if !hideHeader}
	<CampaignHeader campaign={getCampaign()} liveLandingUrl={getLiveLandingUrl()} />
{/if}

{@render children()}
