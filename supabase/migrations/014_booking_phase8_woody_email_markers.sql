-- Booking module MVP phase 8: woody email delivery sent markers

alter table lead_journeys
add column booking_link_invite_email_sent_at timestamp;

alter table lead_journeys
add column booking_link_invite_email_provider_message_id text;

alter table bookings
add column booking_confirmation_email_sent_at timestamp;

alter table bookings
add column booking_confirmation_email_provider_message_id text;
