-- Booking module MVP phase 4: confirmation lifecycle and calendar sync state

alter type booking_status add value if not exists 'pending_calendar_sync';
alter type booking_status add value if not exists 'calendar_sync_failed';

alter table bookings
add column if not exists calendar_sync_error text;
