<script lang="ts">
	import { page } from '$app/state';
	import { trackMailtoClick } from '$lib/analytics/track-mailto-click';
	import NavButton from '../elements/NavButton.svelte';
	import { appendCampaignParamsToChristophLink } from '$lib/url/christophholz-link';
	type LandingPageNavigationData = {
		mailto?: string;
		mailtoCta?: string;
		campaignId?: number | null;
		campaignPageId?: number | null;
		onExternalNavigationClick?: () => void;
	};
	let {
		mailto = 'mailto:speaker@christophholz.com?subject=Request%20a%20talk',
		mailtoCta = 'Vortrag Anfragen',
		campaignId = null,
		campaignPageId = null,
		onExternalNavigationClick
	}: LandingPageNavigationData = $props();

	let categoriesDropdown = $state(false);
	let mobileMenuOpen = $state(false);
	let mobileCategoriesOpen = $state(false);

	let dropdown = $state<HTMLElement | null>(null);

	let trigger: HTMLButtonElement | null = null;
	let mobileMenuTrigger: HTMLButtonElement | null = null;
	type CategoryItem = {
		href: string;
		headline: string;
		subline: string;
		image: string;
	};

	function clickOutside(node: HTMLElement) {
		const handleClick = (e: Event) => {
			const target = e.target as Element;

			if (
				(categoriesDropdown || mobileMenuOpen) &&
				node &&
				!node.contains(target) &&
				!trigger?.contains(target) &&
				!mobileMenuTrigger?.contains(target)
			) {
				categoriesDropdown = false;
				mobileMenuOpen = false;
				mobileCategoriesOpen = false;
			}
		};

		$effect(() => {
			document.addEventListener('click', handleClick, true);

			return () => document.removeEventListener('click', handleClick, true);
		});
	}

	function buildChristophLink(href: string): string {
		return appendCampaignParamsToChristophLink({
			href,
			searchParams: page.url.searchParams,
			campaignId,
			campaignPageId
		});
	}

	function extractCategoryKeyFromHref(href: string): string {
		const path = href.split('?')[0];
		const parts = path.split('/').filter(Boolean);
		const raw = parts[parts.length - 1] ?? 'category';
		return raw.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
	}

	function trackNavigationCta(input: {
		ctaKey: string;
		ctaLabel: string;
		ctaVariant: 'desktop' | 'mobile';
	}): void {
		if (campaignId == null || campaignPageId == null) {
			return;
		}

		const payload = JSON.stringify({
			type: 'navigation',
			campaign_id: campaignId,
			campaign_page_id: campaignPageId,
			cta_key: input.ctaKey,
			cta_label: input.ctaLabel,
			cta_section: 'landing_navigation',
			cta_variant: input.ctaVariant
		});

		if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
			const sent = navigator.sendBeacon(
				'/api/attribution/cta',
				new Blob([payload], { type: 'application/json' })
			);

			if (sent) {
				return;
			}
		}

		void fetch('/api/attribution/cta', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: payload,
			keepalive: true
		}).catch(() => {
			// fire-and-forget tracking
		});
	}

	function trackExternalNavigation(input: {
		ctaKey: string;
		ctaLabel: string;
		ctaVariant: 'desktop' | 'mobile';
	}): void {
		onExternalNavigationClick?.();
		trackNavigationCta(input);
	}

	const categoryItems: CategoryItem[] = [
		{
			href: 'https://christophholz.com/category/keynote-speaker',
			headline: 'Keynote Speaker',
			image:
				'/66838f71b048168509627b0e_613041565a65ff97d81a8cf7_TomJank_ChristophHolz_07_20191063.jpg',
			subline: 'Lectures, Conferences, Panels & Moderation'
		},
		{
			href: 'https://christophholz.com/category/tv-experte',
			headline: 'TV Expert',
			image:
				'/66838f63035dcd6be2fd4c0e_613041c87968a0cd8a5cb2a9_TomJank_ChristophHolz_07_20196023.jpg',
			subline: 'Quick-witted interviews on current topics'
		},
		{
			href: 'https://christophholz.com/category/publikationen',
			headline: 'Media / Publications',
			image:
				'/66838f7c2aa5a829708df264_613042672ac5e78d4e7ea7c8_Speaker.Christoph.Holz.Levitation-kl.jpg',
			subline: 'My publications'
		},
		{
			href: 'https://christophholz.com/category/podcast',
			headline: 'Podcast',
			image:
				'/66838f318d56cda657a0a8d9_6130421643b562f0e5cbec4c_Speaker.Christoph.Holz.Kugel-kl.jpg',
			subline: 'On the sense and nonsense behind digitalisation'
		},
		{
			href: 'https://christophholz.com/category/auszeichnungen',
			headline: 'Awards',
			image:
				'/66838f86d7201298089e644a_6130427b5484500025d60f99_Speaker.Christoph.Holz.blau.quer.jpg',
			subline: 'What others find exceptional and worthy of an award'
		},
		{
			href: 'https://christophholz.com/category/expertise',
			headline: 'Expertise',
			image: '/66838f94f95e35cb48131729_613042a1d1219939a9a74c_Speaker.Christoph.Holz.Rad-kl.jpg',
			subline: 'Lived experience in business, teaching and innovation'
		},
		{
			href: 'https://christophholz.com/category/angel-investor',
			headline: 'Angel investor',
			image:
				'/66838f429d37a6746c578148_613041e8dd88bf2bfed3c197_TomJank_ChristophHolz_07_20197222.jpg',
			subline: 'Capital, knowledge and network for young start-ups'
		}
	];

	function trackEmailCta(variant: 'default' | 'mobile'): void {
		if (campaignId == null || campaignPageId == null) {
			return;
		}

		const payload = JSON.stringify({
			type: 'email',
			campaign_id: campaignId,
			campaign_page_id: campaignPageId,
			cta_key: 'landing_navigation_email',
			cta_label: mailtoCta,
			cta_section: 'landing_navigation',
			cta_variant: variant
		});

		if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
			const sent = navigator.sendBeacon(
				'/api/attribution/cta',
				new Blob([payload], { type: 'application/json' })
			);

			if (sent) {
				return;
			}
		}

		void fetch('/api/attribution/cta', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: payload,
			keepalive: true
		}).catch(() => {
			// fire-and-forget tracking
		});
	}
