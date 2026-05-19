<script lang="ts">
	import CampaignHeader from '$lib/components/campaign/CampaignHeader.svelte';
	import LandingPageSettingsRail from '$lib/components/campaign/LandingPageSettingsRail.svelte';
	import type { CampaignRecord } from '$lib/server/campaigns/client';
	import { onMount } from 'svelte';

	let { data, children } = $props();

	const campaignData = $derived(
		data as {
			campaign?: CampaignRecord;
			liveLandingUrl?: string | null;
		}
	);

	const SETTINGS_WIDTH_KEY = 'campaign-landing-settings-width';
	const DEFAULT_SETTINGS_WIDTH = 280;
	const MIN_SETTINGS_WIDTH = 220;

	let settingsWidth = $state(DEFAULT_SETTINGS_WIDTH);
	let isResizing = $state(false);

	const clampSettingsWidth = (value: number) => {
		if (typeof window === 'undefined') {
			return value;
		}

		const maxWidth = Math.floor(window.innerWidth * 0.3);
		return Math.max(MIN_SETTINGS_WIDTH, Math.min(maxWidth, Math.round(value)));
	};

	const setSettingsWidthFromPointer = (clientX: number) => {
		if (typeof window === 'undefined') {
			return;
		}

		const next = window.innerWidth - clientX;
		settingsWidth = clampSettingsWidth(next);
	};

	const stopResize = () => {
		if (typeof window === 'undefined') {
			return;
		}

		isResizing = false;
		document.body.style.userSelect = '';
		window.localStorage.setItem(SETTINGS_WIDTH_KEY, String(settingsWidth));
	};

	const onResizeHandlePointerDown = (event: PointerEvent) => {
		if (typeof window === 'undefined') {
			return;
		}

		if (window.innerWidth <= 1024) {
			return;
		}

		event.preventDefault();
		isResizing = true;
		document.body.style.userSelect = 'none';
		setSettingsWidthFromPointer(event.clientX);
	};

	const onWindowPointerMove = (event: PointerEvent) => {
		if (!isResizing) {
			return;
		}

		setSettingsWidthFromPointer(event.clientX);
	};

	const onWindowPointerUp = () => {
		if (!isResizing) {
			return;
		}

		stopResize();
	};

	const onWindowResize = () => {
		if (typeof window === 'undefined') {
			return;
		}

		settingsWidth = clampSettingsWidth(settingsWidth);
	};

	onMount(() => {
		if (typeof window === 'undefined') {
			return;
		}

		const stored = Number(window.localStorage.getItem(SETTINGS_WIDTH_KEY));
		if (Number.isFinite(stored) && stored > 0) {
			settingsWidth = clampSettingsWidth(stored);
		} else {
			settingsWidth = clampSettingsWidth(DEFAULT_SETTINGS_WIDTH);
		}

		return () => {
			document.body.style.userSelect = '';
		};
	});
</script>

<svelte:window
	onpointermove={onWindowPointerMove}
	onpointerup={onWindowPointerUp}
	onpointercancel={onWindowPointerUp}
	onresize={onWindowResize}
/>

<div class="landing-shell" style={`--settings-width: ${settingsWidth}px;`}>
	<section class="preview-column">
		<div class="preview-content">
			{@render children()}
		</div>
	</section>
	<button
		type="button"
		class="resize-handle"
		class:is-resizing={isResizing}
		onpointerdown={onResizeHandlePointerDown}
		aria-label="Resize settings panel"
		title="Drag to resize"
	></button>
	<aside class="settings-column" aria-label="Landing page settings rail">
		<LandingPageSettingsRail>
			<CampaignHeader
				campaign={campaignData.campaign ?? null}
				liveLandingUrl={campaignData.liveLandingUrl ?? null}
			/>
		</LandingPageSettingsRail>
	</aside>
</div>

<style>
	.landing-shell {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 10px var(--settings-width, 280px);
		height: 100dvh;
		min-height: 0;
		overflow: hidden;
		align-items: stretch;
	}

	.preview-column {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	.preview-content {
		min-width: 0;
		min-height: 0;
		flex: 1;
		overflow-y: auto;
	}

	.settings-column {
		min-width: 0;
		min-height: 0;
		height: 100dvh;
		overflow: hidden;
		border-left: 1px solid #d9dbcf;
		background: #f8fafc;
	}

	.resize-handle {
		height: 100dvh;
		cursor: col-resize;
		border: 0;
		padding: 0;
		background: linear-gradient(
			to right,
			transparent 0,
			transparent 4px,
			#d9dbcf 4px,
			#d9dbcf 6px,
			transparent 6px,
			transparent 100%
		);
	}

	.resize-handle:hover,
	.resize-handle.is-resizing {
		background: linear-gradient(
			to right,
			transparent 0,
			transparent 3px,
			#94a3b8 3px,
			#94a3b8 7px,
			transparent 7px,
			transparent 100%
		);
	}

	.preview-content :global(.landing-page-preview) {
		min-width: 0;
	}

	@media (max-width: 1024px) {
		.landing-shell {
			grid-template-columns: 1fr;
		}

		.resize-handle {
			display: none;
		}

		.settings-column {
			height: auto;
			overflow-y: visible;
			border-left: 0;
			border-top: 1px solid #d9dbcf;
		}
	}
</style>
