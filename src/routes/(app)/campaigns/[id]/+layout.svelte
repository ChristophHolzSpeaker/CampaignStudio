<script lang="ts">
	import Button from '$lib/components/elements/Button.svelte';
	import NavButton from '$lib/components/elements/NavButton.svelte';
	import { publishCampaign } from './campaign-status.remote';
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
	let copied = $state(false);

	const copyLiveLandingUrl = async () => {
		busy = true;
		copied = true;
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
		setTimeout(() => {
			copied = false;
		}, 1600);
		busy = false;
	};
	const targetStatus = (status?: string) => (status === 'published' ? 'archived' : 'published');
	const publishLabel = (status?: string) =>
		status === 'published' ? 'Archive' : 'Publish campaign';
	const publishAction = $derived(publishCampaign.for(String(getCampaign()?.id ?? 'none')));
</script>

<section class="p-6 lg:p-10">
	<div class="mx-auto">
		<header class="border border-stone-100 bg-white p-4">
			<div class="">
				<div class="flex items-center justify-between gap-2">
					<div>
						<span
							class="rounded px-3 py-1 font-sans text-[10px] font-bold text-white uppercase"
							class:bg-sky-400={getCampaign()?.status === 'draft'}
							class:bg-green-400={getCampaign()?.status === 'published'}
							class:bg-slate-400={getCampaign()?.status === 'archived'}
						>
							{(getCampaign()?.status ?? 'draft').toUpperCase()}
						</span>
						<span class="font-sans text-[10px] font-medium text-slate-400 uppercase">
							Created {formatFriendlyDate(getCampaign()?.created_at)}
						</span>
					</div>
					<form {...publishAction} class="flex justify-end">
						<input type="hidden" name="id" value={getCampaign()?.id} />

						<input type="hidden" name="target_status" value={targetStatus(getCampaign()?.status)} />
						<Button>
							{publishLabel(getCampaign()?.status)}
						</Button>
					</form>
				</div>
				<h1 class="mb-2 text-3xl leading-tight font-extrabold tracking-tighter text-on-surface">
					{getCampaign()?.name ?? 'Campaign overview'}
				</h1>
				<p class="font-medium text-slate-500">
					{getCampaign()?.topic ?? 'Campaign topic pending.'}
					{getCampaign()?.audience ? ` · ${getCampaign()?.audience}` : ''}
				</p>
			</div>
			{#if getCampaign()?.status === 'published'}
				<div>
					{#if getLiveLandingUrl()}
						<div class="space-x-3">
							<a
								href={getLiveLandingUrl()}
								class="hover:decoration-underline font-sans text-sm break-all text-blue-600 lowercase"
								target="_blank"
							>
								{copied ? 'Copied!' : getLiveLandingUrl()}
							</a>

							<button
								class="mdi--content-copy inline-block h-4 w-4 cursor-pointer hover:text-primary"
								onclick={copyLiveLandingUrl}
								aria-label="Copy link to clipboard"
							></button>

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

<style>
	.mdi--content-copy {
		display: inline-block;

		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M19 21H8V7h11m0-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m-3-4H4a2 2 0 0 0-2 2v14h2V3h12z'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}
</style>
