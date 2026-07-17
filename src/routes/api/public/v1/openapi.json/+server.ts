import { publicApiJson, requirePublicApiReadOrWriteRequest } from '$lib/server/public-api/http';
import { pageSectionTypes } from '$lib/page-builder/sections';
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
		'/api/public/v1/page-sections/schema': {
			get: {
				summary: 'Get landing page section schemas',
				description:
					'Returns the Campaign Studio landing page document JSON schema, available section types, section usage guidance, and each section props schema.',
				security,
				responses: {
					'200': {
						description: 'Landing page section schema catalog',
						content: {
							'application/json': {
								schema: { $ref: '#/components/schemas/PageSectionsSchemaResponse' }
							}
						}
					},
					'401': errorResponse,
					'429': errorResponse
				}
			}
		},
		'/api/public/v1/campaigns': {
			get: {
				summary: 'List campaigns for external navigation',
				description:
					'Returns campaign navigation items with all landing page versions and tokenized iframe embed URLs for trusted external editing interfaces.',
				security,
				responses: {
					'200': {
						description: 'Campaign navigation items grouped with landing pages',
						content: {
							'application/json': {
								schema: { $ref: '#/components/schemas/CampaignListResponse' }
							}
						}
					},
					'401': errorResponse,
					'429': errorResponse,
					'500': errorResponse
				}
			},
			post: {
				summary: 'Create campaign with supplied landing page JSON',
				description:
					'Creates a draft campaign and campaign page directly from caller-supplied structured content. This skips the Campaign Studio generation pipeline and requires the campaign write bearer token.',
				security,
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/CampaignCreateRequest' }
						}
					}
				},
				responses: {
					'201': {
						description: 'Created campaign and draft campaign page',
						content: {
							'application/json': {
								schema: { $ref: '#/components/schemas/CampaignCreateResponse' }
							}
						}
					},
					'400': errorResponse,
					'401': errorResponse,
					'429': errorResponse,
					'500': errorResponse
				}
			}
		},
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
			PageSectionsSchemaResponse: {
				type: 'object',
				required: ['ok', 'data'],
				properties: {
					ok: { type: 'boolean', const: true },
					data: {
						type: 'object',
						required: ['contentJsonSchema', 'sectionTypes', 'sections'],
						properties: {
							contentJsonSchema: { type: 'object', additionalProperties: true },
							sectionTypes: { type: 'array', items: { type: 'string', enum: pageSectionTypes } },
							sections: { type: 'array', items: { $ref: '#/components/schemas/SectionSpec' } }
						}
					}
				}
			},
			SectionSpec: {
				type: 'object',
				required: [
					'type',
					'label',
					'description',
					'whenToUse',
					'whenNotToUse',
					'contentGuidance',
					'propsSchema'
				],
				properties: {
					type: { type: 'string', enum: pageSectionTypes },
					label: { type: 'string' },
					description: { type: 'string' },
					whenToUse: { type: 'array', items: { type: 'string' } },
					whenNotToUse: { type: 'array', items: { type: 'string' } },
					contentGuidance: { type: 'array', items: { type: 'string' } },
					propsSchema: { type: 'object', additionalProperties: true }
				}
			},
			CampaignListResponse: {
				type: 'object',
				required: ['ok', 'data'],
				properties: {
					ok: { type: 'boolean', const: true },
					data: { type: 'array', items: { $ref: '#/components/schemas/CampaignNavItem' } }
				}
			},
			CampaignNavItem: {
				type: 'object',
				required: ['campaignId', 'name', 'status', 'createdAt', 'updatedAt', 'pages'],
				properties: {
					campaignId: { type: 'integer', minimum: 1 },
					name: { type: 'string' },
					status: { type: 'string' },
					createdAt: { type: 'string', format: 'date-time' },
					updatedAt: { type: 'string', format: 'date-time' },
					pages: { type: 'array', items: { $ref: '#/components/schemas/CampaignPageNavItem' } }
				}
			},
			CampaignPageNavItem: {
				type: 'object',
				required: [
					'campaignPageId',
					'versionNumber',
					'title',
					'slug',
					'isPublished',
					'publishedAt',
					'createdAt',
					'updatedAt',
					'heroImageUrl',
					'embedUrl',
					'liveUrl'
				],
				properties: {
					campaignPageId: { type: 'integer', minimum: 1 },
					versionNumber: { type: 'integer', minimum: 1 },
					title: { type: 'string' },
					slug: { type: 'string' },
					isPublished: { type: 'boolean' },
					publishedAt: { type: ['string', 'null'], format: 'date-time' },
					createdAt: { type: 'string', format: 'date-time' },
					updatedAt: { type: 'string', format: 'date-time' },
					heroImageUrl: { type: ['string', 'null'] },
					embedUrl: {
						type: 'string',
						description: 'Absolute /embed/{slug}?token=... iframe URL for draft preview rendering.'
					},
					liveUrl: {
						type: ['string', 'null'],
						description: 'Absolute public speaker URL when the page is published, otherwise null.'
					}
				}
			},
			CampaignCreateRequest: {
				type: 'object',
				required: ['campaign', 'content_json'],
				properties: {
					campaign: { $ref: '#/components/schemas/CampaignInput' },
					content_json: { $ref: '#/components/schemas/LandingPageDocument' },
					change_note: { type: 'string', maxLength: 500 }
				},
				additionalProperties: false
			},
			CampaignInput: {
				type: 'object',
				required: ['name', 'audience', 'format', 'topic', 'language', 'geography'],
				properties: {
					name: { type: 'string', minLength: 2, maxLength: 120 },
					audience: { type: 'string', minLength: 2, maxLength: 120 },
					format: { type: 'string', minLength: 2, maxLength: 120 },
					topic: { type: 'string', minLength: 2, maxLength: 120 },
					language: { type: 'string', minLength: 2, maxLength: 120 },
					geography: { type: 'string', minLength: 2, maxLength: 120 },
					notes: { type: 'string', maxLength: 2000 }
				},
				additionalProperties: false
			},
			LandingPageDocument: {
				type: 'object',
				required: ['version', 'title', 'sections'],
				properties: {
					version: { type: 'integer', const: 1 },
					title: { type: 'string', minLength: 1 },
					slug: { type: 'string', minLength: 1 },
					sections: {
						type: 'array',
						minItems: 1,
						items: { type: 'object', additionalProperties: true }
					}
				},
				additionalProperties: false
			},
			CampaignCreateResponse: {
				type: 'object',
				required: ['ok', 'data'],
				properties: {
					ok: { type: 'boolean', const: true },
					data: {
						type: 'object',
						required: [
							'campaignId',
							'campaignPageId',
							'pageSlug',
							'campaignUrl',
							'previewUrl',
							'embedUrl'
						],
						properties: {
							campaignId: { type: 'integer', minimum: 1 },
							campaignPageId: { type: 'integer', minimum: 1 },
							pageSlug: { type: 'string' },
							campaignUrl: { type: 'string' },
							previewUrl: { type: 'string' },
							embedUrl: {
								type: 'string',
								description:
									'Absolute /embed/{slug}?token=... iframe URL for draft preview rendering.'
							}
						}
					}
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
	const guard = await requirePublicApiReadOrWriteRequest(request);
	if (!guard.ok) return guard.response;

	return publicApiJson(openApiDocument, guard.context);
};
