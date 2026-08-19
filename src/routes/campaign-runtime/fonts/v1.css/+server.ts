import { dev } from '$app/environment';
import bureauGrotBookUrl from '$lib/assets/fonts/Bureau Grot Book.otf?url';
import bureauGrotLightUrl from '$lib/assets/fonts/Bureau Grot Light.otf?url';
import bureauGrotCompressedBoldUrl from '$lib/assets/fonts/Bureau Grot Compressed Bold.otf?url';
import bureauGrotCompressedBookUrl from '$lib/assets/fonts/Bureau Grot Compressed Book.otf?url';
import bureauGrotCompressedLightUrl from '$lib/assets/fonts/Bureau Grot Compressed Light.otf?url';
import bureauGrotCompressedMediumUrl from '$lib/assets/fonts/Bureau_Grot-Compressed_Medium.otf?url';
import type { RequestHandler } from './$types';

const stylesheet = `@font-face {
  font-family: 'Bureau Grot';
  src: url('${bureauGrotLightUrl}') format('opentype');
  font-weight: 300;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Bureau Grot';
  src: url('${bureauGrotBookUrl}') format('opentype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Bureau Grot Compressed';
  src: url('${bureauGrotCompressedLightUrl}') format('opentype');
  font-weight: 300;
  font-style: normal;
  font-display: swap;
  font-stretch: condensed;
}

@font-face {
  font-family: 'Bureau Grot Compressed';
  src: url('${bureauGrotCompressedBookUrl}') format('opentype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  font-stretch: condensed;
}

@font-face {
  font-family: 'Bureau Grot Compressed';
  src: url('${bureauGrotCompressedMediumUrl}') format('opentype');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
  font-stretch: condensed;
}

@font-face {
  font-family: 'Bureau Grot Compressed';
  src: url('${bureauGrotCompressedBoldUrl}') format('opentype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
  font-stretch: condensed;
}

:root {
  --cs-font-sans: 'Bureau Grot', ui-sans-serif, system-ui, sans-serif;
  --cs-font-display: 'Bureau Grot Compressed', 'Bureau Grot', sans-serif;
}`;

export const GET: RequestHandler = () =>
	new Response(stylesheet, {
		headers: {
			'Content-Type': 'text/css; charset=utf-8',
			'Cache-Control': dev ? 'no-store' : 'public, max-age=31536000, immutable',
			'X-Content-Type-Options': 'nosniff'
		}
	});
