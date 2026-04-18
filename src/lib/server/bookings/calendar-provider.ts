import type { CalendarBusyIntervalRequest, CalendarBusyIntervalResponse } from './contracts';
import type {
	CreateBookingCalendarEventRequest,
	CreateBookingCalendarEventResponse
} from '../../../../shared/booking-calendar';
import { createBookingCalendarEventViaWorker } from './worker-calendar-client';

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

export class WorkerBookingCalendarEventProvider implements BookingCalendarEventProvider {
	async createBookingEvent(
		request: CreateBookingCalendarEventRequest
	): Promise<CreateBookingCalendarEventResponse> {
		return createBookingCalendarEventViaWorker(request);
	}
}
