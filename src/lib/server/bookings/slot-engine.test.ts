import { describe, expect, it } from 'vitest';
import type { BookingPolicyResult, BookingRulesSnapshot } from './contracts';
import { evaluateBookingAvailability, generateBookingSlots } from './slot-engine';

function makeRules(overrides?: Partial<BookingRulesSnapshot>): BookingRulesSnapshot {
	return {
		bookingType: 'lead',
		advanceNoticeMinutes: 0,
		slotDurationMinutes: 30,
		slotIntervalMinutes: 30,
		isEnabled: true,
		ruleRowId: 'rule_1',
		updatedAt: new Date('2026-04-17T00:00:00.000Z'),
		...overrides
	};
}

function makeActivePolicy(rules?: BookingRulesSnapshot): BookingPolicyResult {
	return {
		state: 'active',
		bookingType: 'lead',
		pause: {
			isPaused: false,
			pauseMessage: null,
			settingsRowId: null,
			updatedAt: null
		},
		rules: rules ?? makeRules()
	};
}

describe('generateBookingSlots', () => {
	it('returns invalid_window when end is before start', () => {
		const result = generateBookingSlots({
			bookingType: 'lead',
			searchStartsAt: new Date('2026-05-01T11:00:00.000Z'),
			searchEndsAt: new Date('2026-05-01T10:00:00.000Z'),
			rules: makeRules(),
			busyIntervals: []
		});

		expect(result.state).toBe('invalid_window');
		expect(result.slots).toEqual([]);
	});

	it('applies advance notice and rounds up to interval', () => {
		const result = generateBookingSlots({
			bookingType: 'lead',
			searchStartsAt: new Date('2026-05-01T10:00:00.000Z'),
			searchEndsAt: new Date('2026-05-01T11:30:00.000Z'),
			rules: makeRules({
				advanceNoticeMinutes: 15,
				slotIntervalMinutes: 30,
				slotDurationMinutes: 30
			}),
			busyIntervals: [],
			now: new Date('2026-05-01T10:05:00.000Z')
		});

		expect(result.state).toBe('slots_available');
		expect(result.slots.map((slot) => slot.startsAt.toISOString())).toEqual([
			'2026-05-01T10:30:00.000Z',
			'2026-05-01T11:00:00.000Z'
		]);
	});

	it('filters slots that overlap busy intervals', () => {
		const result = generateBookingSlots({
			bookingType: 'lead',
			searchStartsAt: new Date('2026-05-01T10:00:00.000Z'),
			searchEndsAt: new Date('2026-05-01T11:30:00.000Z'),
			rules: makeRules(),
			busyIntervals: [
				{
					startsAt: new Date('2026-05-01T10:30:00.000Z'),
					endsAt: new Date('2026-05-01T11:00:00.000Z'),
					source: 'calendar'
				}
			]
		});

		expect(result.state).toBe('slots_available');
		expect(result.slots.map((slot) => slot.startsAt.toISOString())).toEqual([
			'2026-05-01T10:00:00.000Z',
			'2026-05-01T11:00:00.000Z'
		]);
	});
});

describe('evaluateBookingAvailability', () => {
	it('returns bookings_paused for globally paused policy', () => {
		const result = evaluateBookingAvailability({
			policy: {
				state: 'globally_paused',
				bookingType: 'lead',
				pause: {
					isPaused: true,
					pauseMessage: 'Paused by admin',
					settingsRowId: 'settings_1',
					updatedAt: new Date('2026-04-17T00:00:00.000Z')
				},
				rules: makeRules()
			},
			searchStartsAt: new Date('2026-05-01T10:00:00.000Z'),
			searchEndsAt: new Date('2026-05-01T12:00:00.000Z'),
			busyIntervals: []
		});

		expect(result.state).toBe('bookings_paused');
		expect(result.reason).toBe('Paused by admin');
	});

	it('returns no_slots when active policy has full conflicts', () => {
		const result = evaluateBookingAvailability({
			policy: makeActivePolicy(makeRules({ slotDurationMinutes: 60, slotIntervalMinutes: 60 })),
			searchStartsAt: new Date('2026-05-01T10:00:00.000Z'),
			searchEndsAt: new Date('2026-05-01T12:00:00.000Z'),
			busyIntervals: [
				{
					startsAt: new Date('2026-05-01T10:00:00.000Z'),
					endsAt: new Date('2026-05-01T12:00:00.000Z'),
					source: 'calendar'
				}
			]
		});

		expect(result.state).toBe('no_slots');
		expect(result.slots).toEqual([]);
	});
});
