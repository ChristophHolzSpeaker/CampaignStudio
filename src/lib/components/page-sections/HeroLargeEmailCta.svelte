<script lang="ts">
	type HeroLargeEmailCtaProps = {
		heading: string;
		labelText: string;
		mailto: string;
	};

	let { props }: { props?: HeroLargeEmailCtaProps } = $props();

	let headingSplit = $derived(props?.heading.trim().split(/\s+/));

	let firstPart = $derived(headingSplit?.slice(0, -1).join(' '));
	let lastWord = $derived(headingSplit?.at(-1));

	$inspect(props);
</script>

<section class="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
	<!-- Background Image with Tonal Layering -->
	<div class="absolute inset-0 z-0">
		<img
			alt="Christoph on stage"
			class="h-full w-full object-cover opacity-60 grayscale transition-all duration-1000 hover:grayscale-0"
			data-alt="dynamic shot of a charismatic male speaker on a professional stage with dramatic red and blue stage lighting and silhouetted audience"
			src="/christoph-holz-on-stage-engaging-cheering-audience-bow-tie.webp"
		/>
		<div class="absolute inset-0 bg-linear-to-tr from-primary/40 to-transparent"></div>
	</div>
	<!-- Directional Layout Content -->
	<div class="relative z-10 flex w-full max-w-7xl flex-col items-start gap-12 px-8">
		<div class="max-w-3xl">
			<span
				class="font-label-bold text-label-bold mb-6 inline-block bg-primary px-4 py-1 text-white"
			>
				{props?.labelText}
			</span>
			<h1 class="max-w-xl text-5xl leading-[0.95] font-bold tracking-tight text-white lg:text-7xl">
				{firstPart} <span class="text-primary">{lastWord}.</span>
			</h1>
		</div>
		<!-- Massive Email Block -->
		<div class="group w-full">
			<p class="font-label-bold text-label-bold mb-4 tracking-[0.2em] text-white/60">
				DIRECT ACCESS
			</p>
			<a
				class="block border-l-8 border-primary bg-white p-8 transition-colors duration-300 group-hover:border-white md:border-l-16 md:p-12"
				href={props?.mailto}
			>
				<div class="flex flex-col items-center justify-between gap-8 md:flex-row">
					<span
						class="text-3xl leading-tight break-all text-black group-hover:text-primary md:text-7xl"
					>
						speaker@christophholz.com
					</span>
					<span class=" mdi--arrow-right hidden h-20 w-20 group-hover:text-primary md:inline-block"
					></span>
				</div>
			</a>
		</div>
		<!-- Secondary Contact Grid (Bento Style) -->
		<!--<div class="mt-12 grid w-full grid-cols-1 gap-6 md:grid-cols-3">
			<div
				class="border border-white/10 bg-zinc-900/50 p-8 backdrop-blur-md transition-all hover:border-primary"
			>
				<span class="material-symbols-outlined text-primary-container mb-4" data-icon="location_on"
					>location_on</span
				>
				<h3 class="font-headline-md text-headline-md mb-2 text-white">Global</h3>
				<p class="font-body-md text-white/70">
					Available for keynotes worldwide. HQ: Berlin &amp; NYC.
				</p>
			</div>
			<div
				class="border border-white/10 bg-zinc-900/50 p-8 backdrop-blur-md transition-all hover:border-primary"
			>
				<span
					class="material-symbols-outlined text-primary-container mb-4"
					data-icon="phone_in_talk">phone_in_talk</span
				>
				<h3 class="font-headline-md text-headline-md mb-2 text-white">Urgent</h3>
				<p class="font-body-md text-white/70">For immediate event inquiries: +1 (555) ORATOR-01</p>
			</div>
			<div
				class="border border-white/10 bg-zinc-900/50 p-8 backdrop-blur-md transition-all hover:border-primary"
			>
				<span class="material-symbols-outlined text-primary-container mb-4" data-icon="diversity_3"
					>diversity_3</span
				>
				<h3 class="font-headline-md text-headline-md mb-2 text-white">Press</h3>
				<p class="font-body-md text-white/70">
					Media kit and interview requests: press@theorator.com
				</p>
			</div>
		</div>-->
	</div>
</section>

<style>
	.mdi--arrow-right {
		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M4 11v2h12l-5.5 5.5l1.42 1.42L19.84 12l-7.92-7.92L10.5 5.5L16 11z'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}
</style>
