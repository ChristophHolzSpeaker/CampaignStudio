// Self-contained so the artifact helper can serve this same function as plain JS.
// Only mailto navigation changes. Copying an address continues to copy the short alias.
export function startEmailAttribution(campaignPageId: number): () => void {
	const pageAddress = `speakerlp+${campaignPageId}@christophholz.com`;
	const canonicalize = (href: string) => {
		try {
			const link = new URL(href);
			if (
				link.protocol === 'mailto:' &&
				link.pathname.toLowerCase() === 'speakerlp@christophholz.com'
			) {
				return `mailto:${pageAddress}${link.search}${link.hash}`;
			}
			return link.href;
		} catch {
			return href;
		}
	};
	// An artifact's page ID is assigned after upload. Authors can use the plain base
	// alias; published links and literal address labels receive the short page alias.
	document.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]').forEach((link) => {
		const original = link.href;
		link.href = canonicalize(original);
		if (
			link.href !== original &&
			link.textContent?.trim().toLowerCase() === 'speakerlp@christophholz.com'
		)
			link.textContent = pageAddress;
	});
	let stopped = false;
	let reference: string | null = null;
	let pending: Promise<string | null> | null = null;
	let navigating = false;
	const prepare = () => {
		if (reference) return Promise.resolve(reference);
		if (pending) return pending;
		pending = (async () => {
			try {
				// Existing runtimes initialize visits asynchronously. Do not create a second visit.
				for (let attempt = 0; attempt < 5 && !stopped; attempt++) {
					const response = await fetch('/api/runtime/v1/email-reference', {
						method: 'POST',
						credentials: 'same-origin',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ campaignPageId }),
						signal: AbortSignal.timeout(1200)
					});
					if (response.ok) {
						const result = await response.json();
						if (/^Referenz: CS-[a-f0-9]{32}$/.test(result?.data?.reference ?? '')) {
							reference = result.data.reference;
							return reference;
						}
						break;
					}
					if (response.status !== 409) break;
					await new Promise((resolve) => setTimeout(resolve, 150));
				}
			} catch {
				/* Email must remain usable when attribution is unavailable. */
			}
			return null;
		})().finally(() => {
			pending = null;
		});
		return pending;
	};
	const isCampaignEmail = (href: string) => {
		try {
			return new URL(canonicalize(href)).pathname.toLowerCase() === pageAddress;
		} catch {
			return false;
		}
	};
	const withReference = (href: string, line: string) => {
		const mailto = new URL(href);
		const body = mailto.searchParams.get('body') ?? '';
		if (!body.includes(line))
			mailto.searchParams.set('body', `${body}${body ? '\n\n' : ''}${line}`);
		return mailto.href;
	};
	const click = (event: MouseEvent) => {
		const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
		if (
			!(link instanceof HTMLAnchorElement) ||
			!link.href.startsWith('mailto:') ||
			!isCampaignEmail(link.href) ||
			event.defaultPrevented
		)
			return;
		// Keep the DOM href unchanged: address-copy controls may derive it from this link.
		event.preventDefault();
		if (navigating) return;
		navigating = true;
		const original = canonicalize(link.href);
		void Promise.race([
			prepare(),
			new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))
		])
			.then((line) => {
				if (!stopped) window.location.assign(line ? withReference(original, line) : original);
			})
			.finally(() => {
				navigating = false;
			});
	};
	document.addEventListener('click', click);
	void prepare();
	return () => {
		stopped = true;
		document.removeEventListener('click', click);
	};
}
