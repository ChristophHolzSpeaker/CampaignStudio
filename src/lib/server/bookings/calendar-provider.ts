import type { CalendarBusyIntervalRequest, CalendarBusyIntervalResponse } from './contracts';
import type {
	CreateBookingCalendarEventRequest,
	CreateBookingCalendarEventResponse
} from '../../../../shared/booking-calendar';
import {
	createBookingCalendarEventViaWorker,
	fetchBookingCalendarBusyViaWorker
} from './worker-calendar-client';

export interface BookingCalendarAvailabilityProvider {
	fetchBusyIntervals(request: CalendarBusyIntervalRequest): Promise<CalendarBusyIntervalResponse>;
}

export interface BookingCalendarEventProvider {
	createBookingEvent(
		request: CreateBookingCalendarEventRequest
	): Promise<CreateBookingCalendarEventResponse>;
}

export class NoopCalendarAvailabilityProvider implements BookingCalendarAvailabilityProvider {
	readonly providerName = 'noop-calendar-provider';

	async fetchBusyIntervals(
		_request: CalendarBusyIntervalRequest
	): Promise<CalendarBusyIntervalResponse> {
		return {
			providerName: this.providerName,
			intervals: []
		};
	}
}

export class WorkerCalendarAvailabilityProvider implements BookingCalendarAvailabilityProvider {
	readonly providerName = 'worker-calendar-provider';

	async fetchBusyIntervals(
		request: CalendarBusyIntervalRequest
	): Promise<CalendarBusyIntervalResponse> {
		try {
			const response = await fetchBookingCalendarBusyViaWorker({
				range_starts_at_iso: request.rangeStartsAt.toISOString(),
				range_ends_at_iso: request.rangeEndsAt.toISOString(),
				calendar_id: request.calendarId
			});

			return {
				providerName: response.provider_name,
				intervals: response.intervals.map((interval) => ({
					startsAt: new Date(interval.starts_at_iso),
					endsAt: new Date(interval.ends_at_iso),
					source: interval.source
				}))
			};
		} catch (error) {
			console.error('worker_calendar_busy_fetch_failed', {
				error: error instanceof Error ? error.message : 'unknown_error'
			});

			return {
				providerName: this.providerName,
				intervals: []
			};
		}
	}
}

export class WorkerBookingCalendarEventProvider implements BookingCalendarEventProvider {
	async createBookingEvent(
		request: CreateBookingCalendarEventRequest
	): Promise<CreateBookingCalendarEventResponse> {
		return createBookingCalendarEventViaWorker(request);
	}
}
