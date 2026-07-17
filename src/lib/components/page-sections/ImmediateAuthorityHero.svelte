<script lang="ts">
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { trackMailtoClick } from '$lib/analytics/track-mailto-click';
	import { trackAbEvent } from '$lib/analytics/track-ab-event';
	import ContentEditableText from '$lib/components/inline-edit/ContentEditableText.svelte';
	import type { ImmediateAuthorityHeroProps } from '$lib/page-builder/sections/types';
	import type { SpeakerPrimaryCtaAbTest } from '$lib/server/ab-testing';
	import {
		saveImmediateAuthorityHeroField,
		toggleImmediateAuthorityHeroLayout
	} from './ImmediateAuthorityHeroInlineEdit.remote';
	import LeadInlineHeroBookingSequence from '../booking/LeadInlineHeroBookingSequence.svelte';
	import SectionIdentifier from '../elements/SectionIdentifier.svelte';

	let {
		props,
		campaignId = null,
		campaignPageId = null,
		editable = false,
		sectionIndex = -1,
		onInlineEditSaved,
		bookingSlotGroups = [],
		mailtoHref = 'mailto:speaker@christophholz.com',
		abTest = null
	}: {
		props?: ImmediateAuthorityHeroProps;
		campaignId?: number | null;
		campaignPageId?: number | null;
		editable?: boolean;
		sectionIndex?: number;
		onInlineEditSaved?: (() => Promise<void>) | undefined;
		bookingSlotGroups?: { dateKey: string; slots: { startsAtIso: string; endsAtIso: string }[] }[];
		mailtoHref?: string;
		abTest?: SpeakerPrimaryCtaAbTest | null;
	} = $props();

	const ctaLabel = $derived(props?.primaryCtaLabel ?? 'Request Speaking Availability');
	const eyebrow = $derived(props?.eyebrow ?? 'The Digital Future Authority');
	const headline = $derived(
		props?.headline ?? 'AI Keynote Speaker for Your Next Industry Association Conference.'
	);
	const layout = $derived(props?.layout ?? 'left');
	const subheadline = $derived(
		props?.subheadline ??
			'Deeply researched, actionable insights bridging the gap between technological possibility and operational reality.'
	);

	const heroImageUrl = $derived(
		props?.heroImageUrl ??
			props?.videoThumbnailUrl ??
			'https://cdn.prod.website-files.com/61263e0de406f497361dca55/6130408552ea140d707aab8e_christoph-contact-bg.jpg?auto=format&fit=crop&w=1400&q=80'
	);
	const heroImageAlt = $derived(
		props?.heroImageAlt ?? props?.videoThumbnailAlt ?? 'Christoph Holz on stage'
	);
	const supportingBullets = $derived(props?.supportingBullets ?? []);
	const isDualButtons = $derived(abTest?.ctaMode === 'dual_buttons');

	function trackHeroCtaClick(button: 'primary' | 'secondary'): void {
		if (!abTest?.experimentId || !abTest.variantId) {
			return;
		}

		trackAbEvent({
			eventType: 'cta_click',
			experimentId: abTest.experimentId,
			variantId: abTest.variantId,
			visitorId: abTest.visitorId,
			route: page.url.pathname,
			slug: page.params.slug ?? '',
			metadata: {
				button,
				label:
					button === 'primary'
						? (abTest.primaryLabel ?? ctaLabel)
						: (abTest.secondaryLabel ?? 'Verfügbarkeit prüfen'),
				cta_mode: abTest.ctaMode,
				variant_key: abTest.variantKey,
				experiment_key: abTest.experimentKey
			}
		});
	}

	function handleHeroBookingWidgetKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter' && event.key !== ' ') {
			return;
		}

		event.preventDefault();
		trackHeroCtaClick('primary');
	}

	function trackCta(variant: 'primary' | 'showreel_modal' | 'showreel_external'): void {
		if (campaignId == null || campaignPageId == null) {
			return;
		}

		void fetch('/api/attribution/cta', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				type: 'booking',
				campaign_id: campaignId,
				campaign_page_id: campaignPageId,
				cta_key: variant === 'primary' ? 'hero_primary_cta' : 'hero_showreel_cta',
				cta_label: variant === 'primary' ? ctaLabel : 'View Showreel',
				cta_section: 'immediate_authority_hero',
				cta_variant: variant
			})
		}).catch(() => {
			// fire-and-forget tracking
		});
	}

	function openHeroImagePicker(): void {
		if (!canInlineEdit || campaignId == null || campaignPageId == null || sectionIndex < 0) {
			return;
		}

		pushState('', {
			...page.state,
			modal: {
				kind: 'hero-image-picker',
				campaignId,
				campaignPageId,
				sectionIndex
			}
		});
	}

	const pageSlug = $derived(page.url.pathname);

	const canInlineEdit = $derived(
		editable && campaignId != null && campaignPageId != null && sectionIndex >= 0
	);

	async function saveHeroField(
		field: 'headline' | 'subheadline' | 'eyebrow',
		nextValue: string
	): Promise<{ saved: boolean; nextValue?: string; nextCampaignPageId?: number }> {
		if (!canInlineEdit || campaignId == null || campaignPageId == null || sectionIndex < 0) {
			return { saved: false };
		}

		const result = await saveImmediateAuthorityHeroField({
			campaignId,
			campaignPageId,
			sectionIndex,
			sectionType: 'immediate_authority_hero',
			field,
			value: nextValue
		});

		if (result.saved && result.campaignPageId !== campaignPageId) {
			const nextUrl = new URL(page.url);
			nextUrl.searchParams.set('version', String(result.campaignPageId));
			await goto(nextUrl.pathname + nextUrl.search, { invalidateAll: true, keepFocus: true });
		} else if (result.saved) {
			await onInlineEditSaved?.();
		}

		return {
			saved: result.saved,
			nextValue: result.value,
			nextCampaignPageId: result.campaignPageId
		};
	}

	async function flipLayout(): Promise<void> {
		if (!canInlineEdit || campaignId == null || campaignPageId == null || sectionIndex < 0) {
			return;
		}

		const result = await toggleImmediateAuthorityHeroLayout({
			campaignId,
			campaignPageId,
			sectionIndex,
			sectionType: 'immediate_authority_hero'
		});

		if (!result.saved) {
			return;
		}

		if (result.campaignPageId !== campaignPageId) {
			const nextUrl = new URL(page.url);
			nextUrl.searchParams.set('version', String(result.campaignPageId));
			await goto(nextUrl.pathname + nextUrl.search, { invalidateAll: true, keepFocus: true });
		} else {
			await onInlineEditSaved?.();
		}
	}
