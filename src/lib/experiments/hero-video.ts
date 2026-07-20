const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function extractYouTubeVideoId(input: string): string | null {
	try {
		const url = new URL(input);
		const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
		let candidate: string | null = null;

		if (hostname === 'youtu.be') {
			candidate = url.pathname.split('/').filter(Boolean)[0] ?? null;
		} else if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
			if (url.pathname === '/watch') {
				candidate = url.searchParams.get('v');
			} else if (url.pathname.startsWith('/embed/') || url.pathname.startsWith('/shorts/')) {
				candidate = url.pathname.split('/').filter(Boolean)[1] ?? null;
			}
		}

		return candidate && YOUTUBE_VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
	} catch {
		return null;
	}
}

export function isEligibleHeroVideoUrl(input: string): boolean {
	return extractYouTubeVideoId(input) !== null;
}

export function buildPrivacyEnhancedHeroVideoUrl(input: string): string | null {
	const videoId = extractYouTubeVideoId(input);
	if (!videoId) {
		return null;
	}

	const query = new URLSearchParams({
		autoplay: '1',
		mute: '1',
		loop: '1',
		playlist: videoId,
		controls: '0',
		playsinline: '1',
		rel: '0',
		enablejsapi: '1'
	});

	return `https://www.youtube-nocookie.com/embed/${videoId}?${query.toString()}`;
}