</script>

<div class="fixed inset-x-0 top-0 z-50 bg-white px-4 py-2 lg:px-0 lg:py-4">
	<div class="mx-auto w-full max-w-7xl">
		<div class="hidden justify-between lg:flex">
			<a
				href={buildChristophLink('https://www.christophholz.com/')}
				aria-current="page"
				class="mr-2 text-5xl whitespace-nowrap"
				aria-label="home"
				onclick={() => {
					trackExternalNavigation({
						ctaKey: 'landing_navigation_home',
						ctaLabel: 'Home',
						ctaVariant: 'desktop'
					});
				}}>Christoph Holz</a
			>

			<nav class="flex w-full items-stretch justify-end gap-4">
				<button
					type="button"
					bind:this={trigger}
					onclick={() => {
						categoriesDropdown = !categoriesDropdown;
						mobileMenuOpen = false;
					}}
					aria-expanded={categoriesDropdown}
					aria-controls="categories-menu"
					class="nav-normal flex items-center border-b-2 border-transparent p-2 hover:border-black"
				>
					Kategorien
				</button>
				<a
					href="https://uploads-ssl.webflow.com/61263e0de406f497361dca55/6308862b5f040611761c02b5_Speaker.Christoph.Holz.Booklet.2022.pdf"
					target="_blank"
					id="booklet-link"
					onclick={() => {
						trackExternalNavigation({
							ctaKey: 'landing_navigation_booklet',
							ctaLabel: 'Booklet',
							ctaVariant: 'desktop'
						});
					}}
					class="nav-normal flex items-center border-b-2 border-transparent p-2 hover:border-black"
					>Booklet
				</a>
				<a
					href="#booking"
					class="nav-normal flex items-center border-b-2 border-transparent p-2 hover:border-black"
					>Kontakt</a
				>
				<div class="flex h-full items-center gap-4">
					{#snippet socialIcon({
						href,
						icon,
						ctaKey,
						ctaLabel,
						ctaVariant
					}: {
						href: string;
						icon: string;
						ctaKey: string;
						ctaLabel: string;
						ctaVariant: 'desktop' | 'mobile';
					})}
						<a
							{href}
							target="_blank"
							class="flex h-full items-center"
							onclick={() => {
								trackExternalNavigation({ ctaKey, ctaLabel, ctaVariant });
							}}><img src={icon} loading="lazy" alt="" class="w-6" /></a
						>
					{/snippet}
					{@render socialIcon({
						href: 'https://www.linkedin.com/in/christophholz/',
						icon: 'https://cdn.prod.website-files.com/61263e0de406f497361dca55/614175ea2fb4fe0912d74604_61263e0ee406f48d121dcaa7_linkedin.svg',
						ctaKey: 'landing_navigation_social_linkedin',
						ctaLabel: 'LinkedIn',
						ctaVariant: 'desktop'
					})}
					{@render socialIcon({
						href: 'https://www.instagram.com/christophholzofficial/',
						icon: 'https://cdn.prod.website-files.com/61263e0de406f497361dca55/614175ec3e125ed111071330_instagram-frame-black.svg',
						ctaKey: 'landing_navigation_social_instagram',
						ctaLabel: 'Instagram',
						ctaVariant: 'desktop'
					})}
					{@render socialIcon({
						href: 'https://open.spotify.com/show/3fFclUaDetP2pztpr158rk',
						icon: 'https://cdn.prod.website-files.com/61263e0de406f497361dca55/614175edc1af4f139378b2ad_spotify-fram-black.svg',
						ctaKey: 'landing_navigation_social_spotify',
						ctaLabel: 'Spotify',
						ctaVariant: 'desktop'
					})}
					{@render socialIcon({
						href: 'https://medium.com/@ChristophHolz/list/publications-e07f78389dc2',
						icon: 'https://cdn.prod.website-files.com/61263e0de406f497361dca55/626933dee08e863db54722fd_medium_logo-01.svg',
						ctaKey: 'landing_navigation_social_medium',
						ctaLabel: 'Medium',
						ctaVariant: 'desktop'
					})}
					{@render socialIcon({
						href: 'https://www.pinterest.at/digitalsensemaker/',
						icon: 'https://cdn.prod.website-files.com/61263e0de406f497361dca55/632afc31e73564d8a103fa2f_sozial.png',
						ctaKey: 'landing_navigation_social_pinterest',
						ctaLabel: 'Pinterest',
						ctaVariant: 'desktop'
					})}
				</div>

				<NavButton
					href={mailto}
					onclick={() => {
						trackEmailCta('default');
						trackMailtoClick();
					}}
				>
					{mailtoCta}
				</NavButton>
			</nav>
		</div>

		<div class="flex items-center justify-between lg:hidden">
			<a
				href={buildChristophLink('https://www.christophholz.com/')}
				aria-current="page"
				class="mr-2 text-3xl"
				aria-label="home"
				onclick={() => {
					trackExternalNavigation({
						ctaKey: 'landing_navigation_home',
						ctaLabel: 'Home',
						ctaVariant: 'mobile'
					});
				}}>Christoph Holz</a
			>
			<button
				bind:this={mobileMenuTrigger}
				onclick={() => {
					mobileMenuOpen = !mobileMenuOpen;
					categoriesDropdown = false;
				}}
				class="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium"
				aria-expanded={mobileMenuOpen}
				aria-label="Toggle menu"
			>
				{mobileMenuOpen ? 'Close' : 'Menu'}
			</button>
		</div>
	</div>
