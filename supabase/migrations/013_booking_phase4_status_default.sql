-- Booking module MVP phase 4: status default update

alter table bookings
alter column status set default 'pending_calendar_sync';
