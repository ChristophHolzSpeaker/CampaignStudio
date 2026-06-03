<script lang="ts">
	import { trackMailtoClick } from '$lib/analytics/track-mailto-click';
	import type { ComplianceTransparencyFooterProps } from '$lib/page-builder/sections/types';
	import SectionIdentifier from '../elements/SectionIdentifier.svelte';

	let {
		props,
		campaignId = null,
		campaignPageId = null,
		mailtoHref
	}: {
		props?: ComplianceTransparencyFooterProps;
		campaignId?: number | null;
		campaignPageId?: number | null;
		mailtoHref?: string;
	} = $props();

	const privacyPolicyUrl = $derived(props?.privacyPolicyUrl ?? 'https://christophholz.com/privacy');
	const contactEmail = $derived(props?.contactEmail ?? 'speaker@christophholz.com');

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
	const emailHref = $derived(mailtoHref ?? `mailto:${contactEmail}`);

	function trackDirectEmailCta(): void {
		if (campaignId == null || campaignPageId == null) {
			return;
		}

		void fetch('/api/attribution/cta', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				type: 'email',
				campaign_id: campaignId,
				campaign_page_id: campaignPageId,
				cta_key: 'compliance_footer_email',
				cta_label: contactEmail,
				cta_section: 'compliance_transparency_footer',
				cta_variant: 'default'
			})
		}).catch(() => {
			// fire-and-forget tracking
		});
	}
</script>

<footer
	class="border-outline/20 bg-surface-container-highest relative border-t px-6 py-16 sm:px-8 lg:px-12"
	aria-label="Compliance and Transparency footer section"