</div>

{#if categoriesDropdown}
	<nav
		id="categories-menu"
		bind:this={dropdown}
		use:clickOutside
		class="fixed inset-x-0 top-20 z-50 hidden lg:block"
	>
		<div class="mx-auto flex w-full max-w-7xl items-center gap-10 bg-white p-4">
			<div class="category-block tablet-hide">
				<h2 class="text-2xl">Categories</h2>
			</div>
			<div class="expand-align-center">
				{#snippet categoryItem({
					href,
					headline,
					subline,
					image,
					categoryKey
				}: CategoryItem & { categoryKey: string })}
					<div role="listitem" class="flex items-center gap-4 border-r border-stone-300">
						<a
							title={headline}
							href={buildChristophLink(href)}
							class="flex h-16 w-16 shrink-0 items-center justify-center"
							onclick={() => {
								trackExternalNavigation({
									ctaKey: `landing_navigation_category_${categoryKey}_image`,
									ctaLabel: headline,
									ctaVariant: 'desktop'
								});
							}}
						>
							<img src={image} alt={headline} class="block h-16 w-16 rounded-full object-cover" />
						</a>
						<div class="expand-flex">
							<div>
								<div class="flex">
									<a
										href={buildChristophLink(href)}
										class="category-medium-link"
										tabindex="0"
										onclick={() => {
											trackExternalNavigation({
												ctaKey: `landing_navigation_category_${categoryKey}_link`,
												ctaLabel: headline,
												ctaVariant: 'desktop'
											});
										}}
									>
										{headline}
									</a>
								</div>
								<div class="top-margin _3-pixels">
									<p class="text-xs font-light">
										{subline}
									</p>
								</div>
							</div>
						</div>
					</div>
				{/snippet}
				<div class="intro-categories w-dyn-list">
					<div role="list" class="grid grid-cols-4 gap-4">
						{#each categoryItems as cat (cat.href)}
							{@render categoryItem({
								...cat,
								categoryKey: extractCategoryKeyFromHref(cat.href)
							})}
						{/each}
					</div>
				</div>
			</div>
		</div>
	</nav>
{/if}

{#if mobileMenuOpen}
	<nav use:clickOutside class="fixed inset-x-0 top-20 z-40 lg:hidden">
		<div
			class="mx-4 origin-top rounded-b-xl border border-stone-200 bg-white p-4 shadow-lg transition-all duration-200 ease-out"
		>
			<button
				onclick={() => (mobileCategoriesOpen = !mobileCategoriesOpen)}
				class="flex w-full items-center justify-between border-b border-stone-200 pb-3 text-left text-base font-medium"
				aria-expanded={mobileCategoriesOpen}
			>
				<span>Categories</span>
				<span>{mobileCategoriesOpen ? '−' : '+'}</span>
			</button>

			{#if mobileCategoriesOpen}
				<div class="mt-3 space-y-3 border-b border-stone-200 pb-4">
					{#each categoryItems as cat (cat.href)}
						{@const categoryKey = extractCategoryKeyFromHref(cat.href)}
						<a
							href={cat.href}
							class="block rounded-md px-2 py-1 hover:bg-stone-50"
							onclick={() => {
								mobileMenuOpen = false;
								mobileCategoriesOpen = false;
								trackExternalNavigation({
									ctaKey: `landing_navigation_category_${categoryKey}_mobile`,
									ctaLabel: cat.headline,
									ctaVariant: 'mobile'
								});
							}}
						>
							<p class="text-sm font-medium">{cat.headline}</p>
							<p class="text-xs text-stone-600">{cat.subline}</p>
						</a>
					{/each}
				</div>
			{/if}

			<div class="mt-4 space-y-3">
				<a
					href="https://cdn.prod.website-files.com/61263e0de406f497361dca55/6308862c3f689acc1eee77e7_Speaker.Christoph.Holz.Booklet_EN.2022.pdf"
					class="block text-sm font-medium"
					onclick={() => {
						mobileMenuOpen = false;
						trackExternalNavigation({
							ctaKey: 'landing_navigation_booklet',
							ctaLabel: 'Booklet',
							ctaVariant: 'mobile'
						});
					}}>Booklet</a
				>
				<a
					href="#contact"
					class="block text-sm font-medium"
					onclick={() => (mobileMenuOpen = false)}>Contact</a
				>
			</div>

			<div class="mt-4 flex items-center gap-4 border-t border-stone-200 pt-4">
				<a
					href="https://www.linkedin.com/in/christophholz/"
					target="_blank"
					class="flex items-center"
					onclick={() => {
						trackExternalNavigation({
							ctaKey: 'landing_navigation_social_linkedin',
							ctaLabel: 'LinkedIn',
							ctaVariant: 'mobile'
						});
					}}
					><img
						src="https://cdn.prod.website-files.com/61263e0de406f497361dca55/614175ea2fb4fe0912d74604_61263e0ee406f48d121dcaa7_linkedin.svg"
						loading="lazy"
						alt=""
						class="w-6"
					/></a
				>
				<a
					href="https://www.instagram.com/christophholzofficial/"
					target="_blank"
					class="flex items-center"
					onclick={() => {
						trackExternalNavigation({
							ctaKey: 'landing_navigation_social_instagram',
							ctaLabel: 'Instagram',
							ctaVariant: 'mobile'
						});
					}}
					><img
						src="https://cdn.prod.website-files.com/61263e0de406f497361dca55/614175ec3e125ed111071330_instagram-frame-black.svg"
						loading="lazy"
						alt=""
						class="w-6"
					/></a
				>
				<a
					href="https://open.spotify.com/show/3fFclUaDetP2pztpr158rk"
					target="_blank"
					class="flex items-center"
					onclick={() => {
						trackExternalNavigation({
							ctaKey: 'landing_navigation_social_spotify',
							ctaLabel: 'Spotify',
							ctaVariant: 'mobile'
						});
					}}
					><img
						src="https://cdn.prod.website-files.com/61263e0de406f497361dca55/614175edc1af4f139378b2ad_spotify-fram-black.svg"
						loading="lazy"
						alt=""
						class="w-6"
					/></a
				>
				<a
					href="https://medium.com/@ChristophHolz/list/publications-e07f78389dc2"
					target="_blank"
					class="flex items-center"
					onclick={() => {
						trackExternalNavigation({
							ctaKey: 'landing_navigation_social_medium',
							ctaLabel: 'Medium',
							ctaVariant: 'mobile'
						});
					}}
					><img
						src="https://cdn.prod.website-files.com/61263e0de406f497361dca55/626933dee08e863db54722fd_medium_logo-01.svg"
						loading="lazy"
						alt=""
						class="w-6"
					/></a
				>
				<a
					href="https://www.pinterest.at/digitalsensemaker/"
					target="_blank"
					class="flex items-center"
					onclick={() => {
						trackExternalNavigation({
							ctaKey: 'landing_navigation_social_pinterest',
							ctaLabel: 'Pinterest',
							ctaVariant: 'mobile'
						});
					}}
					><img
						src="https://cdn.prod.website-files.com/61263e0de406f497361dca55/632afc31e73564d8a103fa2f_sozial.png"
						loading="lazy"
						alt=""
						class="w-6"
					/></a
				>
			</div>

			<div class="mt-4">
				<NavButton
					href={mailto}
					onclick={() => {
						trackEmailCta('mobile');
						trackMailtoClick();
					}}
				>
					{mailtoCta}
				</NavButton>
			</div>
		</div>
	</nav>
{/if}
