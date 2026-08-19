<script lang="ts">
	import { onMount } from 'svelte';
	import LeadInlineBookingSequence from '$lib/components/booking/LeadInlineBookingSequence.svelte';
	let { data } = $props();
	onMount(() => {
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
		return () => observer.disconnect();
	});
</script>

<main>
	{#if data.preview}
		<p class="preview-note">Booking is disabled in artifact preview.</p>
	{:else}
		<LeadInlineBookingSequence
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
