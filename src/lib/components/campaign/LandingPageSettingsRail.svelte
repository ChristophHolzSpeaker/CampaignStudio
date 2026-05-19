<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { getLandingPagePreview } from '../../../routes/(app)/campaigns/[id]/landing-page/landing-page.remote';

	let { children } = $props();

	const campaignId = $derived(Number(page.params.id));
	const selectedVersion = $derived.by(() => {
		const parsed = Number(page.url.searchParams.get('version'));
		return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
	});

	const previewQuery = $derived(
		getLandingPagePreview({
			campaignId,
			version: selectedVersion
		})
	);

	const getViewData = () => previewQuery.current;
	const canRenderSelectedPage = () => Boolean(getViewData()?.canRenderPage);

	const isViewingLatestVersion = () => {
		const viewData = getViewData();
		if (!viewData) return false;
		return viewData.campaignPageId === viewData.latestCampaignPageId;
	};

	const canEditPage = () => {
		const viewData = getViewData();
		if (!viewData) return false;
		return Boolean(viewData.campaignPageId) && viewData.campaignStatus !== 'published';
	};

	const canUseAiEditor = () => canEditPage() && canRenderSelectedPage() && isViewingLatestVersion();

	const getComposerHint = () => {
		const viewData = getViewData();
		if (!viewData) return 'Loading landing page preview...';
		if (!viewData.campaignPageId) return 'Open a campaign page version to use AI edits.';
		if (!isViewingLatestVersion()) {
			return 'You are previewing an older version. Switch to the latest version to use AI edits.';
		}
		if (viewData.campaignStatus === 'published') {
			return 'This campaign is published. Archive it before editing the landing page.';
		}
		return 'Describe text, section order, section removal, or approved media changes.';
	};

	const formatVersionDate = (date: Date) =>
		new Intl.DateTimeFormat('en-GB', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(date));

	const getCurrentLogoIds = () => {
		const viewData = getViewData();
		if (!viewData || !viewData.canRenderPage) return [] as string[];

		const section = viewData.page.sections.find((item) => item.type === 'logos_of_trust_ribbon');
		if (!section || !('logos' in section.props) || !Array.isArray(section.props.logos)) return [];

		const byName = new Map(
			viewData.availableLogos.map((logo) => [logo.name.trim().toLowerCase(), logo.id])
		);

		return section.props.logos
			.map((logo) => byName.get(logo.name.trim().toLowerCase()))
			.filter((id): id is string => Boolean(id));
	};

	const getCurrentKeynoteIds = () => {
		const viewData = getViewData();
		if (!viewData || !viewData.canRenderPage) return [] as string[];

		const section = viewData.page.sections.find((item) => item.type === 'keynote_speeches');
		if (!section || !('keynoteIds' in section.props) || !Array.isArray(section.props.keynoteIds))
			return [];

		return section.props.keynoteIds.filter((id): id is string => typeof id === 'string');
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

	const handleRestoreSubmit: SubmitFunction = () => {
		busy = true;
		return async ({ result, update }) => {
			try {
				await update({ reset: true, invalidateAll: true });
				if (result.type === 'success') {
					await goto(page.url.pathname, {
						invalidateAll: true,
						keepFocus: true,
						replaceState: true
					});
				}
			} finally {
				busy = false;
			}
		};
	};
</script>

<div class="sticky top-0 h-dvh min-h-0 overflow-hidden border-l border-stone-200 bg-white">
	{#if getViewData()}
		{@const viewData = getViewData()!}
		<div class="grid h-full overflow-y-auto pb-[430px]">
			{@render children?.()}
			<section class="border border-[#d9dbcf] bg-white" aria-label="Landing page version history">
				<div class="border-b border-[#e5e7eb] p-3.5">
					<p class="m-0 text-[0.72rem] font-bold tracking-[0.08em] text-[#1f2937] uppercase">
						Version history
					</p>
					<p class="mt-1 mr-0 mb-0 ml-0 text-[0.78rem] text-[#4b5563]">
						Preview and restore any previous generated version.
					</p>
				</div>
				<div class="grid max-h-[240px] overflow-auto">
					{#each viewData.versionHistory as version (version.id)}
						<a
							href={`?version=${version.id}`}
							class={[
								'flex items-center justify-between gap-2 border-b border-[#f1f5f9] px-3.5 py-[0.6rem] font-sans text-inherit no-underline',
								version.id === viewData.campaignPageId &&
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
							{#if version.id === viewData.latestCampaignPageId}
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
					use:enhance={handleRestoreSubmit}
					action="?/restoreVersion"
					class="pt-3 pr-3.5 pb-3.5 pl-3.5"
				>
					<input type="hidden" name="campaignPageId" value={viewData.campaignPageId ?? ''} />
					<button
						type="submit"
						disabled={!canEditPage() || isViewingLatestVersion() || busy}
						class="w-full cursor-pointer border border-[#0f172a] bg-[#0f172a] px-[0.9rem] py-[0.6rem] text-[0.72rem] font-bold tracking-[0.05em] text-white uppercase disabled:cursor-not-allowed disabled:opacity-[0.55]"
					>
						{busy ? 'Restoring...' : 'Restore viewed version as latest'}
					</button>
				</form>
			</section>

			{#if canRenderSelectedPage()}
				<aside class="border border-stone-200 bg-white" aria-label="Landing page logo picker">
					<form
						method="POST"
						use:enhance={handleEditSubmit}
						action="?/setLogos"
						class="flex flex-col gap-3 p-3.5"
					>
						<input type="hidden" name="campaignPageId" value={viewData.campaignPageId ?? ''} />
						<p class="m-0 text-[0.72rem] font-bold tracking-[0.08em] text-[#1f2937] uppercase">
							Logos for trust ribbon
						</p>
						<div class="grid max-h-[200px] gap-2 overflow-auto">
							{#each viewData.availableLogos as logo (logo.id)}
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
							>Save logos</button
						>
					</form>
				</aside>

				<aside class="border border-stone-200 bg-white" aria-label="Landing page keynote picker">
					<form
						method="POST"
						use:enhance={handleEditSubmit}
						action="?/setKeynotes"
						class="flex flex-col gap-3 p-3.5"
					>
						<input type="hidden" name="campaignPageId" value={viewData.campaignPageId ?? ''} />
						<p class="m-0 text-[0.72rem] font-bold tracking-[0.08em] text-[#1f2937] uppercase">
							Keynotes
						</p>
						<div class="grid max-h-[260px] gap-2 overflow-auto">
							{#each viewData.availableKeynotes as keynote (keynote.id)}
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
							>Save keynotes</button
						>
					</form>
				</aside>
			{/if}

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
						>{busy ? 'Retrying...' : 'Retry landing page generation'}</button
					>
				</form>

				{#if canRenderSelectedPage() && isViewingLatestVersion()}
					<!--Edit with AI panel fixed-->
					<form
						method="POST"
						use:enhance={handleEditSubmit}
						action="?/editPage"
						class="absolute inset-x-0 bottom-0 z-20 border-t border-stone-300 bg-white p-3.5"
					>
						<input type="hidden" name="campaignPageId" value={viewData.campaignPageId ?? ''} />
						<div class="flex flex-col items-baseline justify-between gap-3 max-[900px]:items-start">
							<p
								class="m-0 font-['Space_Grotesk',sans-serif] text-[0.72rem] font-bold tracking-[0.08em] text-[#1f2937] uppercase"
							>
								Edit landing page with AI
							</p>
							<p class="m-0 text-[0.78rem] text-[#4b5563]">{getComposerHint()}</p>
						</div>
						<textarea
							value={page.form?.pageEdit?.values?.changePrompt ?? ''}
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
							>{busy ? 'Applying...' : 'Apply changes'}</button
						>
						{#if page.form?.pageEdit}
							<p
								class={[
									'm-0 text-[0.8rem] text-[#b91c1c]',
									(page.form?.pageEdit?.success ?? false) && 'text-[#166534]'
								]}
							>
								{page.form?.pageEdit?.message ?? ''}
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
						<p class="m-0 text-[0.78rem] leading-[1.45] text-[#4b5563]">
							{canRenderSelectedPage()
								? getComposerHint()
								: 'This version cannot be edited because its content is incomplete.'}
						</p>
					</div>
				{/if}
				<!--/Edit with AI panel fixed-->
			</aside>
		</div>
	{:else}
		<div class="p-6 text-sm text-slate-600">Loading landing page settings...</div>
	{/if}
</div>
