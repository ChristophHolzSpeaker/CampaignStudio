import type {
	BookingConfirmedWoodyEmailRequest,
	BookingLinkInviteWoodyEmailRequest,
	WoodyEmailNotificationResponse
} from '../../../../shared/woody-email-notifications';
import { sendWoodyEmailNotificationViaWorker } from './woody-email-worker-client';

export async function sendBookingLinkInviteWoodyEmail(
	input: BookingLinkInviteWoodyEmailRequest
): Promise<WoodyEmailNotificationResponse> {
	return sendWoodyEmailNotificationViaWorker(input);
}

export async function sendBookingConfirmedWoodyEmail(
	input: BookingConfirmedWoodyEmailRequest
): Promise<WoodyEmailNotificationResponse> {
	return sendWoodyEmailNotificationViaWorker(input);
}
