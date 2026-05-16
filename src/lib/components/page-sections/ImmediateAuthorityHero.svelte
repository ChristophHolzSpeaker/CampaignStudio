<script lang="ts">
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import ContentEditableText from '$lib/components/inline-edit/ContentEditableText.svelte';
	import NavButton from '$lib/components/elements/NavButton.svelte';
	import type { ImmediateAuthorityHeroProps } from '$lib/page-builder/sections/types';
	import { saveImmediateAuthorityHeroField } from './ImmediateAuthorityHeroInlineEdit.remote';
	import LeadInlineHeroBookingSequence from '../booking/LeadInlineHeroBookingSequence.svelte';
	import Button from '../elements/Button.svelte';
	import SectionIdentifier from '../elements/SectionIdentifier.svelte';

	let {
		props,
		campaignId = null,
		campaignPageId = null,
		editable = false,
		sectionIndex = -1,
		onInlineEditSaved,
		bookingSlotGroups = [],
		mailtoHref = 'mailto:speaker@christophholz.com'
	}: {
		props?: ImmediateAuthorityHeroProps;
		campaignId?: number | null;
		campaignPageId?: number | null;
		editable?: boolean;
		sectionIndex?: number;
		onInlineEditSaved?: (() => Promise<void>) | undefined;
		bookingSlotGroups?: { dateKey: string; slots: { startsAtIso: string; endsAtIso: string }[] }[];
		mailtoHref?: string;
	} = $props();

	const ctaHref = $derived('#booking');
	const ctaLabel = $derived(props?.primaryCtaLabel ?? 'Request Speaking Availability');
	const eyebrow = $derived(props?.eyebrow ?? 'The Digital Future Authority');
	const headline = $derived(
		props?.headline ?? 'AI Keynote Speaker for Your Next Industry Association Conference.'
	);
	const subheadline = $derived(
		props?.subheadline ??
			'Deeply researched, actionable insights bridging the gap between technological possibility and operational reality.'
	);
	const videoEmbedUrl = $derived(props?.videoEmbedUrl ?? 'https://player.vimeo.com/video/76979871');
	const heroImageUrl = $derived(
		props?.heroImageUrl ??
			props?.videoThumbnailUrl ??
			'https://cdn.prod.website-files.com/61263e0de406f497361dca55/6130408552ea140d707aab8e_christoph-contact-bg.jpg?auto=format&fit=crop&w=1400&q=80'
	);
	const heroImageAlt = $derived(
		props?.heroImageAlt ?? props?.videoThumbnailAlt ?? 'Christoph Holz on stage'
	);
	const supportingBullets = $derived(props?.supportingBullets ?? []);

	function extractYouTubeVideoId(input: string): string | null {
		try {
			const parsed = new URL(input);
			const hostname = parsed.hostname.replace('www.', '');

			if (hostname === 'youtu.be') {
				return parsed.pathname.split('/').filter(Boolean)[0] ?? null;
			}

			if (hostname.endsWith('youtube.com') || hostname.endsWith('youtube-nocookie.com')) {
				if (parsed.pathname === '/watch') {
					return parsed.searchParams.get('v');
				}

				if (parsed.pathname.startsWith('/embed/')) {
					return parsed.pathname.split('/').filter(Boolean)[1] ?? null;
				}
			}

			return null;
		} catch {
			return null;
		}
	}

	const isYouTubeUrl = $derived(!!extractYouTubeVideoId(videoEmbedUrl));

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

	function openYouTubeModal() {
		trackCta('showreel_modal');

		pushState('', {
			...page.state,
			modal: {
				kind: 'youtube',
				url: videoEmbedUrl
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
</script>

<section
	class="relative isolate overflow-hidden bg-surface px-6 py-16 sm:px-8 lg:px-12 lg:py-24"
	aria-label="Immediate Authority Hero section"
>
	<SectionIdentifier props={{ id: 'immediate_authority_hero' }}></SectionIdentifier>
	<div class="absolute inset-0 -z-20">
		<img class="h-full w-full object-cover grayscale" src={heroImageUrl} alt={heroImageAlt} />
	</div>
	<div
		class="absolute inset-0 -z-10 bg-linear-to-r from-surface via-surface/94 to-surface/82"
	></div>
	<div class="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-surface to-transparent"></div>

	<div class="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-12 lg:gap-12">
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
				<div class="w-full">
					<LeadInlineHeroBookingSequence
						{campaignId}
						{campaignPageId}
						pageSlug={pageSlug ?? null}
						slotGroups={bookingSlotGroups}
						formActionKey={`hero-inline-booking:${campaignPageId ?? 'none'}`}
						bookingSurface="hero"
						ctaKey="hero_inline_booking"
						ctaSection="hero"
					></LeadInlineHeroBookingSequence>
				</div>
				<a
					href={mailtoHref}
					type="button"
					class={[
						'inline-block border border-slate-300  bg-white px-3 py-2 text-xl font-bold text-slate-700 uppercase transition hover:border-slate-50'
					]}
				>
					Schreib mit eine email: speaker@christophholz.com
				</a>
			</div>
		</div>

		<div class="relative lg:col-span-5">
			<div class="aspect-4/5 overflow-hidden bg-surface-container-lowest">
				<img
					src={heroImageUrl}
					alt={heroImageAlt}
					class="h-full w-full object-cover transition-all duration-500"
				/>
			</div>
			<div class="absolute -right-6 -bottom-6 -z-10 h-28 w-28 bg-primary/20 blur-3xl"></div>
		</div>
	</div>
</section>
