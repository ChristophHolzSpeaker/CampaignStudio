import type {
	BookingConfirmedTelegramNotification,
	BookingRescheduledTelegramNotification,
	NewLeadTelegramNotification,
	TelegramNotificationResponse
} from '../../../../shared/telegram-notifications';
import { sendTelegramNotificationViaWorker } from './telegram-worker-client';

export async function notifyNewLead(
	input: Omit<NewLeadTelegramNotification, 'type'>
): Promise<TelegramNotificationResponse> {
	return sendTelegramNotificationViaWorker({
		type: 'new_lead',
		...input
	});
}

export async function notifyBookingConfirmed(
	input: Omit<BookingConfirmedTelegramNotification, 'type'>
): Promise<TelegramNotificationResponse> {
	return sendTelegramNotificationViaWorker({
		type: 'booking_confirmed',
		...input
	});
}

export async function notifyBookingRescheduled(
	input: Omit<BookingRescheduledTelegramNotification, 'type'>
): Promise<TelegramNotificationResponse> {
	return sendTelegramNotificationViaWorker({
		type: 'booking_rescheduled',
		...input
	});
}
