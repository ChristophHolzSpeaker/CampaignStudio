export const SPEAKER_EMAIL = {
	domain: 'christophholz.com',
	primary: 'speaker@christophholz.com',
	campaignStudio: 'speakerlp@christophholz.com',
	webflow: 'speakerwp@christophholz.com',
	crm: 'speakercr@christophholz.com'
} as const;

export const MANAGED_SPEAKER_SENDERS = [
	SPEAKER_EMAIL.primary,
	SPEAKER_EMAIL.campaignStudio,
	SPEAKER_EMAIL.webflow,
	SPEAKER_EMAIL.crm
] as const;

export const AUTORESPONSE_SPEAKER_SENDERS = [
	SPEAKER_EMAIL.campaignStudio,
	SPEAKER_EMAIL.webflow,
	SPEAKER_EMAIL.primary
] as const;