>
	<SectionIdentifier props={{ id: 'compliance_footer' }}></SectionIdentifier>
	<div class="mx-auto grid max-w-7xl gap-10 lg:grid-cols-12 lg:gap-12">
		<div class="space-y-4 lg:col-span-5">
			<h2 class="text-2xl text-on-surface uppercase lg:text-3xl">
				{brandName}
			</h2>
			<div class="top-margin _20-pixels">
				<p>
					Dipl.-Informatiker Christoph Holz<br />Achenallee 16A<br />6380 St. Johann in Tirol<br
					/><br />Medienanfragen:<br /><a
						href="mailto:presse@christophholz.com?subject=Medienanfragen"
						class="footer-link">presse@christophholz.com<br /><br /></a
					>Keynote-Anfragen:<br /><a
						href={emailHref}
						onclick={() => {
							trackDirectEmailCta();
							trackMailtoClick();
						}}
						class="footer-link">speaker@christophholz.com</a
					><br /><a href="tel:+4369917407401" class="footer-link">+43 699 17407401</a>
				</p>
			</div>
		</div>

		<div class="grid gap-8 sm:grid-cols-4 lg:col-span-7 lg:justify-end">
			<div class="menu">
				<div class="footer-title">Menü</div>
				<div class="top-margin _10-pixels">
					<div class="top-margin _15-pixels">
						<a href="/" aria-current="page" class="footer-menu-link w-inline-block w--current"
							><div>Home</div>
							<div class="footer-underline" style="width: 0px;"></div></a
						>
					</div>
					<a
						href="https://booklet.christophholz.com"
						target="_blank"
						class="footer-menu-link w-inline-block"
						><div>Booklet</div>
						<div class="footer-underline" style="width: 0%; height: 1px;"></div></a
					>
					<div class="w-dyn-list">
						<div role="list" class="w-dyn-items">
							<div role="listitem" class="w-dyn-item">
								<a
									href="/category/keynote-speaker"
									data-w-id="b3e83569-8560-1e34-cca7-cec611d3a75b"
									class="footer-menu-link w-inline-block"
									><div>Keynote Speaker</div>
									<div class="footer-underline" style="width: 0px;"></div></a
								>
							</div>
							<div role="listitem" class="w-dyn-item">
								<a
									href="/category/tv-experte"
									data-w-id="b3e83569-8560-1e34-cca7-cec611d3a75b"
									class="footer-menu-link w-inline-block"
									><div>TV Experte</div>
									<div class="footer-underline" style="width: 0px;"></div></a
								>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="menu">
				<div class="footer-title">Kategorie</div>
				<div class="top-margin _15-pixels">
					<div class="w-dyn-list">
						<div role="list" class="w-dyn-items">
							<div role="listitem" class="w-dyn-item">
								<a
									href="/category/publikationen"
									data-w-id="771583c4-ae57-c2c8-7414-667d88901f00"
									class="footer-menu-link w-inline-block"
									><div>Medien / Publikationen</div>
									<div class="footer-underline" style="width: 0px;"></div></a
								>
							</div>
							<div role="listitem" class="w-dyn-item">
								<a
									href="/category/podcast"
									data-w-id="771583c4-ae57-c2c8-7414-667d88901f00"
									class="footer-menu-link w-inline-block"
									><div>Podcast</div>
									<div class="footer-underline" style="width: 0px;"></div></a
								>
							</div>
							<div role="listitem" class="w-dyn-item">
								<a
									href="/category/auszeichnungen"
									data-w-id="771583c4-ae57-c2c8-7414-667d88901f00"
									class="footer-menu-link w-inline-block"
									><div>Auszeichnungen</div>
									<div class="footer-underline" style="width: 0px;"></div></a
								>
							</div>
							<div role="listitem" class="w-dyn-item">
								<a
									href="/category/expertise"
									data-w-id="771583c4-ae57-c2c8-7414-667d88901f00"
									class="footer-menu-link w-inline-block"
									><div>Expertise</div>
									<div class="footer-underline" style="width: 0px;"></div></a
								>
							</div>
							<div role="listitem" class="w-dyn-item">
								<a
									href="/category/angel-investor"
									data-w-id="771583c4-ae57-c2c8-7414-667d88901f00"
									class="footer-menu-link w-inline-block"
									><div>Angel Investor</div>
									<div class="footer-underline" style="width: 0px;"></div></a
								>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="menu">
				<div class="footer-title">Social Media</div>
				<div class="top-margin _15-pixels">
					<a
						href="https://www.linkedin.com/in/christophholz/"
						data-w-id="ada3dd44-207c-3ded-48de-60950933d361"
						target="_blank"
						class="footer-menu-link w-inline-block"
						><div>LinkedIn</div>
						<div class="footer-underline" style="width: 0px;"></div></a
					>
				</div>
				<div>
					<a
						href="https://www.instagram.com/christophholzofficial/"
						data-w-id="771583c4-ae57-c2c8-7414-667d88901f19"
						target="_blank"
						class="footer-menu-link w-inline-block"
						><div>Instagram</div>
						<div class="footer-underline" style="width: 0px;"></div></a
					>
				</div>
				<div>
					<a
						href="https://www.facebook.com/christophholzofficial"
						data-w-id="771583c4-ae57-c2c8-7414-667d88901f0f"
						target="_blank"
						class="footer-menu-link w-inline-block"
						><div>Facebook</div>
						<div class="footer-underline" style="width: 0px;"></div></a
					>
				</div>
				<div>
					<a
						href="https://www.youtube.com/channel/UCldidgVvtzSd9qj6QYU3rGA"
						data-w-id="fbf937f3-50df-85d6-e590-de0189c85ed8"
						target="_blank"
						class="footer-menu-link w-inline-block"
						><div>Youtube</div>
						<div class="footer-underline" style="width: 0px;"></div></a
					>
				</div>
			</div>
			<div class="menu">
				<div class="footer-title">podcast</div>
				<div class="top-margin _15-pixels">
					<a
						href="https://podcasts.apple.com/at/podcast/digital-sensemaker-der-podcast-f%C3%BCr-digitalisierung/id1546831897"
						data-w-id="ed79f314-a12c-93e2-05a0-387baff53c25"
						target="_blank"
						class="footer-menu-link w-inline-block"
						><div>Apple</div>
						<div class="footer-underline" style="width: 0px;"></div></a
					>
				</div>
				<div>
					<a
						href="https://open.spotify.com/show/3fFclUaDetP2pztpr158rk?si=97b96ba193c54d3d"
						data-w-id="ed79f314-a12c-93e2-05a0-387baff53c2a"
						target="_blank"
						class="footer-menu-link w-inline-block"
						><div>Spotify</div>
						<div class="footer-underline" style="width: 0px;"></div></a
					>
				</div>
				<div>
					<a
						href="https://deezer.page.link/qYYjiMbWVTG7ePWF6"
						data-w-id="ed79f314-a12c-93e2-05a0-387baff53c2f"
						target="_blank"
						class="footer-menu-link w-inline-block"
						><div>Deezer</div>
						<div class="footer-underline" style="width: 0px;"></div></a
					>
				</div>
			</div>
		</div>
	</div>

	<div class="border-outline/20 mx-auto mt-12 flex max-w-7xl items-center border-t pt-8">
		<p class="text-[11px] tracking-[0.14em] text-on-surface/60 uppercase">{copyrightText}</p>
		<ul class="ml-4 flex">
			{#each legalLinks as link (`compliance-link-${link.label}`)}
				<li class="mr-2 border-r border-slate-400 pr-2">
					<a class="transition-opacity hover:opacity-70" href={link.href}>{link.label}</a>
				</li>
			{/each}
		</ul>
	</div>
</footer>

<style>
	.footer-title {
		color: #000;
		text-transform: uppercase;
		font-family:
			Bureau grot compressed,
			sans-serif;
		font-size: 19px;
		font-weight: 500;
	}

	.footer-menu-link {
		color: #000;
		align-items: center;
		height: 35px;
		font-size: 14px;
		font-weight: 500;
		text-decoration: none;
	}

	.footer-menu-link.w--current {
		color: var(--primary);
	}

	.footer-link {
		color: var(--primary);
		text-decoration: underline;
		transition: color 0.2s;
	}

	.footer-link:hover {
		opacity: 0.85;
		color: var(--text);
	}
</style>
