<script lang="ts">
	import { onMount } from 'svelte';

	type YouTubePlayer = {
		stopVideo?: () => void;
		destroy: () => void;
	};

	type YouTubeNamespace = {
		Player: new (element: Element, options: Record<string, unknown>) => YouTubePlayer;
	};

	const IFRAME_API_URL = 'https://www.youtube.com/iframe_api';
	let youTubeApiPromise: Promise<YouTubeNamespace> | null = null;

	function loadYouTubeIframeApi() {
		if (typeof window === 'undefined') {
			return Promise.reject(new Error('YouTube API can only be loaded in the browser'));
		}

		const win = window as Window & {
			YT?: YouTubeNamespace;
			onYouTubeIframeAPIReady?: () => void;
		};

		if (win.YT?.Player) {
			return Promise.resolve(win.YT);
		}

		if (youTubeApiPromise) {
			return youTubeApiPromise;
		}

		youTubeApiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
			const existingScript = document.querySelector<HTMLScriptElement>(
				`script[src="${IFRAME_API_URL}"]`
			);

			const previousReady = win.onYouTubeIframeAPIReady;
			win.onYouTubeIframeAPIReady = () => {
				previousReady?.();
				if (win.YT) {
					resolve(win.YT);
				}
			};

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

	function extractYouTubeVideoId(input: string): string | null {
		try {
			const parsed = new URL(input);
			const hostname = parsed.hostname.replace('www.', '');

			if (hostname === 'youtu.be') {
				const shortId = parsed.pathname.split('/').filter(Boolean)[0];
				return shortId ?? null;
			}

			if (hostname.endsWith('youtube.com') || hostname.endsWith('youtube-nocookie.com')) {
				if (parsed.pathname === '/watch') {
					return parsed.searchParams.get('v');
				}

				if (parsed.pathname.startsWith('/embed/')) {
					const embedId = parsed.pathname.split('/').filter(Boolean)[1];
					return embedId ?? null;
				}
			}

			return null;
		} catch {
			return null;
		}
	}

	type Props = {
		url: string;
		autoplay?: boolean;
	};

	let { url, autoplay = true }: Props = $props();

	const videoId = $derived(extractYouTubeVideoId(url));
	const playerHostId = $props.id();
	let player: YouTubePlayer | null = null;

	onMount(() => {
		if (!videoId) {
			return;
		}

		const playerHost = document.getElementById(playerHostId);
		if (!playerHost) {
			return;
		}

		let cancelled = false;

		void loadYouTubeIframeApi()
			.then((YT) => {
				if (cancelled || !playerHost) {
					return;
				}

				player = new YT.Player(playerHost, {
					videoId,
					playerVars: {
						rel: 0,
						playsinline: 1,
						autoplay: autoplay ? 1 : 0
					},
					events: {
						onReady: (event: { target?: { playVideo?: () => void } }) => {
							if (autoplay) {
								event.target?.playVideo?.();
							}
						}
					}
				});
			})
			.catch(() => {
				// no-op: if the API fails to load, the modal stays open
				// and users can close it with the modal controls.
			});

		return () => {
			cancelled = true;
			if (player) {
				player.stopVideo?.();
				player.destroy();
				player = null;
			}
		};
	});
</script>

{#if !videoId}
	<p class="text-sm text-on-surface/80">
		Please provide a valid YouTube URL (for example youtu.be, youtube.com/watch, or
		youtube.com/embed).
	</p>
{:else}
	<div class="aspect-video w-full overflow-hidden bg-black">
		<div id={playerHostId} class="h-full w-full"></div>
	</div>
{/if}
