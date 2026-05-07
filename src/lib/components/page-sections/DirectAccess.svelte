<script lang="ts">
	type DirectAccessProps = {
		mailtoHref: string;
	};

	let { props }: { props: DirectAccessProps } = $props();
</script>

<section class="overflow-hidden bg-on-surface px-6 py-10 text-surface sm:px-8 lg:px-12 lg:py-28">
	<div class="mx-auto max-w-7xl">
		<div class="group w-full">
			<p class="font-label-bold text-label-bold mb-4 tracking-[0.2em] text-white/60">
				DIRECT ACCESS
			</p>
			<a
				class="block border-l-8 border-primary bg-white p-8 transition-colors duration-300 group-hover:border-white md:border-l-16 md:p-12"
				href={props?.mailtoHref}
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
	</div>
</section>
