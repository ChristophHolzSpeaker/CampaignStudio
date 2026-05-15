<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import ShallowRouteModal from '$lib/components/blocks/ShallowRouteModal.svelte';
	import YouTubeEmbed from '$lib/components/blocks/YouTubeEmbed.svelte';
	import PageRenderer from '$lib/components/page-renderer/PageRenderer.svelte';
	import type { LandingPageDocument } from '$lib/page-builder/page';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageProps } from './$types';

	type LandingPageEditState = {
		values: {
			changePrompt: string;
		};
		message?: string;
		success?: boolean;
		campaignPageId?: number;
	};

	let { data, form }: PageProps = $props();

	const getViewData = () =>
		data as {
			page: LandingPageDocument;
			availableLogos: Array<{ id: string; name: string; logoUrl: string; logoAlt: string }>;
			availableKeynotes: Array<{
				id: string;
				title: string;
				summary: string;
				imageUrl: string;
				imageAlt: string;
			}>;
			campaignId: number;
			campaignPageId: number | null;
			latestCampaignPageId: number | null;
			versionHistory: Array<{
				id: number;
				versionNumber: number;
				changeNote: string | null;
				slug: string;
				createdAt: Date;
			}>;
			campaignStatus: string | null;
		};

	const isViewingLatestVersion = () =>
		getViewData().campaignPageId === getViewData().latestCampaignPageId;

	const formatVersionDate = (date: Date) =>
		new Intl.DateTimeFormat('en-GB', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(date));

	const getCurrentLogoIds = () => {
		const section = getViewData().page.sections.find(
			(item) => item.type === 'logos_of_trust_ribbon'
		);
		if (!section || !('logos' in section.props) || !Array.isArray(section.props.logos)) {
			return [] as string[];
		}

		const byName = new Map(
			getViewData().availableLogos.map((logo) => [logo.name.trim().toLowerCase(), logo.id])
		);

		return section.props.logos
			.map((logo) => byName.get(logo.name.trim().toLowerCase()))
			.filter((id): id is string => Boolean(id));
	};

	const canEditPage = () => {
		const viewData = getViewData();
		return Boolean(viewData.campaignPageId) && viewData.campaignStatus !== 'published';
	};
	const canUseAiEditor = () => canEditPage() && isViewingLatestVersion();
	const getComposerHint = () => {
		const viewData = getViewData();
		if (!viewData.campaignPageId) {
			return 'Open a campaign page version to use AI edits.';
		}

		if (!isViewingLatestVersion()) {
			return 'You are previewing an older version. Switch to the latest version to use AI edits.';
		}

		if (viewData.campaignStatus === 'published') {
			return 'This campaign is published. Archive it before editing the landing page.';
		}

		return 'Describe text, section order, section removal, or approved media changes.';
	};

	const getCurrentKeynoteIds = () => {
		const section = getViewData().page.sections.find((item) => item.type === 'keynote_speeches');
		if (!section || !('keynoteIds' in section.props) || !Array.isArray(section.props.keynoteIds)) {
			return [] as string[];
		}

		return section.props.keynoteIds.filter((id): id is string => typeof id === 'string');
	};

	const isKeynoteSelectionDisabled = (keynoteId: string) => {
		const selected = getCurrentKeynoteIds();
		return selected.length >= 3 && !selected.includes(keynoteId);
	};

	let busy = $state(false);

	const handleEditSubmit: SubmitFunction = () => {
		busy = true;

		return async ({ update }) => {
			try {
				await update({ reset: true, invalidateAll: true });
			} finally {
				busy = false;
			}
		};
	};
</script>

