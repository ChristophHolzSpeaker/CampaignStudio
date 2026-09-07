import { z } from 'zod';
export const identifier = z.string().regex(/^[a-z][a-zA-Z0-9_-]{0,63}$/);
export const eventName = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);
export const measurementSchema = z
	.object({
		id: z.uuid(),
		name: eventName,
		action: identifier.optional(),
		section: identifier.optional(),
		metric: z.number().finite().min(0).max(86400000).optional()
	})
	.strict();
export const mappingSchema = z
	.object({
		event: eventName,
		action: identifier.optional(),
		channel: z.enum(['browser', 'offline']),
		conversionId: z
			.string()
			.regex(/^AW-[0-9]+$/)
			.optional(),
		conversionLabel: z
			.string()
			.regex(/^[A-Za-zA-Z0-9_-]{1,100}$/)
			.optional(),
		customerId: z
			.string()
			.regex(/^[0-9]{10}$/)
			.optional(),
		conversionActionId: z
			.string()
			.regex(/^[0-9]+$/)
			.optional(),
		value: z.number().finite().nonnegative().optional(),
		currency: z
			.string()
			.regex(/^[A-Z]{3}$/)
			.optional()
	})
	.strict()
	.superRefine((m, ctx) => {
		if (m.channel === 'browser' && (!m.conversionId || !m.conversionLabel))
			ctx.addIssue({
				code: 'custom',
				message: 'Browser mappings require conversionId and conversionLabel'
			});
		if (m.channel === 'offline' && (!m.customerId || !m.conversionActionId))
			ctx.addIssue({
				code: 'custom',
				message: 'Offline mappings require customerId and conversionActionId'
			});
		if ((m.value !== undefined) !== (m.currency !== undefined))
			ctx.addIssue({ code: 'custom', message: 'Provide value and currency together' });
	});
export const trackingConfigSchema = z
	.object({
		gtmContainerId: z
			.string()
			.regex(/^GTM-[A-Z0-9]+$/)
			.nullable()
			.default(null),
		mappings: z.array(mappingSchema).max(200).default([])
	})
	.strict()
	.superRefine((c, ctx) => {
		const keys = c.mappings.map((m) => `${m.channel}:${m.event}:${m.action ?? ''}`);
		if (new Set(keys).size !== keys.length)
			ctx.addIssue({ code: 'custom', message: 'Duplicate event/action/channel mapping' });
	});
export type TrackingConfig = z.infer<typeof trackingConfigSchema>;
export function findMapping(
	config: TrackingConfig,
	channel: 'browser' | 'offline',
	name: string,
	action?: string
) {
	return (
		config.mappings.find((m) => m.channel === channel && m.event === name && m.action === action) ??
		config.mappings.find((m) => m.channel === channel && m.event === name && !m.action)
	);
}
export const outcomeSchema = z
	.object({
		externalEventId: z.string().regex(/^[A-Za-z0-9_.:-]{1,120}$/),
		name: eventName,
		action: identifier.optional(),
		occurredAt: z.iso.datetime({ offset: true }),
		value: z.number().finite().nonnegative().optional(),
		currency: z
			.string()
			.regex(/^[A-Z]{3}$/)
			.optional(),
		adUserDataConsent: z.enum(['GRANTED', 'DENIED'])
	})
	.strict()
	.superRefine((o, ctx) => {
		if (new Date(o.occurredAt).getTime() > Date.now() + 60000)
			ctx.addIssue({ code: 'custom', message: 'Outcome cannot be in the future' });
		if ((o.value !== undefined) !== (o.currency !== undefined))
			ctx.addIssue({ code: 'custom', message: 'Provide value and currency together' });
	});
