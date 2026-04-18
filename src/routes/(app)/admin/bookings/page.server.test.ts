import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/bookings', () => ({
	getBookingAdminSettings: vi.fn(),
	saveBookingTypeRules: vi.fn(),
	saveGlobalBookingPauseState: vi.fn()
}));

import {
	getBookingAdminSettings,
	saveBookingTypeRules,
	saveGlobalBookingPauseState
} from '$lib/server/bookings';
import { actions, load } from './+page.server';

const mockedGetBookingAdminSettings = vi.mocked(getBookingAdminSettings);
const mockedSaveBookingTypeRules = vi.mocked(saveBookingTypeRules);
const mockedSaveGlobalBookingPauseState = vi.mocked(saveGlobalBookingPauseState);

describe('/admin/bookings +page.server', () => {
	beforeEach(() => {
		mockedGetBookingAdminSettings.mockReset();
		mockedSaveBookingTypeRules.mockReset();
		mockedSaveGlobalBookingPauseState.mockReset();
	});

	it('loads existing booking settings', async () => {
		mockedGetBookingAdminSettings.mockResolvedValueOnce({
			rules: {
				lead: {
					bookingType: 'lead',
					advanceNoticeMinutes: 60,
					slotDurationMinutes: 30,
					slotIntervalMinutes: 15,
					isEnabled: true,
					ruleRowId: 'rule-lead',
					updatedAt: new Date('2026-04-15T00:00:00.000Z')
				},
				general: {
					bookingType: 'general',
					advanceNoticeMinutes: 120,
					slotDurationMinutes: 30,
					slotIntervalMinutes: 30,
					isEnabled: false,
					ruleRowId: 'rule-general',
					updatedAt: new Date('2026-04-15T00:00:00.000Z')
				}
			},
			pause: {
				isPaused: false,
				pauseMessage: null,
				settingsRowId: 'settings-1',
				updatedAt: new Date('2026-04-15T00:00:00.000Z')
			}
		});

		const result = (await load({} as never)) as any;

		expect(result.rules.lead.advanceNoticeMinutes).toBe(60);
		expect(result.rules.general.isEnabled).toBe(false);
		expect(result.pause.isPaused).toBe(false);
	});

	it('updates lead rules successfully', async () => {
		mockedSaveBookingTypeRules.mockResolvedValueOnce({
			bookingType: 'lead',
			advanceNoticeMinutes: 30,
			slotDurationMinutes: 30,
			slotIntervalMinutes: 15,
			isEnabled: true,
			ruleRowId: 'rule-lead',
			updatedAt: new Date('2026-04-16T00:00:00.000Z')
		});

		const formData = new FormData();
		formData.set('booking_type', 'lead');
		formData.set('advance_notice_minutes', '30');
		formData.set('slot_duration_minutes', '30');
		formData.set('slot_interval_minutes', '15');
		formData.set('is_enabled', 'on');

		const response = (await actions.updateRules({
			request: new Request('http://test.local/admin/bookings', { method: 'POST', body: formData })
		} as never)) as any;

		expect(mockedSaveBookingTypeRules).toHaveBeenCalledWith({
			bookingType: 'lead',
			advanceNoticeMinutes: 30,
			slotDurationMinutes: 30,
			slotIntervalMinutes: 15,
			isEnabled: true
		});
		expect(response.rulesForm.success).toBe(true);
	});

	it('updates general rules successfully', async () => {
		mockedSaveBookingTypeRules.mockResolvedValueOnce({
			bookingType: 'general',
			advanceNoticeMinutes: 45,
			slotDurationMinutes: 45,
			slotIntervalMinutes: 15,
			isEnabled: false,
			ruleRowId: 'rule-general',
			updatedAt: new Date('2026-04-16T00:00:00.000Z')
		});

		const formData = new FormData();
		formData.set('booking_type', 'general');
		formData.set('advance_notice_minutes', '45');
		formData.set('slot_duration_minutes', '45');
		formData.set('slot_interval_minutes', '15');

		const response = (await actions.updateRules({
			request: new Request('http://test.local/admin/bookings', { method: 'POST', body: formData })
		} as never)) as any;

		expect(mockedSaveBookingTypeRules).toHaveBeenCalledWith({
			bookingType: 'general',
			advanceNoticeMinutes: 45,
			slotDurationMinutes: 45,
			slotIntervalMinutes: 15,
			isEnabled: false
		});
		expect(response.rulesForm.success).toBe(true);
	});

	it('updates pause state successfully', async () => {
		mockedSaveGlobalBookingPauseState.mockResolvedValueOnce({
			isPaused: true,
			pauseMessage: 'Temporarily unavailable',
			settingsRowId: 'settings-2',
			updatedAt: new Date('2026-04-16T00:00:00.000Z')
		});

		const formData = new FormData();
		formData.set('is_paused', 'on');
		formData.set('pause_message', 'Temporarily unavailable');

		const response = (await actions.updatePause({
			request: new Request('http://test.local/admin/bookings', { method: 'POST', body: formData })
		} as never)) as any;

		expect(mockedSaveGlobalBookingPauseState).toHaveBeenCalledWith({
			isPaused: true,
			pauseMessage: 'Temporarily unavailable'
		});
		expect(response.pauseForm.success).toBe(true);
	});

	it('returns validation errors for bad numeric rule inputs', async () => {
		const formData = new FormData();
		formData.set('booking_type', 'lead');
		formData.set('advance_notice_minutes', '-5');
		formData.set('slot_duration_minutes', '0');
		formData.set('slot_interval_minutes', '99');

		const response = (await actions.updateRules({
			request: new Request('http://test.local/admin/bookings', { method: 'POST', body: formData })
		} as never)) as any;

		expect(response.status).toBe(400);
		expect(response.data.rulesForm.errors?.advanceNoticeMinutes).toBeTruthy();
		expect(response.data.rulesForm.errors?.slotDurationMinutes).toBeTruthy();
		expect(response.data.rulesForm.errors?.slotIntervalMinutes).toBeTruthy();
		expect(mockedSaveBookingTypeRules).not.toHaveBeenCalled();
	});
});
