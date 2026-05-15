<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/elements/Button.svelte';
	import type {
		CampaignAdGroupWithDetails,
		CampaignAdPackageWithDetails,
		CampaignRecord
	} from '$lib/server/campaigns/client';
	import type { CampaignVisitMetrics } from '$lib/validation/campaign-visit-metrics';

	let { data, children } = $props();

	const formatFriendlyDate = (value?: Date | string) => {
		if (!value) return 'Pending';
		const date = typeof value === 'string' ? new Date(value) : value;
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(date);
	};

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

	let copyStatus = $state<'idle' | 'copied' | 'error'>('idle');
	let busy = $state(false);

	const copyLiveLandingUrl = async () => {
		busy = true;
		const liveLandingUrl = getLiveLandingUrl();

		if (!liveLandingUrl) {
			copyStatus = 'error';
			return;
		}

		if (typeof navigator === 'undefined' || !navigator.clipboard) {
			copyStatus = 'error';
			return;
		}

		try {
			await navigator.clipboard.writeText(liveLandingUrl);
			copyStatus = 'copied';
		} catch {
			copyStatus = 'error';
		}
		busy = false;
	};
	const targetStatus = (status?: string) => (status === 'published' ? 'archived' : 'published');
	const publishLabel = (status?: string) =>
		status === 'published' ? 'Archive' : 'Publish campaign';
</script>

<section class="p-6 lg:p-10">
	<div class="mx-auto">
		<header class="mb-10">
			<div class="mb-4 flex items-center gap-2">
				<span
					class="rounded px-3 py-1 font-['Space_Grotesk'] text-[10px] font-bold text-white uppercase"
					class:bg-sky-400={getCampaign()?.status === 'draft'}
					class:bg-green-400={getCampaign()?.status === 'published'}
					class:bg-slate-400={getCampaign()?.status === 'archived'}
				>
					{(getCampaign()?.status ?? 'draft').toUpperCase()}
				</span>
				<span class="font-['Space_Grotesk'] text-[10px] font-medium text-slate-400 uppercase">
					Created {formatFriendlyDate(getCampaign()?.created_at)}
				</span>
			</div>
			<h1 class="mb-2 text-5xl leading-tight font-extrabold tracking-tighter text-on-surface">
				{getCampaign()?.name ?? 'Campaign overview'}
			</h1>
			<p class="font-medium text-slate-500">
				{getCampaign()?.topic ?? 'Campaign topic pending.'}
				{getCampaign()?.audience ? ` · ${getCampaign()?.audience}` : ''}
			</p>
			<form action="?/publish" use:enhance method="POST" class="mt-4 flex justify-end">
				<input type="hidden" name="id" value={getCampaign()?.id} />

				<input type="hidden" name="target_status" value={targetStatus(getCampaign()?.status)} />
				<Button>
					{publishLabel(getCampaign()?.status)}
				</Button>
			</form>

			{#if getCampaign()?.status === 'published'}
				<div>
					<span
						class="mb-2 block font-['Space_Grotesk'] text-[10px] font-bold text-primary uppercase"
					>
						Live Landing Page
					</span>
					{#if getLiveLandingUrl()}
						<div class="space-y-3 rounded bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
							<p class="font-['Space_Grotesk'] text-[11px] break-all text-slate-700">
								{getLiveLandingUrl()}
							</p>
							<Button onclick={copyLiveLandingUrl} isSubmitting={busy} type="button" variant="dark"
								>{copyStatus === 'copied' ? 'Copied' : 'Copy link'}</Button
							>
							{#if copyStatus === 'error'}
								<p class="text-[11px] text-red-500">
									Couldn't copy automatically. Copy it manually.
								</p>
							{/if}
						</div>
					{:else}
						<p class="text-xs text-slate-500 italic">
							Live URL will appear once the landing page slug is available.
						</p>
					{/if}
				</div>
			{/if}
		</header>
	</div>
</section>
{@render children()}
