import { describe, expect, it } from 'vitest';
import { formatTelegramNotification } from './format';

describe('formatTelegramNotification', () => {
	it('formats new lead notifications with campaign context', () => {
		const message = formatTelegramNotification({
			type: 'new_lead',
			lead_journey_id: '97de6934-e5a2-4bd0-b93b-1e9a6f0b1c2d',
			attendee_name: 'Lead User',
			attendee_email: 'lead@example.com',
			meeting_scope: 'Discuss campaign goals',
			campaign_context: {
				campaign_id: 42,
				campaign_page_id: 7,
				page_slug: 'speaker-landing'
			}
		});

		expect(message).toContain('[NEW LEAD]');
		expect(message).toContain('Email: lead@example.com');
		expect(message).toContain('Campaign ID: 42');
	});

	it('formats booking confirmed notifications with time range', () => {
		const message = formatTelegramNotification({
			type: 'booking_confirmed',
			booking_id: '3fdb8e65-2ed6-4f56-a6d7-d749ccdc4690',
			booking_type: 'lead',
			attendee_name: 'Lead User',
			attendee_email: 'lead@example.com',
			meeting_scope: 'Discuss launch strategy',
			booking_time: {
				starts_at_iso: '2026-06-10T10:00:00.000Z',
				ends_at_iso: '2026-06-10T10:30:00.000Z'
			}
		});

		expect(message).toContain('[BOOKING CONFIRMED]');
		expect(message).toContain('Booking ID: 3fdb8e65-2ed6-4f56-a6d7-d749ccdc4690');
		expect(message).toContain(
			'Confirmed time: 2026-06-10T10:00:00.000Z -> 2026-06-10T10:30:00.000Z'
		);
	});

	it('formats booking rescheduled notifications with old/new times', () => {
		const message = formatTelegramNotification({
			type: 'booking_rescheduled',
			booking_id: '3fdb8e65-2ed6-4f56-a6d7-d749ccdc4690',
			booking_type: 'general',
			attendee_email: 'person@example.com',
			previous_booking_time: {
				starts_at_iso: '2026-06-10T10:00:00.000Z',
				ends_at_iso: '2026-06-10T10:30:00.000Z'
			},
			new_booking_time: {
				starts_at_iso: '2026-06-11T13:00:00.000Z',
				ends_at_iso: '2026-06-11T13:30:00.000Z'
			}
		});

		expect(message).toContain('[BOOKING RESCHEDULED]');
		expect(message).toContain('Old time: 2026-06-10T10:00:00.000Z -> 2026-06-10T10:30:00.000Z');
		expect(message).toContain('New time: 2026-06-11T13:00:00.000Z -> 2026-06-11T13:30:00.000Z');
	});
});
