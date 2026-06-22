import { publicApiJson, requirePublicApiRequest } from '$lib/server/public-api/http';
import { eventSources, eventTypes } from '../../../../../../shared/event-types';
import type { RequestHandler } from './$types';

const security = [{ bearerAuth: [] }];

const errorResponse = {
	description: 'Error response',
	content: {
		'application/json': {
			schema: { $ref: '#/components/schemas/ErrorResponse' }
		}
	}
};

const openApiDocument = {
	openapi: '3.1.0',
	info: {
		title: 'CampaignStudio Lead Read API',
		version: '1.0.0',
		description:
			'Read-only API for trusted agents to inspect lead journeys, lead messages, and lead events. Responses may contain PII and full email bodies.'
	},
	paths: {
		'/api/public/v1/lead-journeys': {
			get: {
				summary: 'List lead journeys',
				security,
				parameters: [
					{ $ref: '#/components/parameters/Limit100' },
					{ name: 'campaign_id', in: 'query', schema: { type: 'integer', minimum: 1 } },
					{ name: 'stage', in: 'query', schema: { type: 'string' } },
					{ name: 'updated_after', in: 'query', schema: { type: 'string', format: 'date-time' } },
					{ name: 'updated_before', in: 'query', schema: { type: 'string', format: 'date-time' } }
				],
				responses: {
					'200': {
						description: 'Lead journeys',
						content: {
							'application/json': {
								schema: {
									type: 'object',
									required: ['ok', 'data', 'pagination'],
									properties: {
										ok: { type: 'boolean', const: true },
										data: { type: 'array', items: { $ref: '#/components/schemas/LeadJourney' } },
										pagination: { $ref: '#/components/schemas/Pagination' }
									}
								}
							}
						}
					},
					'401': errorResponse,
					'429': errorResponse
				}
			}
		},
		'/api/public/v1/lead-journeys/{id}': {
			get: {
				summary: 'Get a lead journey',
				security,
				parameters: [{ $ref: '#/components/parameters/JourneyId' }],
				responses: {
					'200': {
						description: 'Lead journey',
						content: {
							'application/json': {
								schema: {
									type: 'object',
									required: ['ok', 'data'],
									properties: {
										ok: { type: 'boolean', const: true },
										data: { $ref: '#/components/schemas/LeadJourney' }
									}
								}
							}
						}
					},
					'400': errorResponse,
					'401': errorResponse,
					'404': errorResponse,
					'429': errorResponse
				}
			}
		},
		'/api/public/v1/lead-journeys/{id}/messages': {
			get: {
				summary: 'List lead messages for a journey',
				description: 'Includes full bodyText and bodyHtml values.',
				security,
				parameters: [
					{ $ref: '#/components/parameters/JourneyId' },
					{ $ref: '#/components/parameters/Limit200' },
					{ name: 'direction', in: 'query', schema: { type: 'string' } },
					{ name: 'received_after', in: 'query', schema: { type: 'string', format: 'date-time' } },
					{ name: 'received_before', in: 'query', schema: { type: 'string', format: 'date-time' } }
				],
				responses: {
					'200': {
						description: 'Lead messages',
						content: {
							'application/json': {
								schema: {
									type: 'object',
									required: ['ok', 'data', 'pagination'],
									properties: {
										ok: { type: 'boolean', const: true },
										data: { type: 'array', items: { $ref: '#/components/schemas/LeadMessage' } },
										pagination: { $ref: '#/components/schemas/Pagination' }
									}
								}
							}
						}
					},
					'400': errorResponse,
					'401': errorResponse,
					'429': errorResponse
				}
			}
		},
		'/api/public/v1/lead-journeys/{id}/events': {
			get: {
				summary: 'List lead events for a journey',
				security,
				parameters: [
					{ $ref: '#/components/parameters/JourneyId' },
					{ $ref: '#/components/parameters/Limit200' },
					{ $ref: '#/components/parameters/EventType' },
					{ $ref: '#/components/parameters/EventSource' },
					{ name: 'occurred_after', in: 'query', schema: { type: 'string', format: 'date-time' } },
					{ name: 'occurred_before', in: 'query', schema: { type: 'string', format: 'date-time' } }
				],
				responses: {
					'200': {
						description: 'Lead events',
						content: {
							'application/json': {
								schema: {
									type: 'object',
									required: ['ok', 'data', 'pagination'],
									properties: {
										ok: { type: 'boolean', const: true },
										data: { type: 'array', items: { $ref: '#/components/schemas/LeadEvent' } },
										pagination: { $ref: '#/components/schemas/Pagination' }
									}
								}
							}
						}
					},
					'400': errorResponse,
					'401': errorResponse,
					'429': errorResponse
				}
			}
		}
	},
	components: {
		securitySchemes: {
			bearerAuth: { type: 'http', scheme: 'bearer' }
		},
		parameters: {
			JourneyId: {
				name: 'id',
				in: 'path',
				required: true,
				schema: { type: 'string', format: 'uuid' }
			},
			Limit100: {
				name: 'limit',
				in: 'query',
				schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 }
			},
			Limit200: {
				name: 'limit',
				in: 'query',
				schema: { type: 'integer', minimum: 1, maximum: 200, default: 100 }
			},
			EventType: {
				name: 'event_type',
				in: 'query',
				description: 'Filter events by the canonical or legacy lead event type.',
				schema: { type: 'string', enum: eventTypes }
			},
			EventSource: {
				name: 'event_source',
				in: 'query',
				description: 'Filter events by the internal app or worker source that wrote the event.',
				schema: { type: 'string', enum: eventSources }
			}
		},
		schemas: {
			ErrorResponse: {
				type: 'object',
				required: ['ok', 'error'],
				properties: {
					ok: { type: 'boolean', const: false },
					error: { type: 'string' }
				}
			},
			Pagination: {
				type: 'object',
				properties: {
					limit: { type: 'integer' },
					count: { type: 'integer' },
					nextUpdatedBefore: { type: ['string', 'null'], format: 'date-time' },
					nextReceivedBefore: { type: ['string', 'null'], format: 'date-time' },
					nextOccurredBefore: { type: ['string', 'null'], format: 'date-time' }
				}
			},
			LeadJourney: {
				type: 'object',
				additionalProperties: true
			},
			LeadMessage: {
				type: 'object',
				description: 'Lead message including full bodyText and bodyHtml.',
				additionalProperties: true
			},
			LeadEvent: {
				type: 'object',
				additionalProperties: true
			}
		}
	}
};

export const GET: RequestHandler = async ({ request }) => {
	const guard = await requirePublicApiRequest(request);
	if (!guard.ok) return guard.response;

	return publicApiJson(openApiDocument, guard.context);
};
