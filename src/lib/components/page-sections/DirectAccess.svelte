<script lang="ts">
	type DirectAccessProps = {
		mailtoHref: string;
		emailCtaTitle?: string;
	};

	let { props }: { props: DirectAccessProps } = $props();

	let copied = $state(false);

	const emailAddress = $derived(
		props?.mailtoHref?.replace(/^mailto:/, '').split('?')[0] ?? 'speaker@christophholz.com'
	);

	async function copyEmail() {
		if (!emailAddress) return;

		try {
			await navigator.clipboard.writeText(emailAddress);
			copied = true;

			setTimeout(() => {
				copied = false;
			}, 1600);
		} catch (error) {
			console.error('Failed to copy email address', error);
		}
	}
</script>

<section class="overflow-hidden bg-on-surface px-2 py-6 text-surface sm:px-8 lg:px-12 lg:py-28">
	<div class="mx-auto max-w-7xl">
		<div class="group w-full">
			<p class="font-label-bold text-label-bold mb-4 text-base text-white/60 sm:tracking-[0.2em]">
				{props?.emailCtaTitle ?? 'Send an email right now'}
			</p>

			<div
				class="block w-full cursor-pointer border-l-8 border-primary bg-white p-4 text-left transition-colors duration-300 group-hover:border-white md:border-l-16 md:p-12"
			>
				<div class="flex flex-row items-center justify-between gap-8 text-black">
					<a
						href={props?.mailtoHref ?? 'mailto:speaker@christophholz.com'}
						class="text-xl leading-tight break-all hover:text-primary md:text-7xl"
					>
						{copied ? 'Copied!' : 'speaker@christophholz.com'}
					</a>

					<button
						class="mdi--content-copy h-4 w-4 cursor-pointer hover:text-primary sm:h-14 sm:w-14 md:inline-block"
						onclick={copyEmail}
						aria-label={`Copy ${emailAddress} to clipboard`}
					></button>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	.mdi--content-copy {
		display: inline-block;

		--svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M19 21H8V7h11m0-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m-3-4H4a2 2 0 0 0-2 2v14h2V3h12z'/%3E%3C/svg%3E");
		background-color: currentColor;
		-webkit-mask-image: var(--svg);
		mask-image: var(--svg);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
	}
</style>
