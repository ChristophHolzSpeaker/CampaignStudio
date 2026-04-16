export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
export const GMAIL_MODIFY_SCOPE = 'https://www.googleapis.com/auth/gmail.modify';

export const CALENDAR_READONLY_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
export const CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

export const GMAIL_DEFAULT_SCOPES = [GMAIL_READONLY_SCOPE, GMAIL_SEND_SCOPE] as const;
export const CALENDAR_DEFAULT_SCOPES = [CALENDAR_READONLY_SCOPE, CALENDAR_EVENTS_SCOPE] as const;
