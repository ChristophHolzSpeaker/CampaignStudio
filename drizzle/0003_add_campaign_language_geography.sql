-- Add language and geography columns to campaigns
alter table campaigns add column language text not null default '';
alter table campaigns add column geography text not null default '';
alter table campaigns alter column language drop default;
alter table campaigns alter column geography drop default;
