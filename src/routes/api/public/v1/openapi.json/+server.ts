import { json } from '@sveltejs/kit';
import { ARTIFACT_AUTHORING_CONTRACT } from '$lib/artifacts/authoring-contract';
import { ARTIFACT_ALLOWED_MEDIA_TYPES } from '$lib/artifacts/contract';
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

export const _openApiDocument = {
	openapi: '3.1.0',
	info: {
		title: 'Campaign Studio Public API',
		version: '2.1.0',
		description:
			'Artifact documentation is public. Campaign creation, upload, lifecycle, reporting, and private data operations require bearer authentication. Lead responses may contain PII and full email bodies.'
	},
	externalDocs: {
		description: 'Complete LLM-readable artifact authoring guide',
		url: '/llms-full.txt'
	},
	servers: [{ url: '/', description: 'The same Campaign Studio origin that served this document' }],
	paths: {
		'/api/public/v1/page-sections/schema': {
			get: {
				operationId: 'getPageSectionSchemas',
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
				operationId: 'listCampaigns',
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
				operationId: 'createCampaign',
				summary: 'Create an artifact-only campaign or a campaign with section JSON',
				description:
					'With renderer_type artifact, creates a draft campaign with no page; finalizing an artifact upload creates its first immutable page version. With sections or an omitted renderer_type, creates a draft campaign and section page from supplied content_json. Requires the campaign write bearer token.',
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
		'/api/public/v1/authoring-contract': {
			get: {
				operationId: 'getArtifactAuthoringContract',
				summary: 'Get the artifact authoring contract',
				description:
					'Returns bundle limits, reserved slugs, canonical form fields, supported data-cs attributes, widgets, and the pinned runtime version.',
				security: [],
				responses: {
					'200': {
						description: 'Machine-readable authoring contract',
						content: {
							'application/json': {
								schema: { $ref: '#/components/schemas/AuthoringContractResponse' },
								example: { ok: true, data: ARTIFACT_AUTHORING_CONTRACT }
							}
						}
					}
				}
			}
		},
		'/api/public/v1/campaigns/{campaignId}/artifact-versions': {
			post: {
				operationId: 'createArtifactUploadSession',
				summary: 'Create an artifact upload session',
				description:
					'Creates a one-hour upload session. Upload each bundle file individually using the returned upload template, then finalize the session.',
				security,
				parameters: [
					{
						name: 'campaignId',
						in: 'path',
						required: true,
						schema: { type: 'integer', minimum: 1 }
					}
				],
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: {
								type: 'object',
								required: ['slug'],
								properties: {
									slug: { type: 'string', pattern: '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$' }
								}
							}
						}
					}
				},
				responses: {
					'201': {
						description: 'Upload session and constraints',
						content: {
							'application/json': {
								schema: { $ref: '#/components/schemas/ArtifactUploadSessionResponse' }
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
		'/api/public/v1/artifact-versions/{sessionId}/files/{path}': {
			put: {
				operationId: 'uploadArtifactFile',
				summary: 'Upload one artifact bundle file',
				description:
					'Uploads raw file bytes. The path may contain slash-separated safe segments and Content-Type should describe the file.',
				security,
				parameters: [
					{
						name: 'sessionId',
						in: 'path',
						required: true,
						schema: { type: 'string', format: 'uuid' }
					},
					{ name: 'path', in: 'path', required: true, schema: { type: 'string' } }
				],
				requestBody: {
					required: true,
					content: Object.fromEntries(
						ARTIFACT_ALLOWED_MEDIA_TYPES.map((mediaType) => [
							mediaType,
							{ schema: { type: 'string', format: 'binary' } }
						])
					)
				},
				responses: {
					'201': {
						description: 'File accepted and hashed',
						content: {
							'application/json': {
								schema: { $ref: '#/components/schemas/ArtifactFileUploadResponse' }
							}
						}
					},
					'400': errorResponse,
					'401': errorResponse,
					'413': errorResponse,
					'429': errorResponse
				}
			}
		},
		'/api/public/v1/artifact-versions/{sessionId}/finalize': {
			post: {
				operationId: 'finalizeArtifactVersion',
				summary: 'Validate and finalize an artifact version',
				description:
					'Rejects unsafe HTML/JavaScript, validates all hashes and references, rewrites assets to immutable URLs, and returns a tokenized preview URL.',
				security,
				parameters: [
					{
						name: 'sessionId',
						in: 'path',
						required: true,
						schema: { type: 'string', format: 'uuid' }
					}
				],
				responses: {
					'200': {
						description: 'Finalized immutable version and preview URL',
						content: {
							'application/json': {
								schema: { $ref: '#/components/schemas/ArtifactFinalizeResponse' }
							}
						}
					},
					'400': errorResponse,
					'401': errorResponse,
					'429': errorResponse
				}
			}
		},
		'/api/public/v1/artifact-versions/{campaignPageId}/publish': {
			post: {
				operationId: 'publishArtifactVersion',
				summary: 'Publish or roll back to an artifact version',
				description:
					'Atomically publishes the selected immutable version. Publishing an older campaignPageId is rollback.',
				security,
				parameters: [
					{
						name: 'campaignPageId',
						in: 'path',
						required: true,
						schema: { type: 'integer', minimum: 1 }
					}
				],
				responses: {
					'200': {
						description: 'Published version and root live URL',
						content: {
							'application/json': {
								schema: { $ref: '#/components/schemas/ArtifactPublishResponse' }
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
		'/api/public/v1/artifact-versions/{campaignPageId}/unpublish': {
			post: {
				operationId: 'unpublishArtifactVersion',
				summary: 'Unpublish an artifact version',
				description:
					'Removes the selected active artifact from its canonical public URL and returns the campaign to draft.',
				security,
				parameters: [
					{
						name: 'campaignPageId',
						in: 'path',
						required: true,
						schema: { type: 'integer', minimum: 1 }
					}
				],
				responses: {
					'200': {
						description: 'Artifact unpublished',
						content: {
							'application/json': {
								schema: { $ref: '#/components/schemas/ArtifactUnpublishResponse' }
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
		'/api/public/v1/lead-journeys': {
			get: {
				operationId: 'listLeadJourneys',
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
				operationId: 'getLeadJourney',
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
				operationId: 'listLeadJourneyMessages',
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
				operationId: 'listLeadJourneyEvents',
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
			bearerAuth: {
				type: 'http',
				scheme: 'bearer',
				description:
					'Use a campaign-write token for campaign/artifact mutations. A lead-read or campaign-write token can list campaigns; lead reporting requires lead-read.'
			}
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
					'liveUrl',
					'rendererType'
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
						description: 'Absolute tokenized preview URL appropriate to the renderer type.'
					},
					liveUrl: {
						type: ['string', 'null'],
						description:
							'Absolute /{slug} artifact URL or /speaker/{slug} section URL when published; otherwise null.'
					},
					rendererType: { type: 'string', enum: ['artifact', 'sections'] }
				}
			},
			CampaignCreateRequest: {
				oneOf: [
					{ $ref: '#/components/schemas/ArtifactCampaignCreateRequest' },
					{ $ref: '#/components/schemas/SectionCampaignCreateRequest' }
				],
				discriminator: { propertyName: 'renderer_type' }
			},
			ArtifactCampaignCreateRequest: {
				type: 'object',
				required: ['renderer_type', 'campaign'],
				properties: {
					renderer_type: { type: 'string', const: 'artifact' },
					campaign: { $ref: '#/components/schemas/CampaignInput' }
				},
				additionalProperties: false,
				examples: [
					{
						renderer_type: 'artifact',
						campaign: {
							name: 'Future-ready leadership',
							audience: 'Technology leaders',
							format: 'Keynote campaign',
							topic: 'Leadership in the age of AI',
							language: 'English',
							geography: 'Global',
							notes: 'Externally authored artifact'
						}
					}
				]
			},
			SectionCampaignCreateRequest: {
				type: 'object',
				required: ['campaign', 'content_json'],
				properties: {
					renderer_type: { type: 'string', const: 'sections', default: 'sections' },
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
						oneOf: [
							{ $ref: '#/components/schemas/ArtifactCampaignCreateData' },
							{ $ref: '#/components/schemas/SectionCampaignCreateData' }
						]
					}
				}
			},
			ArtifactCampaignCreateData: {
				type: 'object',
				required: ['campaignId', 'rendererType', 'campaignUrl'],
				properties: {
					campaignId: { type: 'integer', minimum: 1 },
					rendererType: { type: 'string', const: 'artifact' },
					campaignUrl: { type: 'string' }
				}
			},
			SectionCampaignCreateData: {
				type: 'object',
				required: [
					'campaignId',
					'rendererType',
					'campaignPageId',
					'pageSlug',
					'campaignUrl',
					'previewUrl',
					'embedUrl'
				],
				properties: {
					campaignId: { type: 'integer', minimum: 1 },
					rendererType: { type: 'string', const: 'sections' },
					campaignPageId: { type: 'integer', minimum: 1 },
					pageSlug: { type: 'string' },
					campaignUrl: { type: 'string' },
					previewUrl: { type: 'string' },
					embedUrl: {
						type: 'string',
						description: 'Absolute tokenized section-renderer preview URL.'
					}
				}
			},
			AuthoringContractResponse: {
				type: 'object',
				required: ['ok', 'data'],
				properties: {
					ok: { type: 'boolean', const: true },
					data: {
						type: 'object',
						required: [
							'contractVersion',
							'runtimeVersion',
							'workflow',
							'routing',
							'bundle',
							'security',
							'platformFonts',
							'runtime',
							'lifecycle'
						],
						additionalProperties: true
					}
				}
			},
			ArtifactManifestFile: {
				type: 'object',
				required: ['path', 'mediaType', 'byteSize', 'sha256'],
				properties: {
					path: { type: 'string' },
					mediaType: { type: 'string' },
					byteSize: { type: 'integer', minimum: 0 },
					sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' }
				}
			},
			ArtifactUploadSessionResponse: {
				type: 'object',
				required: ['ok', 'data'],
				properties: {
					ok: { type: 'boolean', const: true },
					data: {
						type: 'object',
						required: [
							'artifactVersionId',
							'expiresAt',
							'constraints',
							'uploadTemplate',
							'finalizeUrl'
						],
						properties: {
							artifactVersionId: { type: 'string', format: 'uuid' },
							expiresAt: { type: 'string', format: 'date-time' },
							constraints: {
								type: 'object',
								required: ['maxFileCount', 'maxFileBytes', 'maxTotalBytes'],
								properties: {
									maxFileCount: { type: 'integer' },
									maxFileBytes: { type: 'integer' },
									maxTotalBytes: { type: 'integer' }
								}
							},
							uploadTemplate: { type: 'string', format: 'uri' },
							finalizeUrl: { type: 'string', format: 'uri' }
						}
					}
				}
			},
			ArtifactFileUploadResponse: {
				type: 'object',
				required: ['ok', 'data'],
				properties: {
					ok: { type: 'boolean', const: true },
					data: { $ref: '#/components/schemas/ArtifactManifestFile' }
				}
			},
			ArtifactFinalizeResponse: {
				type: 'object',
				required: ['ok', 'data'],
				properties: {
					ok: { type: 'boolean', const: true },
					data: {
						type: 'object',
						required: [
							'campaignId',
							'campaignPageId',
							'versionNumber',
							'slug',
							'previewUrl',
							'publishUrl'
						],
						properties: {
							campaignId: { type: 'integer', minimum: 1 },
							campaignPageId: { type: 'integer', minimum: 1 },
							versionNumber: { type: 'integer', minimum: 1 },
							slug: { type: 'string' },
							previewUrl: { type: 'string', format: 'uri' },
							publishUrl: { type: 'string', format: 'uri' }
						}
					}
				}
			},
			ArtifactPublishResponse: {
				type: 'object',
				required: ['ok', 'data'],
				properties: {
					ok: { type: 'boolean', const: true },
					data: {
						type: 'object',
						required: ['campaignId', 'campaignPageId', 'versionNumber', 'slug', 'liveUrl'],
						properties: {
							campaignId: { type: 'integer', minimum: 1 },
							campaignPageId: { type: 'integer', minimum: 1 },
							versionNumber: { type: 'integer', minimum: 1 },
							slug: { type: 'string' },
							liveUrl: { type: 'string', format: 'uri' }
						}
					}
				}
			},
			ArtifactUnpublishResponse: {
				type: 'object',
				required: ['ok', 'data'],
				properties: {
					ok: { type: 'boolean', const: true },
					data: {
						type: 'object',
						required: ['campaignId', 'campaignPageId', 'slug', 'liveUrl'],
						properties: {
							campaignId: { type: 'integer', minimum: 1 },
							campaignPageId: { type: 'integer', minimum: 1 },
							slug: { type: 'string' },
							liveUrl: { type: 'null' }
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

export const GET: RequestHandler = () =>
	json(_openApiDocument, {
		headers: {
			'Cache-Control': 'public, max-age=300, s-maxage=3600',
			'X-Content-Type-Options': 'nosniff'
		}
	});
