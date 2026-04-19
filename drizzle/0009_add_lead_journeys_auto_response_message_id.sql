-- Link journey to the one allowed autoresponse message

alter table lead_journeys
add column auto_response_message_id uuid;

alter table lead_journeys
add constraint lead_journeys_auto_response_message_id_lead_messages_id_fk
foreign key (auto_response_message_id) references lead_messages(id) on delete set null;
