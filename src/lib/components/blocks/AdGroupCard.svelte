<script lang="ts">
	import type { CampaignAdGroupWithDetails } from '$lib/server/campaigns/ads';
	import { slide } from 'svelte/transition';

	interface Props extends CampaignAdGroupWithDetails {
		open?: boolean;
	}

	let { open = $bindable(false), name, intent_summary, keywords = [], ads = [] }: Props = $props();
</script>

<div class="group border-l-4 py-2 pl-8" class:border-primary={open} class:border-stone-300={!open}>
	<button
		class="mb-6 flex w-full cursor-pointer items-start justify-between text-left"
		onclick={() => (open = !open)}
	>
		<div>
			<h3
				class="mb-1 text-3xl font-bold text-on-surface transition-colors group-hover:text-primary"
			>
				{name}
			</h3>
			<p class="text-sm text-slate-500">
				{intent_summary ?? 'Intent summary pending for this ad group.'}
			</p>
			<div class="flex gap-4">
				<span
					class="font-['Space_Grotesk'] text-[11px] font-bold tracking-widest text-slate-400 uppercase"
				>
					{keywords.length} Keywords
				</span>
				<span
					class="font-['Space_Grotesk'] text-[11px] font-bold tracking-widest text-slate-400 uppercase"
				>
					{ads.length} Ads Active
				</span>
			</div>
		</div>
		{#if open}
			<span
				class="material-symbols--open-in-full-rounded cursor-pointer text-slate-300 transition-colors group-hover:text-primary"
			></span>
		{:else}
			<span class="material-symbols--expand-all"></span>
		{/if}
	</button>
	{#if open}
		<div in:slide>
			<!-- Keywords Section -->
			<div class="mb-8">
				<span
					class="mb-4 block font-['Space_Grotesk'] text-[10px] font-bold tracking-widest text-slate-400 uppercase"
					>Targeting Framework</span
				>
				<div class="mt-3 space-y-3">
					{#if keywords.length === 0}
						<div class="rounded-lg bg-stone-100 p-4">
							<p class="text-xs text-slate-500 italic">
								Keywords will appear once this ad group is generated.
							</p>
						</div>
					{:else}
						{#each keywords as keyword (keyword.id)}
							<div class="flex items-center justify-between rounded-lg bg-stone-100 p-4">
								<div class="flex items-center gap-6">
									<code class="font-['Space_Grotesk'] font-bold">
										{keyword.keyword_text}
									</code>
									<span
										class="bg-secondary-container text-on-secondary-container rounded px-2 py-0.5 font-['Space_Grotesk'] text-[9px] font-bold uppercase"
									>
										{keyword.match_type?.toUpperCase() ?? 'MATCH'}
									</span>
								</div>
								<p class="max-w-xs text-xs text-slate-500 italic">
									{keyword.rationale ?? 'Rationale not available yet.'}
								</p>
							</div>
						{/each}
					{/if}
				</div>
			</div>
			<!-- Ad Preview Section -->
			<div
				class="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
			>
				<div
					class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-3"
				>
					<span
						class="font-['Space_Grotesk'] text-[10px] font-bold tracking-widest text-slate-400 uppercase"
						>Responsive Search Ad Preview</span
					>
					<span class="font-['Space_Grotesk'] text-[10px] font-bold text-primary"
						>Previewing on Desktop</span
					>
				</div>
				<div class="p-8">
					<div class="mb-2 flex items-center gap-2">
						<span class="text-xs font-bold text-slate-800">cloud.example.com</span>
						<span class="text-xs text-slate-400">› enterprise › migration</span>
					</div>
					{#if ads.length > 0}
						{@const previewAd = ads[0]}
						<h4 class="mb-2 cursor-pointer text-xl font-bold text-blue-700 hover:underline">
							{previewAd.headlines_json?.[0] ?? 'Awaiting headline copy...'}
							{#if previewAd.headlines_json?.[1]}
								<span class="block text-base font-semibold text-blue-600">
									{previewAd.headlines_json[1]}
								</span>
							{/if}
						</h4>
						<p class="max-w-2xl text-sm leading-relaxed text-slate-600">
							{previewAd.descriptions_json?.[0] ??
								'Description copy will show up here once an ad has been added.'}
						</p>
					{:else}
						<p class="max-w-2xl text-sm leading-relaxed text-slate-600 italic">
							Responsive search ads will appear here once this ad group has ads.
						</p>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.material-symbols--open-in-full-rounded {
		display: inline-block;
		width: 24px;
		height: 24px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M4 21q-.425 0-.712-.288T3 20v-6q0-.425.288-.712T4 13t.713.288T5 14v3.6L17.6 5H14q-.425 0-.712-.288T13 4t.288-.712T14 3h6q.425 0 .713.288T21 4v6q0 .425-.288.713T20 11t-.712-.288T19 10V6.4L6.4 19H10q.425 0 .713.288T11 20t-.288.713T10 21z'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}

	.material-symbols--expand-all {
		display: inline-block;
		width: 24px;
		height: 24px;
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='m12 22l-6-6l1.425-1.425L12 19.15l4.575-4.575L18 16zM7.45 9.4L6 8l6-6l6 6l-1.45 1.4L12 4.85z'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}
</style>
