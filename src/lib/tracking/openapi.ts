import { z } from 'zod';
import { trackingConfigSchema, outcomeSchema, visitConsentSchema } from './contract';
const security = [{ bearerAuth: [] }];
const parameters = [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }];
const response = {
	description:
		'JSON response with ok and data; see /llms-full.txt for delivery states and pagination.'
};
const visitParameters = [
	{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }
];
const visitReadinessResponse = {
	description:
		'Exact visit attribution and local delivery readiness; not a guarantee of Google matching. Raw click identifiers are omitted.',
	content: {
		'application/json': {
			schema: {
				type: 'object',
				properties: {
					ok: { const: true },
					data: {
						type: 'object',
						properties: {
							visitId: { type: 'integer' },
							campaignId: { type: 'integer' },
							clicks: {
								type: 'array',
								items: {
									type: 'object',
									properties: {
										kind: { type: 'string', enum: ['gclid', 'gbraid', 'wbraid'] },
										capturedAt: { type: 'string', format: 'date-time' }
									}
								}
							},
							consent: {
								type: 'object',
								properties: {
									adUserDataConsent: { type: 'string', enum: ['GRANTED', 'DENIED', 'UNKNOWN'] },
									source: { type: 'string', enum: ['owner_default', 'visitor_record'] },
									recordedAt: { type: ['string', 'null'], format: 'date-time' },
									policyVersion: { type: ['string', 'null'] }
								}
							},
							readiness: {
								type: 'object',
								properties: {
									ready: { type: 'boolean' },
									reasons: { type: 'array', items: { type: 'string' } },
									name: { type: 'string' },
									action: { type: ['string', 'null'] },
									checkedAt: { type: 'string', format: 'date-time' }
								}
							},
							deliveries: {
								type: 'array',
								items: {
									type: 'object',
									properties: {
										id: { type: 'string', format: 'uuid' },
										eventId: { type: 'string', format: 'uuid' },
										name: { type: 'string' },
										action: { type: ['string', 'null'] },
										status: {
											type: 'string',
											enum: ['pending', 'processing', 'accepted', 'delivered', 'failed', 'blocked']
										},
										lastError: { type: ['string', 'null'] },
										googleRequestId: { type: ['string', 'null'] }
									}
								}
							},
							deliveriesTruncated: { type: 'boolean' }
						}
					}
				}
			}
		}
	}
};
export const trackingApiPaths = {
	'/api/public/v1/campaign-visits/{id}/tracking': {
		get: {
			operationId: 'getVisitTracking',
			summary:
				'Read exact-visit click metadata, recorded consent, deliveries and readiness (lead-read token)',
			security,
			parameters: [
				...visitParameters,
				{ name: 'name', in: 'query', schema: { type: 'string', default: 'company_identified' } },
				{ name: 'action', in: 'query', schema: { type: 'string' } },
				{ name: 'occurredAt', in: 'query', schema: { type: 'string', format: 'date-time' } }
			],
			responses: {
				'200': visitReadinessResponse,
				'400': { description: 'Invalid visit ID or query' },
				'404': { description: 'Visit not found' }
			}
		}
	},
	'/api/public/v1/campaign-visits/{id}/outcomes': {
		post: {
			operationId: 'recordVisitOutcome',
			summary: 'Record an explicit visit outcome without creating a lead journey (crm-write token)',
			security,
			parameters: visitParameters,
			requestBody: {
				required: true,
				content: { 'application/json': { schema: z.toJSONSchema(outcomeSchema, { io: 'input' }) } }
			},
			responses: {
				'202': response,
				'400': { description: 'Invalid outcome' },
				'404': { description: 'Visit not found' },
				'409': { description: 'Event ID reused with a different body' },
				'422': {
					description:
						'Visit not ready; reasons[] explains prerequisites. No outcome or event ID is consumed.'
				},
				'503': { description: 'CRM write authentication is not configured' }
			}
		}
	},
	'/api/runtime/v1/consent': {
		post: {
			operationId: 'recordVisitorAdvertisingConsent',
			summary:
				'Record an explicit visitor decision from a platform-managed consent integration; owning cs_vid cookie and same Origin required, not CRM bearer authentication',
			security: [],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: z.toJSONSchema(
							visitConsentSchema.extend({
								visitId: z.number().int().positive(),
								campaignPageId: z.number().int().positive()
							})
						)
					}
				}
			},
			responses: {
				'200': response,
				'400': { description: 'Invalid consent record or missing visitor cookie' },
				'403': { description: 'Cross-origin request' },
				'404': { description: 'Published page or owned visit not found' },
				'429': { description: 'Rate limit exceeded' }
			}
		}
	},
	'/api/public/v1/conversion-deliveries/{id}': {
		get: {
			operationId: 'getConversionDelivery',
			summary: 'Read delivery status (lead-read token)',
			security,
			parameters,
			responses: { '200': response, '404': { description: 'Delivery not found' } }
		},
		post: {
			operationId: 'retryConversionDelivery',
			summary: 'Retry failed delivery without changing its snapshot (crm-write token)',
			security,
			parameters,
			responses: { '202': response, '409': { description: 'Delivery is not failed' } }
		}
	},
	'/api/public/v1/campaigns/{id}/tracking/events': {
		get: {
			operationId: 'getCampaignMeasurements',
			summary: 'Read all campaign measurements including anonymous activity (lead-read token)',
			security,
			parameters: [
				...parameters,
				{ name: 'cursor', in: 'query', schema: { type: 'string' } },
				{ name: 'limit', in: 'query', schema: { type: 'integer', maximum: 200 } }
			],
			responses: { '200': response }
		}
	},
	'/api/public/v1/campaigns/{id}/tracking': {
		get: {
			operationId: 'getCampaignTracking',
			summary: 'Read campaign tracking config (campaign-write token)',
			security,
			parameters,
			responses: { '200': response }
		},
		put: {
			operationId: 'replaceCampaignTracking',
			summary:
				'Replace campaign tracking config (campaign-write token); read and preserve unrelated mappings',
			security,
			parameters,
			requestBody: {
				required: true,
				content: { 'application/json': { schema: z.toJSONSchema(trackingConfigSchema) } }
			},
			responses: {
				'200': response,
				'400': { description: 'Invalid or duplicate mapping' },
				'404': { description: 'Campaign not found' }
			}
		}
	},
	'/api/public/v1/lead-journeys/{id}/outcomes': {
		post: {
			operationId: 'recordCrmOutcome',
			summary: 'Record idempotent CRM outcome (CRM_WRITE_API_TOKEN); 202 is not Google delivery',
			security,
			parameters,
			requestBody: {
				required: true,
				content: { 'application/json': { schema: z.toJSONSchema(outcomeSchema, { io: 'input' }) } }
			},
			responses: {
				'202': response,
				'400': { description: 'Invalid outcome' },
				'404': { description: 'Journey not found' },
				'409': { description: 'External event ID already used with different payload' },
				'422': { description: 'No offline mapping; configure and retry' }
			}
		}
	},
	'/api/public/v1/lead-journeys/{id}/tracking': {
		get: {
			operationId: 'getJourneyTracking',
			summary: 'Private click history, measurements and delivery states (lead-read token)',
			security,
			parameters: [
				...parameters,
				{
					name: 'limit',
					in: 'query',
					schema: { type: 'integer', minimum: 1, maximum: 200, default: 100 }
				},
				{ name: 'cursor', in: 'query', schema: { type: 'string' } }
			],
			responses: { '200': response, '404': { description: 'Journey not found' } }
		}
	}
};
