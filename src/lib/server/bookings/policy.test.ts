import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./repository', () => ({
	getBookingRulesByType: vi.fn(),
	getGlobalBookingSettings: vi.fn()
}));

import { getBookingRulesByType, getGlobalBookingSettings } from './repository';
import { getBookingPolicy, isBookingsGloballyPaused } from './policy';

const mockedGetBookingRulesByType = vi.mocked(getBookingRulesByType);
const mockedGetGlobalBookingSettings = vi.mocked(getGlobalBookingSettings);

describe('booking policy service', () => {
	beforeEach(() => {
		mockedGetBookingRulesByType.mockReset();
		mockedGetGlobalBookingSettings.mockReset();
	});

	it('returns rules_missing when rule row is absent', async () => {
		mockedGetGlobalBookingSettings.mockResolvedValueOnce(null);
		mockedGetBookingRulesByType.mockResolvedValueOnce(null);

		const result = await getBookingPolicy('lead');

		expect(result.state).toBe('rules_missing');
		if (result.state === 'rules_missing') {
			expect(result.pause.isPaused).toBe(false);
			expect(result.rules).toBeNull();
		}
	});

	it('returns globally_paused when global pause is enabled', async () => {
		mockedGetGlobalBookingSettings.mockResolvedValueOnce({
			id: 'settings-1',
			is_paused: true,
			pause_message: 'Maintenance window',
			created_at: new Date('2026-04-10T00:00:00.000Z'),
			updated_at: new Date('2026-04-17T00:00:00.000Z')
		});
		mockedGetBookingRulesByType.mockResolvedValueOnce({
			id: 'rule-1',
			booking_type: 'lead',
			advance_notice_minutes: 120,
			slot_duration_minutes: 30,
			slot_interval_minutes: 30,
			is_enabled: true,
			created_at: new Date('2026-04-10T00:00:00.000Z'),
			updated_at: new Date('2026-04-17T00:00:00.000Z')
		});

		const result = await getBookingPolicy('lead');

		expect(result.state).toBe('globally_paused');
		if (result.state === 'globally_paused') {
			expect(result.pause.pauseMessage).toBe('Maintenance window');
			expect(result.rules?.ruleRowId).toBe('rule-1');
		}
	});

	it('returns type_disabled when rule row exists but is disabled', async () => {
		mockedGetGlobalBookingSettings.mockResolvedValueOnce(null);
		mockedGetBookingRulesByType.mockResolvedValueOnce({
			id: 'rule-2',
			booking_type: 'general',
			advance_notice_minutes: 60,
			slot_duration_minutes: 45,
			slot_interval_minutes: 15,
			is_enabled: false,
			created_at: new Date('2026-04-10T00:00:00.000Z'),
			updated_at: new Date('2026-04-17T00:00:00.000Z')
		});

		const result = await getBookingPolicy('general');

		expect(result.state).toBe('type_disabled');
		if (result.state === 'type_disabled') {
			expect(result.rules.isEnabled).toBe(false);
			expect(result.rules.slotDurationMinutes).toBe(45);
		}
	});

	it('returns active with normalized snapshot when enabled', async () => {
		mockedGetGlobalBookingSettings.mockResolvedValueOnce({
			id: 'settings-2',
			is_paused: false,
			pause_message: null,
			created_at: new Date('2026-04-10T00:00:00.000Z'),
			updated_at: new Date('2026-04-11T00:00:00.000Z')
		});
		mockedGetBookingRulesByType.mockResolvedValueOnce({
			id: 'rule-3',
			booking_type: 'lead',
			advance_notice_minutes: 90,
			slot_duration_minutes: 30,
			slot_interval_minutes: 10,
			is_enabled: true,
			created_at: new Date('2026-04-10T00:00:00.000Z'),
			updated_at: new Date('2026-04-12T00:00:00.000Z')
		});

		const result = await getBookingPolicy('lead');

		expect(result.state).toBe('active');
		if (result.state === 'active') {
			expect(result.rules.advanceNoticeMinutes).toBe(90);
			expect(result.rules.slotIntervalMinutes).toBe(10);
		}
	});

	it('returns default non-paused state when settings row is missing', async () => {
		mockedGetGlobalBookingSettings.mockResolvedValueOnce(null);

		const pauseState = await isBookingsGloballyPaused();

		expect(pauseState).toEqual({
			isPaused: false,
			pauseMessage: null,
			settingsRowId: null,
			updatedAt: null
		});
	});
});
