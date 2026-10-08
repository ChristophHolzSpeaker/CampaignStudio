import { afterEach, expect, it, vi } from 'vitest';
import { startEmailAttribution } from './email-browser';

class ElementStub {
	closest() {
		return this;
	}
}
class AnchorStub extends ElementStub {
	constructor(public href: string) {
		super();
	}
}
afterEach(() => vi.unstubAllGlobals());
function mount(fetch: ReturnType<typeof vi.fn>) {
	const listeners = new Map<string, (event: MouseEvent) => void>();
	const assign = vi.fn();
	vi.stubGlobal('Element', ElementStub);
	vi.stubGlobal('HTMLAnchorElement', AnchorStub);
	vi.stubGlobal('fetch', fetch);
	vi.stubGlobal('document', {
		querySelectorAll: () => [],
		addEventListener: (name: string, fn: (event: MouseEvent) => void) => listeners.set(name, fn),
		removeEventListener: vi.fn()
	});
	vi.stubGlobal('window', { location: { assign } });
	const stop = startEmailAttribution(287);
	return {
		assign,
		stop,
		click: (link: AnchorStub) => {
			const event = { target: link, defaultPrevented: false, preventDefault: vi.fn() };
			listeners.get('click')!(event as unknown as MouseEvent);
			return event;
		}
	};
}
it('waits for an early mailto click and preserves recipient, subject and existing body', async () => {
	let resolve: (value: Response) => void = () => {};
	const fetch = vi.fn(
		() =>
			new Promise<Response>((done) => {
				resolve = done;
			})
	);
	const { click, assign, stop } = mount(fetch);
	const href = 'mailto:speakerlp+287@christophholz.com?subject=Workshop&body=Guten%20Tag';
	const link = new AnchorStub(href);
	expect(click(link).preventDefault).toHaveBeenCalledOnce();
	expect(assign).not.toHaveBeenCalled();
	resolve(Response.json({ data: { reference: 'Referenz: CS-00112233445546778899aabbccddeeff' } }));
	await vi.waitFor(() => expect(assign).toHaveBeenCalledOnce());
	const sent = new URL(assign.mock.calls[0][0]);
	expect(sent.pathname).toBe('speakerlp+287@christophholz.com');
	expect(sent.searchParams.get('subject')).toBe('Workshop');
	expect(sent.searchParams.get('body')).toBe(
		'Guten Tag\n\nReferenz: CS-00112233445546778899aabbccddeeff'
	);
	expect(link.href).toBe(href); // Copy controls still derive only the original address.
	stop();
});
it('opens the original mailto when reference creation fails', async () => {
	const { click, assign, stop } = mount(
		vi.fn(async () => {
			throw new Error('offline');
		})
	);
	const href = 'mailto:speakerlp+287@christophholz.com?subject=Workshop';
	click(new AnchorStub(href));
	await vi.waitFor(() => expect(assign).toHaveBeenCalledWith(href));
	stop();
});
it('supplies the short page alias for ordinary artifact mailto links', async () => {
	const { click, assign, stop } = mount(
		vi.fn(async () =>
			Response.json({ data: { reference: 'Referenz: CS-00112233445546778899aabbccddeeff' } })
		)
	);
	click(new AnchorStub('mailto:speakerlp@christophholz.com?subject=Workshop'));
	await vi.waitFor(() => expect(assign).toHaveBeenCalledOnce());
	expect(new URL(assign.mock.calls[0][0]).pathname).toBe('speakerlp+287@christophholz.com');
	stop();
});
it('leaves other campaigns and unrelated recipient addresses untouched', () => {
	const { click, assign, stop } = mount(vi.fn(async () => Response.json({ data: {} })));
	expect(
		click(new AnchorStub('mailto:speakerlp+288@christophholz.com')).preventDefault
	).not.toHaveBeenCalled();
	expect(
		click(new AnchorStub('mailto:presse@christophholz.com')).preventDefault
	).not.toHaveBeenCalled();
	expect(assign).not.toHaveBeenCalled();
	stop();
});
