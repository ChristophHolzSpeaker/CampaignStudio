<script lang="ts">
	import { onMount } from 'svelte';
	import { buildPrivacyEnhancedHeroVideoUrl } from '$lib/experiments/hero-video';

	let {
		url,
		posterUrl,
		posterAlt,
		onReady,
		onError
	}: {
		url: string;
		posterUrl: string;
		posterAlt: string;
		onReady?: () => void;
		onError?: () => void;
	} = $props();

	const embedUrl = $derived(buildPrivacyEnhancedHeroVideoUrl(url));
	let motionAllowed = $state(false);
	let failed = $state(false);
	let readyReported = false;
	let errorReported = false;
	let readinessTimer: ReturnType<typeof setTimeout> | null = null;

	function clearReadinessTimer(): void {
		if (readinessTimer !== null) {
			clearTimeout(readinessTimer);
			readinessTimer = null;
		}
	}

	function reportReady(): void {
		clearReadinessTimer();
		if (readyReported) return;
		readyReported = true;
		onReady?.();
	}

	function reportError(): void {
		clearReadinessTimer();
		failed = true;
		if (errorReported) return;
		errorReported = true;
		onError?.();
	}

	onMount(() => {
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const updateMotionPreference = () => {
			motionAllowed = !reducedMotion.matches;
		};

		updateMotionPreference();
		reducedMotion.addEventListener('change', updateMotionPreference);
		if (embedUrl && !reducedMotion.matches) {
			readinessTimer = setTimeout(reportError, 15_000);
		}

		return () => {
			clearReadinessTimer();
			reducedMotion.removeEventListener('change', updateMotionPreference);
		};
	});
</script>

<div class="relative h-full w-full bg-surface-container-lowest">
	<img src={posterUrl} alt={posterAlt} class="h-full w-full object-cover" />
	{#if embedUrl && motionAllowed && !failed}
		<iframe
			src={embedUrl}
			title="Autoplaying keynote speaker video"
			class="pointer-events-none absolute top-1/2 left-1/2 aspect-video h-full w-auto max-w-none -translate-x-1/2 -translate-y-1/2 border-0"
			allow="autoplay; encrypted-media; picture-in-picture"
			referrerpolicy="strict-origin-when-cross-origin"
			tabindex="-1"
			onload={reportReady}
			onerror={reportError}
		></iframe>
	{/if}
</div>
