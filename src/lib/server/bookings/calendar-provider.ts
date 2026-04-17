import type { CalendarBusyIntervalRequest, CalendarBusyIntervalResponse } from './contracts';

export interface BookingCalendarAvailabilityProvider {
	fetchBusyIntervals(request: CalendarBusyIntervalRequest): Promise<CalendarBusyIntervalResponse>;
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
