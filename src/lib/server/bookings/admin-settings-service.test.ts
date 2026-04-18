import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./repository', () => ({
	getBookingRulesByType: vi.fn(),
	getGlobalBookingSettings: vi.fn(),
	upsertBookingRulesByType: vi.fn(),
	upsertGlobalBookingSettings: vi.fn()
}));

import {
	getBookingRulesByType,
	getGlobalBookingSettings,
	upsertBookingRulesByType,
	upsertGlobalBookingSettings
} from './repository';
import {
	getBookingAdminSettings,
	saveBookingTypeRules,
	saveGlobalBookingPauseState
} from './admin-settings-service';

const mockedGetBookingRulesByType = vi.mocked(getBookingRulesByType);
const mockedGetGlobalBookingSettings = vi.mocked(getGlobalBookingSettings);
const mockedUpsertBookingRulesByType = vi.mocked(upsertBookingRulesByType);
const mockedUpsertGlobalBookingSettings = vi.mocked(upsertGlobalBookingSettings);

describe('booking admin settings service', () => {
	beforeEach(() => {
		mockedGetBookingRulesByType.mockReset();
		mockedGetGlobalBookingSettings.mockReset();
		mockedUpsertBookingRulesByType.mockReset();
		mockedUpsertGlobalBookingSettings.mockReset();
	});

	it('loads existing booking rules and pause settings', async () => {
		mockedGetBookingRulesByType
			.mockResolvedValueOnce({
				id: 'rule-lead',
				booking_type: 'lead',
				advance_notice_minutes: 120,
				slot_duration_minutes: 45,
				slot_interval_minutes: 15,
				is_enabled: true,
				created_at: new Date('2026-04-10T00:00:00.000Z'),
				updated_at: new Date('2026-04-11T00:00:00.000Z')
			})
			.mockResolvedValueOnce({
				id: 'rule-general',
				booking_type: 'general',
				advance_notice_minutes: 60,
				slot_duration_minutes: 30,
				slot_interval_minutes: 30,
				is_enabled: false,
				created_at: new Date('2026-04-10T00:00:00.000Z'),
				updated_at: new Date('2026-04-12T00:00:00.000Z')
			});
		mockedGetGlobalBookingSettings.mockResolvedValueOnce({
			id: 'settings-1',
			is_paused: true,
			pause_message: 'Paused for event travel',
			created_at: new Date('2026-04-10T00:00:00.000Z'),
			updated_at: new Date('2026-04-13T00:00:00.000Z')
		});

		const result = await getBookingAdminSettings();

		expect(result.rules.lead?.advanceNoticeMinutes).toBe(120);
		expect(result.rules.general?.isEnabled).toBe(false);
		expect(result.pause.isPaused).toBe(true);
		expect(result.pause.pauseMessage).toBe('Paused for event travel');
	});

	it('updates lead rules successfully', async () => {
		mockedUpsertBookingRulesByType.mockResolvedValueOnce({
			id: 'rule-lead',
			booking_type: 'lead',
			advance_notice_minutes: 30,
			slot_duration_minutes: 30,
			slot_interval_minutes: 15,
			is_enabled: true,
			created_at: new Date('2026-04-10T00:00:00.000Z'),
			updated_at: new Date('2026-04-14T00:00:00.000Z')
		});

		const updated = await saveBookingTypeRules({
			bookingType: 'lead',
			advanceNoticeMinutes: 30,
			slotDurationMinutes: 30,
			slotIntervalMinutes: 15,
			isEnabled: true
		});

		expect(mockedUpsertBookingRulesByType).toHaveBeenCalledWith({
			bookingType: 'lead',
			advanceNoticeMinutes: 30,
			slotDurationMinutes: 30,
			slotIntervalMinutes: 15,
			isEnabled: true
		});
		expect(updated.bookingType).toBe('lead');
		expect(updated.slotIntervalMinutes).toBe(15);
	});

	it('updates general rules successfully', async () => {
		mockedUpsertBookingRulesByType.mockResolvedValueOnce({
			id: 'rule-general',
			booking_type: 'general',
			advance_notice_minutes: 10,
			slot_duration_minutes: 20,
			slot_interval_minutes: 10,
			is_enabled: false,
			created_at: new Date('2026-04-10T00:00:00.000Z'),
			updated_at: new Date('2026-04-14T00:00:00.000Z')
		});

		const updated = await saveBookingTypeRules({
			bookingType: 'general',
			advanceNoticeMinutes: 10,
			slotDurationMinutes: 20,
			slotIntervalMinutes: 10,
			isEnabled: false
		});

		expect(updated.bookingType).toBe('general');
		expect(updated.isEnabled).toBe(false);
	});

	it('updates pause state successfully', async () => {
		mockedUpsertGlobalBookingSettings.mockResolvedValueOnce({
			id: 'settings-2',
			is_paused: true,
			pause_message: 'Maintenance in progress',
			created_at: new Date('2026-04-10T00:00:00.000Z'),
			updated_at: new Date('2026-04-15T00:00:00.000Z')
		});

		const updated = await saveGlobalBookingPauseState({
			isPaused: true,
			pauseMessage: 'Maintenance in progress'
		});

		expect(mockedUpsertGlobalBookingSettings).toHaveBeenCalledWith({
			isPaused: true,
			pauseMessage: 'Maintenance in progress'
		});
		expect(updated.isPaused).toBe(true);
		expect(updated.pauseMessage).toBe('Maintenance in progress');
	});
});
