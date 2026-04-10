<script lang="ts">
	import type { ComplianceTransparencyFooterProps } from '$lib/page-builder/sections/types';

	let { props }: { props?: ComplianceTransparencyFooterProps } = $props();

	const privacyPolicyUrl = $derived(props?.privacyPolicyUrl ?? 'https://christophholz.com/privacy');
	const contactEmail = $derived(props?.contactEmail ?? 'team@christophholz.com');
	const businessAddress = $derived(props?.businessAddress ?? 'Vienna, Austria');
	const phone = $derived(props?.phone);
	const copyrightText = $derived(props?.copyrightText ?? '© Christoph Holz. All rights reserved.');
	const additionalLinks = $derived(props?.additionalLinks ?? []);

	const brandName = 'Christoph Holz';
	const brandDescriptor =
		'Designing the digital future through speech, strategy, and responsible innovation.';

	const legalLinks = $derived([
		{ label: 'Privacy Policy', href: privacyPolicyUrl },
		...additionalLinks
	]);

	const phoneHref = $derived(phone ? `tel:${phone.replace(/\s+/g, '')}` : undefined);
	const emailHref = $derived(`mailto:${contactEmail}`);
</script>

<footer
	class="border-outline/20 bg-surface-container-highest border-t px-6 py-16 sm:px-8 lg:px-12"
	aria-label="Compliance and Transparency footer section"
>
	<div class="mx-auto grid max-w-7xl gap-10 lg:grid-cols-12 lg:gap-12">
		<div class="space-y-4 lg:col-span-5">
			<p class="text-2xl font-bold tracking-tight text-on-surface uppercase lg:text-3xl">
				{brandName}
			</p>
			<p class="max-w-md text-sm leading-relaxed text-on-surface/70">{brandDescriptor}</p>
		</div>

		<div class="grid gap-8 sm:grid-cols-2 lg:col-span-7 lg:justify-end">
			<div class="space-y-4">
				<h5 class="text-xs tracking-[0.16em] text-on-surface/75 uppercase">Contact</h5>
				<ul class="space-y-2 text-sm text-on-surface/70">
					<li>{businessAddress}</li>
					<li>
						<a class="transition-opacity hover:opacity-70" href={emailHref}>{contactEmail}</a>
					</li>
					{#if phone && phoneHref}
						<li>
							<a class="transition-opacity hover:opacity-70" href={phoneHref}>{phone}</a>
						</li>
					{/if}
				</ul>
			</div>

			<div class="space-y-4">
				<h5 class="text-xs tracking-[0.16em] text-on-surface/75 uppercase">Legal</h5>
				<ul class="space-y-2 text-sm text-on-surface/70">
					{#each legalLinks as link (`compliance-link-${link.label}`)}
						<li>
							<a class="transition-opacity hover:opacity-70" href={link.href}>{link.label}</a>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>

	<div class="border-outline/20 mx-auto mt-12 max-w-7xl border-t pt-8">
		<p class="text-[11px] tracking-[0.14em] text-on-surface/60 uppercase">{copyrightText}</p>
	</div>
</footer>
