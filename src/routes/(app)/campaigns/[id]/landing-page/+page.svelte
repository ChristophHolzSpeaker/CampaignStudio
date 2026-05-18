<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ShallowRouteModal from '$lib/components/blocks/ShallowRouteModal.svelte';
	import YouTubeEmbed from '$lib/components/blocks/YouTubeEmbed.svelte';
	import PageRenderer from '$lib/components/page-renderer/PageRenderer.svelte';
	import { saveHybridPrimaryVisualImage } from '$lib/components/page-sections/HybridContentSectionInlineEdit.remote';
	import { saveImmediateAuthorityHeroImage } from '$lib/components/page-sections/ImmediateAuthorityHeroInlineEdit.remote';
	import { getLandingPagePreview } from './landing-page.remote';

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

	const canEditPage = () => {
		const viewData = getViewData();
		if (!viewData) {
			return false;
		}

		return Boolean(viewData.campaignPageId) && viewData.campaignStatus !== 'published';
	};

	async function refreshInlinePreview(): Promise<void> {
		await previewQuery.refresh();
	}

	let heroImageSaving = $state(false);
	let heroImageError = $state<string | null>(null);

	async function saveHeroImageAsset(assetId: string): Promise<void> {
		if (heroImageSaving) {
			return;
		}

		const modal = page.state.modal;
		if (modal?.kind !== 'hero-image-picker') {
			return;
		}

		heroImageSaving = true;
		heroImageError = null;

		try {
			const result = await saveImmediateAuthorityHeroImage({
				campaignId: modal.campaignId,
				campaignPageId: modal.campaignPageId,
				sectionIndex: modal.sectionIndex,
				sectionType: 'immediate_authority_hero',
				assetId
			});

			if (result.saved && result.campaignPageId !== modal.campaignPageId) {
				const nextUrl = new URL(page.url);
				nextUrl.searchParams.set('version', String(result.campaignPageId));
				await goto(nextUrl.pathname + nextUrl.search, { invalidateAll: true, keepFocus: true });
			} else if (result.saved) {
				await previewQuery.refresh();
			}

			history.back();
		} catch (error) {
			heroImageError = error instanceof Error ? error.message : 'Unable to update hero image.';
		} finally {
			heroImageSaving = false;
		}
	}

	async function saveHybridImageAsset(assetId: string): Promise<void> {
		if (heroImageSaving) {
			return;
		}

		const modal = page.state.modal;
		if (modal?.kind !== 'hybrid-image-picker') {
			return;
		}

		heroImageSaving = true;
		heroImageError = null;

		try {
			const result = await saveHybridPrimaryVisualImage({
				campaignId: modal.campaignId,
				campaignPageId: modal.campaignPageId,
				sectionIndex: modal.sectionIndex,
				sectionType: 'hybrid_content_section',
				assetId
			});

			if (result.saved && result.campaignPageId !== modal.campaignPageId) {
				const nextUrl = new URL(page.url);
				nextUrl.searchParams.set('version', String(result.campaignPageId));
				await goto(nextUrl.pathname + nextUrl.search, { invalidateAll: true, keepFocus: true });
			} else if (result.saved) {
				await previewQuery.refresh();
			}

			history.back();
		} catch (error) {
			heroImageError =
				error instanceof Error ? error.message : 'Unable to update hybrid primary image.';
		} finally {
			heroImageSaving = false;
		}
	}
</script>

{#if getViewData()}
	{@const viewData = getViewData()!}
	<div class="landing-page-preview">
		{#if canRenderSelectedPage()}
			<PageRenderer
				page={viewData.page}
				campaignId={viewData.campaignId}
				campaignPageId={viewData.campaignPageId}
				editable={canEditPage()}
				onInlineEditSaved={refreshInlinePreview}
				disableScrollReveal={true}
			/>
		{:else}
			<div class="p-6">
				<div class="border border-[#fecaca] bg-[#fef2f2] p-4 text-[#7f1d1d]">
					<p class="m-0 text-[0.95rem] font-semibold">
						{viewData.renderErrorMessage ??
							'This page version has incomplete content and is unable to render.'}
					</p>
					<p class="mt-2 mb-0 text-[0.82rem]">
						Select another version from history or retry generation to recover this campaign landing
						page.
					</p>
				</div>
			</div>
		{/if}
	</div>
{:else}
	<div class="p-6 text-sm text-slate-600">Loading landing page preview...</div>
{/if}

{#if page.state.modal?.kind === 'youtube'}
	<ShallowRouteModal title="Showreel" onclose={() => history.back()}>
		<YouTubeEmbed url={page.state.modal.url} />
	</ShallowRouteModal>
{/if}

{#if page.state.modal?.kind === 'hero-image-picker' && getViewData()}
	{@const viewData = getViewData()!}
	<ShallowRouteModal title="Swap hero image" onclose={() => history.back()}>
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each viewData.availableHeroImages as asset (asset.id)}
				<button
					type="button"
					disabled={heroImageSaving}
					onclick={() => saveHeroImageAsset(asset.id)}
					class="cursor-pointer overflow-hidden border border-[#d1d5db] bg-white text-left transition hover:border-[#0f172a] disabled:cursor-not-allowed disabled:opacity-60"
				>
					<img
						src={asset.thumbnailUrl ?? asset.primaryUrl}
						alt={asset.thumbnailAlt ?? asset.title}
						class="aspect-4/3 w-full object-cover"
					/>
					<div class="p-2.5">
						<p class="m-0 text-[0.78rem] font-semibold text-[#111827]">{asset.title}</p>
					</div>
				</button>
			{/each}
		</div>
		{#if heroImageError}
			<p class="mt-3 mb-0 text-[0.8rem] text-[#b91c1c]">{heroImageError}</p>
		{/if}
	</ShallowRouteModal>
{/if}

{#if page.state.modal?.kind === 'hybrid-image-picker' && getViewData()}
	{@const viewData = getViewData()!}
	<ShallowRouteModal title="Swap hybrid primary visual" onclose={() => history.back()}>
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each viewData.availableHeroImages as asset (asset.id)}
				<button
					type="button"
					disabled={heroImageSaving}
					onclick={() => saveHybridImageAsset(asset.id)}
					class="cursor-pointer overflow-hidden border border-[#d1d5db] bg-white text-left transition hover:border-[#0f172a] disabled:cursor-not-allowed disabled:opacity-60"
				>
					<img
						src={asset.thumbnailUrl ?? asset.primaryUrl}
						alt={asset.thumbnailAlt ?? asset.title}
						class="aspect-4/3 w-full object-cover"
					/>
					<div class="p-2.5">
						<p class="m-0 text-[0.78rem] font-semibold text-[#111827]">{asset.title}</p>
					</div>
				</button>
			{/each}
		</div>
		{#if heroImageError}
			<p class="mt-3 mb-0 text-[0.8rem] text-[#b91c1c]">{heroImageError}</p>
		{/if}
	</ShallowRouteModal>
{/if}
