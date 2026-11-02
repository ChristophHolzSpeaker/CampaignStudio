import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ purge: vi.fn(), reconcile: vi.fn(), process: vi.fn() }));
vi.mock('$env/dynamic/private', () => ({ env: { CRON_SECRET: 'test-secret' } }));
vi.mock('$lib/server/tracking/form-consent-evidence', () => ({
	purgeExpiredFormConsentEvidence: mocks.purge
}));
vi.mock('$lib/server/tracking/native-outcomes', () => ({
	reconcileNativeOutcomes: mocks.reconcile
}));
vi.mock('$lib/server/tracking/outcomes', () => ({ processConversions: mocks.process }));
import { GET } from './+server';
function call(token?: string) {
	return GET({
		request: new Request('https://example.com/api/internal/conversions/process', {
			headers: token ? { authorization: `Bearer ${token}` } : {}
		})
	} as never);
}
beforeEach(() => {
	vi.resetAllMocks();
	mocks.purge.mockResolvedValue(undefined);
	mocks.reconcile.mockResolvedValue({ recorded: 0 });
	mocks.process.mockResolvedValue({ processed: 0 });
});
it('never runs cleanup or conversion processing without authorization', async () => {
	expect((await call()).status).toBe(401);
	expect(mocks.purge).not.toHaveBeenCalled();
	expect(mocks.process).not.toHaveBeenCalled();
});
it('continues conversion processing if evidence cleanup fails', async () => {
	mocks.purge.mockRejectedValue(new Error('unavailable'));
	const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
	expect((await call('test-secret')).status).toBe(200);
	expect(mocks.reconcile).toHaveBeenCalledOnce();
	expect(mocks.process).toHaveBeenCalledOnce();
	log.mockRestore();
});
