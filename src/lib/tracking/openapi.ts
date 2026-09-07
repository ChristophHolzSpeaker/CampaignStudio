import { z } from 'zod';
import { trackingConfigSchema, outcomeSchema } from './contract';
const security = [{ bearerAuth: [] }];
const parameters = [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }];
const response = {
	description:
		'JSON response with ok and data; see /llms-full.txt for delivery states and pagination.'
};
export const trackingApiPaths = {
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
				content: { 'application/json': { schema: z.toJSONSchema(outcomeSchema) } }
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