</script>

<section
	class="relative isolate overflow-hidden bg-surface px-6 py-16 sm:px-8 lg:px-12 lg:py-24"
	aria-label="Immediate Authority Hero section"
>
	<SectionIdentifier props={{ id: 'immediate_authority_hero' }}></SectionIdentifier>
	{#if canInlineEdit}
		<button
			type="button"
			onclick={flipLayout}
			class="absolute top-4 right-4 z-50 inline-flex items-center gap-2 border border-emerald-400 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 transition hover:bg-emerald-100"
			aria-label="Flip hero layout orientation"
		>
			<span>Flip layout</span>
			<span class="font-semibold">{layout === 'left' ? 'left' : 'right'}</span>
		</button>
	{/if}
	<div class="absolute inset-0 -z-20">
		<div
			class="hero-background h-full w-full bg-cover bg-center grayscale"
			style:--hero-image-url={heroImageUrl ? `url(${JSON.stringify(heroImageUrl)})` : undefined}
			aria-hidden="true"
		></div>
	</div>
	<div
		class="absolute inset-0 -z-10 bg-linear-to-r from-surface via-surface/94 to-surface/82"
	></div>
	<div class="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-surface to-transparent"></div>

	<div class="mx-auto grid max-w-7xl items-start gap-10 lg:grid-cols-12 lg:gap-12">
		{#snippet content()}
			<div class="space-y-7 lg:col-span-7">
				<ContentEditableText
					as="span"
					value={eyebrow}
					editable={canInlineEdit}
					className="inline-block bg-primary px-3 py-1 text-[10px] tracking-[0.2em] text-white"
					onSave={(value) => saveHeroField('eyebrow', value)}
				/>

				<ContentEditableText
					as="h1"
					value={headline}
					editable={canInlineEdit}
					className="max-w-4xl text-5xl leading-[0.95] font-bold tracking-tight text-on-surface lg:text-7xl"
					onSave={(value) => saveHeroField('headline', value)}
				/>

				<ContentEditableText
					as="p"
					value={subheadline}
					editable={canInlineEdit}
					multiline={true}
					className="max-w-2xl text-base leading-relaxed text-on-surface/80 sm:text-lg lg:text-xl"
					onSave={(value) => saveHeroField('subheadline', value)}
				/>

				{#if supportingBullets.length > 0}
					<ul class="grid gap-2 text-sm text-on-surface/85 sm:grid-cols-2">
						{#each supportingBullets as bullet (`hero-bullet-${bullet}`)}
							<li class="flex items-start gap-2">
								<span aria-hidden="true" class="mt-[0.35rem] block h-1.5 w-1.5 bg-primary"></span>
								<span>{bullet}</span>
							</li>
						{/each}
					</ul>
				{/if}

				<div
					class="flex flex-col items-start gap-3 sm:gap-6"
					data-cta-action={props?.primaryCtaAction}
				>
					{#if isDualButtons}
						<div class="flex flex-wrap items-center gap-3">
							<a
								href={mailtoHref}
								class="btn-primary inline-flex items-center gap-2"
								onclick={() => trackHeroCtaClick('primary')}
							>
								{abTest?.primaryLabel ?? 'Vortrag anfragen'}
							</a>
							<a
								href="#booking"
								class="btn inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-xl font-bold text-slate-700 uppercase transition hover:border-slate-50"
								onclick={() => trackHeroCtaClick('secondary')}
							>
								{abTest?.secondaryLabel ?? 'Verfügbarkeit prüfen'}
							</a>
						</div>
					{:else}
						<div
							class="w-full"
							role="button"
							tabindex="0"
							onclick={() => trackHeroCtaClick('primary')}
							onkeydown={handleHeroBookingWidgetKeydown}
						>
							<LeadInlineHeroBookingSequence
								{campaignId}
								{campaignPageId}
								pageSlug={pageSlug ?? null}
								slotGroups={bookingSlotGroups}
								formActionKey={`hero-inline-booking:${campaignPageId ?? 'none'}`}
								bookingSurface="hero"
								ctaKey="hero_inline_booking"
								ctaSection="hero"
								ctaVariant={abTest?.variantKey ?? null}
							></LeadInlineHeroBookingSequence>
						</div>
						<a
							href={mailtoHref}
							type="button"
							onclick={trackMailtoClick}
							class={[
								'inline-block border border-slate-300  bg-white px-3 py-2 text-xl font-bold text-slate-700 uppercase transition hover:border-slate-50'
							]}
						>
							Schreib eine email: speaker@christophholz.com
						</a>
					{/if}
				</div>
			</div>
		{/snippet}

		{#snippet image()}
			<div class="group relative lg:col-span-5">
				<div class="aspect-4/5 overflow-hidden bg-surface-container-lowest">
					<img
						src={heroImageUrl}
						alt={heroImageAlt}
						class="h-full w-full object-cover transition-all duration-500"
					/>
				</div>
				{#if canInlineEdit}
					<button
						type="button"
						onclick={openHeroImagePicker}
						class="absolute top-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface/92 text-on-surface opacity-0 shadow-lg transition group-hover:opacity-100 focus:opacity-100"
						aria-label="Change hero image"
					>
						<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" aria-hidden="true">
							<path
								d="M4 20h4l10-10a2 2 0 0 0-4-4L4 16v4z"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
								stroke-linejoin="round"
							></path>
							<path d="M13 7l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
							></path>
						</svg>
					</button>
				{/if}
				<div class="absolute -right-6 -bottom-6 -z-10 h-28 w-28 bg-primary/20 blur-3xl"></div>
			</div>
		{/snippet}

		{#if layout === 'right'}
			{@render content()}
			{@render image()}
		{:else if layout === 'left'}
			{@render image()}
			{@render content()}
		{/if}
	</div>
</section>

<style>
	.hero-background {
		background-image: none;
	}

	@media (min-width: 1024px) {
		.hero-background {
			background-image: var(--hero-image-url, none);
		}
	}
</style>
