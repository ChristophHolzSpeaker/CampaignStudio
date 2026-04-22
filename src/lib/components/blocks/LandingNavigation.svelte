<script lang="ts">
	import { goto } from '$app/navigation';
	import NavButton from '../elements/NavButton.svelte';
	let categoriesDropdown = $state(false);

	let dropdown: HTMLElement | null = null;

	let trigger: HTMLButtonElement | null = null;
	type CategoryItem = {
		href: string;
		headline: string;
		subline: string;
		image: string;
	};

	function clickOutside(node: HTMLElement) {
		const handleClick = (e: Event) => {
			if (
				categoriesDropdown &&
				node &&
				!node.contains(e.target as Element) &&
				!trigger?.contains(e.target as Element)
			) {
				categoriesDropdown = false;
			}
		};

		$effect(() => {
			document.addEventListener('click', handleClick, true);

			return () => document.removeEventListener('click', handleClick, true);
		});

		$effect(() => {
			document.addEventListener('click', handleClick, true);
			return () => document.removeEventListener('click', handleClick, true);
		});
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
</script>

<div class="fixed inset-x-0 top-0 z-50 bg-white py-4">
	<div class="mx-auto flex w-full max-w-7xl justify-between">
		<div class="w-full">
			<a href="/" aria-current="page" class="mr-2 text-5xl" aria-label="home">Christoph Holz</a>
		</div>
		<nav class="flex w-full justify-end gap-4">
			<button
				bind:this={trigger}
				onclick={() => (categoriesDropdown = !categoriesDropdown)}
				class="nav-normal h-full border-b-2 border-transparent p-2 leading-6 hover:border-black"
			>
				Categories
			</button>
			<button
				onclick={() =>
					goto(
						'https://cdn.prod.website-files.com/61263e0de406f497361dca55/6308862c3f689acc1eee77e7_Speaker.Christoph.Holz.Booklet_EN.2022.pdf'
					)}
				id="booklet-link"
				class="nav-normal h-full border-b-2 border-transparent p-2 leading-6 hover:border-black"
				>Booklet
			</button>
			<button
				onclick={() => goto('#contact')}
				class="nav-normal h-full border-b-2 border-transparent p-2 hover:border-black"
				>Contact</button
			>
			<div class="flex h-full items-center gap-4">
				{#snippet socialIcon({ href, icon }: { href: string; icon: string })}
					<a {href} target="_blank" class="flex h-full items-center"
						><img src={icon} loading="lazy" alt="" class="w-6" /></a
					>
				{/snippet}
				{@render socialIcon({
					href: 'https://www.linkedin.com/in/christophholz/',
					icon: 'https://cdn.prod.website-files.com/61263e0de406f497361dca55/614175ea2fb4fe0912d74604_61263e0ee406f48d121dcaa7_linkedin.svg'
				})}
				{@render socialIcon({
					href: 'https://www.instagram.com/christophholzofficial/',
					icon: 'https://cdn.prod.website-files.com/61263e0de406f497361dca55/614175ec3e125ed111071330_instagram-frame-black.svg'
				})}
				{@render socialIcon({
					href: 'https://open.spotify.com/show/3fFclUaDetP2pztpr158rk',
					icon: 'https://cdn.prod.website-files.com/61263e0de406f497361dca55/614175edc1af4f139378b2ad_spotify-fram-black.svg'
				})}
				{@render socialIcon({
					href: 'https://medium.com/@ChristophHolz/list/publications-e07f78389dc2',
					icon: 'https://cdn.prod.website-files.com/61263e0de406f497361dca55/626933dee08e863db54722fd_medium_logo-01.svg'
				})}
				{@render socialIcon({
					href: 'https://www.pinterest.at/digitalsensemaker/',
					icon: 'https://cdn.prod.website-files.com/61263e0de406f497361dca55/632afc31e73564d8a103fa2f_sozial.png'
				})}
			</div>

			<NavButton href="mailto:speaker@christophholz.com?subject=Vortrag%20anfragen"
				>Request a talk</NavButton
			>
		</nav>
		<div class="nav-container">
			<div class="nav-flex">
				<div
					class="menu-button w-nav-button"
					style="-webkit-user-select: text;"
					aria-label="menu"
					role="button"
					tabindex="0"
					aria-controls="w-nav-overlay-0"
					aria-haspopup="menu"
					aria-expanded="false"
				>
					<div class="icon w-icon-nav-menu"></div>
				</div>
			</div>
		</div>
	</div>
</div>

{#if categoriesDropdown}
	<nav bind:this={dropdown} use:clickOutside class="fixed inset-x-0 top-20 z-50">
		<div class="mx-auto flex w-full max-w-7xl items-center gap-10 bg-white p-4">
			<div class="category-block tablet-hide">
				<h2 class="text-2xl">Categories</h2>
			</div>
			<div class="expand-align-center">
				{#snippet categoryItem({ href, headline, subline, image }: CategoryItem)}
					<div role="listitem" class="flex items-center gap-4 border-r border-stone-300">
						<a title={headline} {href} class="flex h-16 w-16 items-center justify-center">
							<img src={image} alt={headline} class="block h-16 w-16 rounded-full object-cover" />
						</a>
						<div class="expand-flex">
							<div>
								<div class="flex">
									<a {href} class="category-medium-link" tabindex="0">{headline}</a>
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
						{#each categoryItems as cat}
							{@render categoryItem({ ...cat })}
						{/each}
					</div>
				</div>
			</div>
		</div>
	</nav>
{/if}
