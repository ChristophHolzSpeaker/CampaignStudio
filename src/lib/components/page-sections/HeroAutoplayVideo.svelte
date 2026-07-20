<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { extractYouTubeVideoId } from '$lib/experiments/hero-video';

	type YouTubePlayer = {
		mute: () => void;
		playVideo: () => void;
		destroy: () => void;
	};

	type YouTubeNamespace = {
		Player: new (element: Element, options: Record<string, unknown>) => YouTubePlayer;
		PlayerState: { PLAYING: number };
	};

	const IFRAME_API_URL = 'https://www.youtube.com/iframe_api';
	let youTubeApiPromise: Promise<YouTubeNamespace> | null = null;

	function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
		const win = window as Window & {
			YT?: YouTubeNamespace;
			onYouTubeIframeAPIReady?: () => void;
		};

		if (win.YT?.Player) return Promise.resolve(win.YT);
		if (youTubeApiPromise) return youTubeApiPromise;

		youTubeApiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
			const previousReady = win.onYouTubeIframeAPIReady;
			win.onYouTubeIframeAPIReady = () => {
				previousReady?.();
				if (win.YT) resolve(win.YT);
			};

			const existingScript = document.querySelector<HTMLScriptElement>(
				`script[src="${IFRAME_API_URL}"]`
			);
			if (!existingScript) {
				const script = document.createElement('script');
				script.src = IFRAME_API_URL;
				script.async = true;
				script.onerror = () => reject(new Error('Failed to load YouTube IFrame API'));
				document.head.append(script);
			}
		});

		return youTubeApiPromise;
	}

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

	const videoId = $derived(extractYouTubeVideoId(url));
	let playerHost = $state<HTMLDivElement>();
	let motionAllowed = $state(false);
	let failed = $state(false);
	let player: YouTubePlayer | null = null;
	let readinessTimer: ReturnType<typeof setTimeout> | null = null;
	let readyReported = false;
	let errorReported = false;

	function clearReadinessTimer(): void {
		if (readinessTimer !== null) clearTimeout(readinessTimer);
		readinessTimer = null;
	}

	function destroyPlayer(): void {
		clearReadinessTimer();
		player?.destroy();
		player = null;
	}

	function reportReady(): void {
		clearReadinessTimer();
		if (readyReported) return;
		readyReported = true;
		onReady?.();
	}

	function reportError(): void {
		destroyPlayer();
		failed = true;
		if (errorReported) return;
		errorReported = true;
		onError?.();
	}

	onMount(() => {
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
		let cancelled = false;

		const startPlayer = async () => {
			if (!videoId || failed || reducedMotion.matches || player) return;
			motionAllowed = true;
			await tick();
			if (cancelled || !playerHost) return;

			try {
				const YT = await loadYouTubeIframeApi();
				if (cancelled || reducedMotion.matches) return;

				readinessTimer = setTimeout(reportError, 15_000);
				player = new YT.Player(playerHost, {
					width: '100%',
					height: '100%',
					host: 'https://www.youtube-nocookie.com',
					videoId,
					playerVars: {
						autoplay: 1,
						mute: 1,
						loop: 1,
						playlist: videoId,
						controls: 0,
						playsinline: 1,
						rel: 0,
						disablekb: 1,
						fs: 0
					},
					events: {
						onReady: (event: { target: YouTubePlayer }) => {
							event.target.mute();
							event.target.playVideo();
						},
						onStateChange: (event: { data: number }) => {
							if (event.data === YT.PlayerState.PLAYING) reportReady();
						},
						onError: reportError
					}
				});
			} catch {
				reportError();
			}
		};

		const updateMotionPreference = () => {
			if (reducedMotion.matches) {
				destroyPlayer();
				motionAllowed = false;
				return;
			}
			void startPlayer();
		};

		updateMotionPreference();
		reducedMotion.addEventListener('change', updateMotionPreference);

		return () => {
			cancelled = true;
			destroyPlayer();
			reducedMotion.removeEventListener('change', updateMotionPreference);
		};
	});
</script>

<div class="relative h-full w-full bg-surface-container-lowest">
	<img src={posterUrl} alt={posterAlt} class="h-full w-full object-cover" />
	{#if videoId && motionAllowed && !failed}
		<div
			class="pointer-events-none absolute top-1/2 left-1/2 aspect-video h-full w-auto max-w-none -translate-x-1/2 -translate-y-1/2 border-0"
			aria-hidden="true"
		>
			<div bind:this={playerHost} class="h-full w-full"></div>
		</div>
	{/if}
</div>
