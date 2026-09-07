<script lang="ts">
	import { onMount } from 'svelte';
	import LeadInlineBookingSequence from '$lib/components/booking/LeadInlineBookingSequence.svelte';
	let { data } = $props();

	function report(name: string, action: string) {
		if (!data.preview && parent !== window)
			parent.postMessage({ type: 'cs-widget-measure', name, action }, location.origin);
	}
	onMount(() => {
		const fields = new WeakSet<Element>();
		let started = false;
		const click = (event: MouseEvent) => {
			const target = event.target instanceof Element ? event.target.closest('button,a') : null;
			if (target)
				report(
					target.matches('a') ? 'navigation_click' : 'button_click',
					target.matches('a') ? 'booking_link' : 'booking_button'
				);
		};
		const input = (event: Event) => {
			const target = event.target;
			if (!(target instanceof Element) || fields.has(target)) return;
			fields.add(target);
			if (!started) {
				started = true;
				report('form_start', 'booking_form');
			}
			report('form_input', 'booking_field');
		};
		document.addEventListener('click', click);
		document.addEventListener('input', input);

		const observer = new ResizeObserver(() =>
			parent.postMessage(
				{
					type: 'cs-widget-resize',
					widget: 'booking-calendar',
					height: document.documentElement.scrollHeight
				},
				location.origin
			)
		);
		observer.observe(document.documentElement);
		return () => {
			observer.disconnect();
			document.removeEventListener('click', click);
			document.removeEventListener('input', input);
		};
	});
</script>

<main>
	{#if data.preview}
		<p class="preview-note">Booking is disabled in artifact preview.</p>
	{:else}
		<LeadInlineBookingSequence
			onBookingConfirmed={() => report('booking_confirmed', 'booking_form')}
			campaignId={data.campaignId}
			campaignPageId={data.campaignPageId}
			pageSlug={data.slug}
			slotGroups={data.slotGroups}
			bookingSurface="artifact_widget"
			formActionKey="artifact-booking"
			ctaKey="artifact_booking_widget"
		/>
	{/if}
</main>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		background: transparent;
	}
	main {
		padding: 0.5rem;
	}
	.preview-note {
		font:
			500 0.9rem/1.5 system-ui,
			sans-serif;
		padding: 1rem;
		border: 1px dashed #999;
	}
</style>
