<script lang="ts">
	import Button from '$lib/components/elements/Button.svelte';
	import { publishCampaign } from '../../../routes/(app)/campaigns/[id]/campaign-status.remote';
	import type { CampaignRecord } from '$lib/server/campaigns/client';

	interface Props {
		campaign: CampaignRecord | null;
		liveLandingUrl: string | null;
	}

	let { campaign, liveLandingUrl }: Props = $props();

	const formatFriendlyDate = (value?: Date | string) => {
		if (!value) return 'Pending';
		const date = typeof value === 'string' ? new Date(value) : value;
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(date);
	};

	let copyStatus = $state<'idle' | 'copied' | 'error'>('idle');
	let copied = $state(false);

	const copyLiveLandingUrl = async () => {
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
			copied = true;
		} catch {
			copyStatus = 'error';
		}

		setTimeout(() => {
			copied = false;
		}, 1600);
	};

	const targetStatus = (status?: string) => (status === 'published' ? 'archived' : 'published');
	const publishLabel = (status?: string) =>
		status === 'published' ? 'Archive' : 'Publish campaign';
	const publishAction = $derived(publishCampaign.for(String(campaign?.id ?? 'none')));
</script>

<header class="border-b border-stone-300 bg-white px-4 py-2">
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0 flex-1">
			<div class="flex min-w-0 items-center gap-2">
				<h1
					class="truncate font-sans text-base leading-tight font-extrabold tracking-tighter text-on-surface"
				>
					{campaign?.name ?? 'Campaign overview'}
				</h1>

				<span
					class="shrink-0 rounded px-2 py-0.5 font-sans text-[9px] font-bold text-white uppercase"
					class:bg-sky-400={campaign?.status === 'draft'}
					class:bg-green-400={campaign?.status === 'published'}
					class:bg-slate-400={campaign?.status === 'archived'}
				>
					{(campaign?.status ?? 'draft').toUpperCase()}
				</span>
			</div>

			<div class="mt-0.5 flex min-w-0 items-center gap-2">
				<span class="shrink-0 font-sans text-[10px] font-medium text-slate-400 uppercase">
					Created {formatFriendlyDate(campaign?.created_at)}
				</span>

				{#if campaign?.status === 'published'}
					<span class="text-[10px] text-slate-300">•</span>

					{#if liveLandingUrl}
						<div class="flex min-w-0 items-center gap-1">
							<a
								href={liveLandingUrl}
								class="truncate font-sans text-[11px] text-blue-600 lowercase hover:underline"
								target="_blank"
								title={liveLandingUrl}
							>
								{copied ? 'Copied!' : liveLandingUrl}
							</a>

							<button
								class="mdi--content-copy inline-block h-3.5 w-3.5 shrink-0 cursor-pointer text-slate-400 hover:text-primary"
								onclick={copyLiveLandingUrl}
								aria-label="Copy link to clipboard"
								type="button"
							></button>
						</div>
					{:else}
						<p class="truncate text-[11px] text-slate-500 italic">
							Live URL will appear once the landing page slug is available.
						</p>
					{/if}
				{/if}
			</div>

			{#if copyStatus === 'error'}
				<p class="mt-1 text-[11px] text-red-500">Couldn't copy automatically. Copy it manually.</p>
			{/if}
		</div>

		<form {...publishAction} class="flex shrink-0 justify-end">
			<input type="hidden" name="id" value={campaign?.id} />
			<input type="hidden" name="target_status" value={targetStatus(campaign?.status)} />

			<Button>
				{publishLabel(campaign?.status)}
			</Button>
		</form>
	</div>
</header>

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
