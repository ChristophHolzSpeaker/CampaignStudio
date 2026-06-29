const TRACKED_HOSTNAMES = new Set(['christophholz.com', 'www.christophholz.com']);

export function appendCampaignParamsToChristophLink(input: {
	href: string;
	searchParams: URLSearchParams;
	campaignId: number | null | undefined;
	campaignPageId: number | null | undefined;
}): string {
	let url: URL;

	try {
		url = new URL(input.href);
	} catch {
		return input.href;
	}

	if (!TRACKED_HOSTNAMES.has(url.hostname)) {
		return input.href;
	}

	const nextSearchParams = new URLSearchParams(url.searchParams);
	for (const [key, value] of input.searchParams.entries()) {
		nextSearchParams.set(key, value);
	}

	if (input.campaignId !== null && input.campaignId !== undefined) {
		nextSearchParams.set('campaignId', String(input.campaignId));
	}

	if (input.campaignPageId !== null && input.campaignPageId !== undefined) {
		nextSearchParams.set('campaignPageId', String(input.campaignPageId));
	}

	url.search = nextSearchParams.toString();
	return url.toString();
}