<div class="">
	<!--Independently scrolling cols-->
	<div class="grid grid-cols-12 lg:sticky lg:top-0 lg:h-dvh lg:overflow-hidden">
		<!--Page settings-->

		<div class="col-span-2 lg:h-full lg:overflow-y-auto">
			<section class=" border border-[#d9dbcf] bg-white" aria-label="Landing page version history">
				<div class="border-b border-[#e5e7eb] p-3.5">
					<p class="m-0 text-[0.72rem] font-bold tracking-[0.08em] text-[#1f2937] uppercase">
						Version history
					</p>
					<p class="mt-1 mr-0 mb-0 ml-0 text-[0.78rem] text-[#4b5563]">
						Preview and restore any previous generated version.
					</p>
				</div>
				<div class="grid max-h-[240px] overflow-auto">
					{#each getViewData().versionHistory as version (version.id)}
						<a
							href={`?version=${version.id}`}
							class={[
								'flex items-center justify-between gap-2 border-b border-[#f1f5f9] px-3.5 py-[0.6rem] font-sans text-inherit no-underline',
								version.id === getViewData().campaignPageId &&
									'border-l-[3px] border-l-[#0f172a] bg-[#f8fafc] pl-[calc(0.875rem-3px)]'
							]}
						>
							<div>
								<p class="m-0 text-[0.82rem] font-semibold text-[#0f172a]">
									v{version.versionNumber}
								</p>
								<p class="mt-[0.1rem] mr-0 mb-0 ml-0 text-[0.74rem] text-[#64748b]">
									{formatVersionDate(version.createdAt)}
								</p>
								{#if version.changeNote}
									<p
										class="mt-[0.2rem] mr-0 mb-0 ml-0 text-[0.74rem] leading-[1.35] text-[#334155]"
									>
										{version.changeNote}
									</p>
								{/if}
							</div>
							{#if version.id === getViewData().latestCampaignPageId}
								<span
									class="bg-[#e2e8f0] px-[0.4rem] py-[0.15rem] text-[0.62rem] font-bold tracking-[0.06em] text-[#1e293b] uppercase"
									>latest</span
								>
							{/if}
						</a>
					{/each}
				</div>
				<form
					method="POST"
					use:enhance={handleEditSubmit}
					action="?/restoreVersion"
					class="pt-3 pr-3.5 pb-3.5 pl-3.5"
				>
					<input type="hidden" name="campaignPageId" value={getViewData().campaignPageId ?? ''} />
					<button
						type="submit"
						disabled={!canEditPage() || isViewingLatestVersion() || busy}
						class="w-full cursor-pointer border border-[#0f172a] bg-[#0f172a] px-[0.9rem] py-[0.6rem] text-[0.72rem] font-bold tracking-[0.05em] text-white uppercase disabled:cursor-not-allowed disabled:opacity-[0.55]"
					>
						{busy ? 'Restoring...' : 'Restore viewed version as latest'}
					</button>
				</form>
			</section>
			<div class="grid">
				<aside class=" border border-stone-200 bg-white" aria-label="Landing page logo picker">
					<form
						method="POST"
						use:enhance={handleEditSubmit}
						action="?/setLogos"
						class="flex flex-col gap-3 p-3.5"
					>
						<input type="hidden" name="campaignPageId" value={getViewData().campaignPageId ?? ''} />
						<p class="m-0 text-[0.72rem] font-bold tracking-[0.08em] text-[#1f2937] uppercase">
							Logos for trust ribbon
						</p>
						<div class="grid max-h-[200px] gap-2 overflow-auto">
							{#each getViewData().availableLogos as logo (logo.id)}
								<label class="flex items-center gap-2 text-[0.8rem]">
									<input
										type="checkbox"
										name="logoIds"
										value={logo.id}
										checked={getCurrentLogoIds().includes(logo.id)}
										disabled={!canEditPage()}
									/>
									<img
										src={logo.logoUrl}
										alt={logo.logoAlt}
										class="h-[20px] max-w-[70px] object-contain"
									/>
									<span>{logo.name}</span>
								</label>
							{/each}
						</div>
						<button
							type="submit"
							disabled={!canEditPage()}
							class="cursor-pointer self-end border border-[#0f172a] bg-[#0f172a] px-[0.9rem] py-[0.6rem] text-[0.78rem] font-bold tracking-[0.04em] text-white uppercase disabled:cursor-not-allowed disabled:opacity-[0.55]"
						>
							Save logos
						</button>
					</form>
				</aside>

				<aside class="border border-stone-200 bg-white" aria-label="Landing page keynote picker">
					<form
						method="POST"
						use:enhance={handleEditSubmit}
						action="?/setKeynotes"
						class="flex flex-col gap-3 p-3.5"
					>
						<input type="hidden" name="campaignPageId" value={getViewData().campaignPageId ?? ''} />
						<p class="m-0 text-[0.72rem] font-bold tracking-[0.08em] text-[#1f2937] uppercase">
							Keynotes
						</p>
						<div class="grid max-h-[260px] gap-2 overflow-auto">
							{#each getViewData().availableKeynotes as keynote (keynote.id)}
								<label class="flex items-start gap-2 text-[0.8rem]">
									<input
										type="checkbox"
										name="keynoteIds"
										value={keynote.id}
										checked={getCurrentKeynoteIds().includes(keynote.id)}
										disabled={!canEditPage()}
									/>
									<img
										src={keynote.imageUrl}
										alt={keynote.imageAlt}
										class="h-[42px] w-[56px] border border-[#d1d5db] object-cover"
									/>
									<span>{keynote.title}</span>
								</label>
							{/each}
						</div>
						<button
							type="submit"
							disabled={!canEditPage()}
							class="cursor-pointer self-end border border-[#0f172a] bg-[#0f172a] px-[0.9rem] py-[0.6rem] text-[0.78rem] font-bold tracking-[0.04em] text-white uppercase disabled:cursor-not-allowed disabled:opacity-[0.55]"
						>
							Save keynotes
						</button>
					</form>
				</aside>
			</div>
			<aside class="border border-stone-200 bg-white" aria-label="Landing page editor">
				<form
					method="POST"
					use:enhance={handleEditSubmit}
					action="?/retryGeneration"
					class="flex flex-col gap-3 p-3.5"
				>
					<div class="flex flex-col items-baseline justify-between gap-3 max-[900px]:items-start">
						<p
							class="m-0 font-['Space_Grotesk',sans-serif] text-[0.72rem] font-bold tracking-[0.08em] text-[#1f2937] uppercase"
						>
							Manual generation retry
						</p>
						<p class="m-0 text-[0.78rem] text-[#4b5563]">
							Use this when automatic retries were exhausted.
						</p>
					</div>

					<button
						type="submit"
						disabled={!canEditPage() || busy}
						class="cursor-pointer self-end border border-[#0f172a] bg-[#0f172a] px-[0.9rem] py-[0.6rem] text-[0.78rem] font-bold tracking-[0.04em] text-white uppercase disabled:cursor-not-allowed disabled:opacity-[0.55] max-[900px]:justify-self-stretch"
					>
						{busy ? 'Retrying...' : 'Retry landing page generation'}
					</button>
				</form>

				{#if isViewingLatestVersion()}
					<form
						method="POST"
						use:enhance={handleEditSubmit}
						action="?/editPage"
						class="flex flex-col gap-3 p-3.5"
					>
						<input type="hidden" name="campaignPageId" value={getViewData().campaignPageId ?? ''} />
						<div class="flex flex-col items-baseline justify-between gap-3 max-[900px]:items-start">
							<p
								class="m-0 font-['Space_Grotesk',sans-serif] text-[0.72rem] font-bold tracking-[0.08em] text-[#1f2937] uppercase"
							>
								Edit landing page with AI
							</p>
							<p class="m-0 text-[0.78rem] text-[#4b5563]">{getComposerHint()}</p>
						</div>

						<textarea
							value={form?.pageEdit?.values?.changePrompt ?? ''}
							name="change_prompt"
							rows="6"
							placeholder="e.g. Move testimonials above the booking section and tighten the hero headline"
							disabled={!canUseAiEditor()}
							class="w-full resize-y border border-[#cbd5e1] bg-white px-3 py-2.5 text-[0.85rem] leading-[1.45] text-[#0f172a] disabled:bg-[#f1f5f9] disabled:text-[#64748b]"
						></textarea>
						<button
							type="submit"
							disabled={!canUseAiEditor() || busy}
							class="cursor-pointer self-end border border-[#0f172a] bg-[#0f172a] px-[0.9rem] py-[0.6rem] text-[0.78rem] font-bold tracking-[0.04em] text-white uppercase disabled:cursor-not-allowed disabled:opacity-[0.55] max-[900px]:justify-self-stretch"
						>
							{busy ? 'Applying...' : 'Apply changes'}
						</button>

						{#if form?.pageEdit}
							<p
								class={[
									'm-0 text-[0.8rem] text-[#b91c1c]',
									(form?.pageEdit?.success ?? false) && 'text-[#166534]'
								]}
							>
								{form?.pageEdit?.message ?? ''}
							</p>
						{/if}
					</form>
				{:else}
					<div class="flex flex-col gap-3 border-t border-[#e5e7eb] p-3.5">
						<p
							class="m-0 font-['Space_Grotesk',sans-serif] text-[0.72rem] font-bold tracking-[0.08em] text-[#1f2937] uppercase"
						>
							Edit landing page with AI
						</p>
						<p class="m-0 text-[0.78rem] leading-[1.45] text-[#4b5563]">{getComposerHint()}</p>
					</div>
				{/if}
			</aside>
		</div>
		<!--/Page settings-->
		<!--Landing page preview-->
		<div class="col-span-10 lg:h-full lg:overflow-y-auto">
			<PageRenderer page={getViewData().page} disableScrollReveal={true} />
		</div>
		<!--/Landing page preview-->
	</div>
	<!--/Independently scrolling cols-->
</div>

{#if page.state.modal?.kind === 'youtube'}
	<ShallowRouteModal title="Showreel" onclose={() => history.back()}>
		<YouTubeEmbed url={page.state.modal.url} />
	</ShallowRouteModal>
{/if}
