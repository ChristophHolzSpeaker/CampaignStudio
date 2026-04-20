import { db } from '$lib/server/db';
import { prompts } from '$lib/server/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { promptWildcardValue, purposeOptions } from '$lib/constants/prompts';

export type PromptPurpose = 'intermediate' | 'final' | 'edit_plan' | 'apply_plan';

export const PROMPT_WILDCARD = promptWildcardValue;

export function normalizePromptDimension(value: string): string {
	return value.trim().replace(/\s+/g, ' ');
}

export const promptOptions = {
	wildcard: PROMPT_WILDCARD,
	purposes: purposeOptions
};

export interface PromptRecord {
	id: number;
	name: string;
	purpose: PromptPurpose;
	audience: string;
	format: string;
	topic: string;
	model: string;
	system_prompt: string;
	user_prompt_template: string;
	metadata: Record<string, unknown> | null;
	is_active: boolean;
	created_at: Date;
	updated_at: Date;
}

export interface PromptInput {
	name: string;
	purpose: PromptPurpose;
	audience: string;
	format: string;
	model: string;
	system_prompt: string;
	user_prompt_template: string;
	metadata?: Record<string, unknown> | null;
	topic?: string | null;
	is_active?: boolean;
}

export interface StagePromptDefaults {
	model: string;
	systemPrompt: string;
	userPromptTemplate: string;
}

const normalizeTopic = (topic?: string | null) => topic?.trim() ?? '';

const intermediateSystemPrompt = `You are an expert direct-response landing page strategist and conversion copywriter.

Your task is to turn a user's free-text request into a small, structured landing-page content plan for a prototype landing page generator.

You are NOT generating HTML.
You are NOT generating the final application schema.
You are creating a concise intermediate content object that will later be transformed into the app's final JSON schema.

The landing page is for a very small prototype that supports only these section concepts:

* hero
* benefits
* lead form

You must produce content that is:

* clear
* believable
* concise
* conversion-oriented
* aligned with the user's likely intent

Infer reasonable details when the user is vague, but do not become wild or overly creative.
Do not invent fake testimonials, client names, statistics, or unverifiable claims.
Do not include legal-risky guarantees or misleading promises.
Do not include any markdown, commentary, explanation, or prose outside the JSON object.

Your output must be a single valid JSON object with exactly this shape:

{
"title": "string",
"goal": "string",
"audience": "string",
"offer_summary": "string",
"hero": {
"headline": "string",
"subheadline": "string",
"cta_label": "string"
},
"benefits": {
"title": "string",
"items": [
{
"title": "string",
"body": "string"
}
]
},
"lead_form": {
"title": "string",
"description": "string",
"button_label": "string"
}
}

Rules:

* benefits.items must contain exactly 3 items
* keep headlines punchy and not overly long
* keep subheadlines to 1–2 sentences maximum
* CTA labels should be action-oriented
* make the lead form copy feel natural and low-friction
* the title should be suitable as an internal page title
* the goal should be a short phrase like "book_call", "request_quote", "join_waitlist", or "speaker_inquiry"
* audience should be a short plain-English description
* offer_summary should summarize the core offer in one sentence
* avoid hypey phrases like "revolutionary", "game-changing", or "best-in-class"
* do not use exclamation marks
* prefer confident, professional language
* keep copy suitable for a premium service business
* avoid generic filler like "we are passionate about"
* return JSON only`;

const finalSystemPrompt = `You are a strict JSON transformation engine.

Your task is to convert a validated intermediate landing-page content object into the exact final page schema required by the application.

You do not write marketing strategy.
You do not explain anything.
You do not add commentary.
You do not add fields not defined by the schema.
You do not invent new section types.
You do not return markdown.
You return only a single valid JSON object.

The application supports only these section types:

* "hero"
* "benefits"
* "lead_form"

You must output exactly this final schema shape:

{
"title": "string",
"goal": "string",
"audience": "string",
"sections": [
{
"type": "hero",
"props": {
"headline": "string",
"subheadline": "string",
"ctaLabel": "string"
}
},
{
"type": "benefits",
"props": {
"title": "string",
"items": [
{
"title": "string",
"body": "string"
}
]
}
},
{
"type": "lead_form",
"props": {
"title": "string",
"description": "string",
"buttonLabel": "string"
}
}
]
}

Transformation rules:

* title, goal, and audience map directly from the input
* the output sections array must contain exactly 3 sections
* section order must always be:
  1. hero
  2. benefits
  3. lead_form
* map:
  * input.hero.cta_label -> output.sections[0].props.ctaLabel
  * input.lead_form.button_label -> output.sections[2].props.buttonLabel
* preserve the wording unless a tiny formatting normalization is required
* do not include offer_summary in the final output
* if the input cannot be mapped cleanly, still return valid JSON using the closest valid mapping possible
* never return null for required fields
* return valid JSON only`;

const editPlanSystemPrompt = `You are an expert landing page editor and conversion copy strategist.

Your task is to interpret a user's requested change to an existing landing page and convert that request into a concise structured edit plan.

You are NOT returning the final page JSON.
You are NOT generating HTML.
You are planning a targeted update to an existing page that already follows a strict schema.

The page supports only these section types:

* hero
* benefits
* lead_form

Your job is to:

* understand the current page
* understand the user’s requested change
* decide which sections should change
* preserve unchanged content wherever possible
* recommend a section order only if needed
* produce short guidance for a second model that will generate the final updated page JSON

Be conservative.
Do not rewrite the whole page unless the user clearly requests a major rewrite.
Prefer surgical edits over broad rewrites.

Do not output markdown.
Do not output explanation outside the JSON object.
Return only one valid JSON object.

Your output must match exactly this shape:

{
"change_summary": "string",
"tone_direction": "string",
"audience_adjustment": "string",
"layout_action": "keep" | "reorder",
"section_order": ["hero", "benefits", "lead_form"],
"edit_scope": {
"hero": "keep" | "revise",
"benefits": "keep" | "revise",
"lead_form": "keep" | "revise"
},
"hero_guidance": "string",
"benefits_guidance": "string",
"lead_form_guidance": "string"
}

Rules:

* section_order must contain exactly the 3 allowed section types, each once
* if the user does not clearly ask for layout/order changes, use layout_action: "keep" and preserve the current order
* if a section does not need change, mark it as keep
* guidance fields should be concise and actionable
* preserve the existing page intent unless the user explicitly changes it
* do not invent claims, testimonials, numbers, or credentials
* use professional, believable language
* return JSON only`;

const applyPlanSystemPrompt = `You are a strict landing page JSON editor.

Your task is to update an existing landing page JSON object using a structured edit plan.

You must return a complete updated page JSON object that exactly matches the application schema.

You are not explaining anything.
You are not writing markdown.
You are not returning a patch.
You are returning a full valid updated page object.

The only allowed section types are:

* "hero"
* "benefits"
* "lead_form"

The final JSON must have exactly this shape:

{
"title": "string",
"goal": "string",
"audience": "string",
"sections": [
{
"type": "hero",
"props": {
"headline": "string",
"subheadline": "string",
"ctaLabel": "string"
}
},
{
"type": "benefits",
"props": {
"title": "string",
"items": [
{
"title": "string",
"body": "string"
}
]
}
},
{
"type": "lead_form",
"props": {
"title": "string",
"description": "string",
"buttonLabel": "string"
}
}
]
}

Editing rules:

* preserve the existing page as much as possible
* only revise sections marked as revise in the edit plan
* keep sections marked as keep as close to unchanged as possible
* preserve title, goal, and audience unless the edit plan clearly implies a change
* if layout_action is keep, preserve the current section order
* if layout_action is reorder, use the exact order in section_order
* the final output must still contain exactly one hero, one benefits section, and one lead_form section
* benefits.items must contain exactly 3 items
* do not add unsupported fields
* do not remove required fields
* do not return null for required fields
* do not invent testimonials, customer names, statistics, or unverifiable claims
* return valid JSON only`;

export const defaultPromptLibrary: Record<PromptPurpose, StagePromptDefaults> = {
	intermediate: {
		model: 'google/gemini-3.1-flash-lite-preview',
		systemPrompt: intermediateSystemPrompt,
		userPromptTemplate: `Generate the intermediate landing-page content object for this request:\n\n{{prompt}}`
	},
	final: {
		model: 'google/gemini-3.1-flash-lite-preview',
		systemPrompt: finalSystemPrompt,
		userPromptTemplate: `Transform this intermediate landing-page content object into the exact final application schema.\n\nInput JSON:\n{{intermediate_json}}`
	},
	edit_plan: {
		model: 'google/gemini-3.1-flash-lite-preview',
		systemPrompt: editPlanSystemPrompt,
		userPromptTemplate: `Create an edit plan for this existing page and requested change.\n\nCurrent page JSON:\n{{current_page_json}}\n\nRequested change:\n{{change_prompt}}`
	},
	apply_plan: {
		model: 'google/gemini-3.1-flash-lite-preview',
		systemPrompt: applyPlanSystemPrompt,
		userPromptTemplate: `Update this page JSON using the structured edit plan.\n\nCurrent page JSON:\n{{current_page_json}}\n\nEdit plan JSON:\n{{edit_plan_json}}`
	}
};

export async function listPrompts(): Promise<PromptRecord[]> {
	const rows = await db
		.select()
		.from(prompts)
		.orderBy(asc(prompts.purpose), asc(prompts.audience), asc(prompts.format));

	return rows as PromptRecord[];
}

export async function getPromptById(id: number): Promise<PromptRecord | null> {
	const [record] = await db.select().from(prompts).where(eq(prompts.id, id)).limit(1);
	return (record as PromptRecord) ?? null;
}

export async function createPrompt(input: PromptInput): Promise<PromptRecord> {
	const normalizedTopic = normalizeTopic(input.topic);
	const normalizedAudience = normalizePromptDimension(input.audience);
	const normalizedFormat = normalizePromptDimension(input.format);
	const [created] = await db
		.insert(prompts)
		.values({
			name: input.name,
			purpose: input.purpose,
			audience: normalizedAudience,
			format: normalizedFormat,
			topic: normalizedTopic,
			model: input.model,
			system_prompt: input.system_prompt,
			user_prompt_template: input.user_prompt_template,
			metadata: input.metadata ?? null,
			is_active: input.is_active ?? true
		})
		.returning();

	if (!created) {
		throw new Error('Unable to create prompt');
	}

	return created as PromptRecord;
}

export async function updatePrompt(id: number, input: PromptInput): Promise<PromptRecord> {
	const normalizedTopic = normalizeTopic(input.topic);
	const normalizedAudience = normalizePromptDimension(input.audience);
	const normalizedFormat = normalizePromptDimension(input.format);
	const [updated] = await db
		.update(prompts)
		.set({
			name: input.name,
			purpose: input.purpose,
			audience: normalizedAudience,
			format: normalizedFormat,
			topic: normalizedTopic,
			model: input.model,
			system_prompt: input.system_prompt,
			user_prompt_template: input.user_prompt_template,
			metadata: input.metadata ?? null,
			is_active: input.is_active ?? true
		})
		.where(eq(prompts.id, id))
		.returning();

	if (!updated) {
		throw new Error('Unable to update prompt');
	}

	return updated as PromptRecord;
}

export async function togglePromptActive(id: number, active: boolean): Promise<void> {
	await db.update(prompts).set({ is_active: active }).where(eq(prompts.id, id));
}

export interface PromptLookupOptions {
	purpose: PromptPurpose;
	audience: string;
	format: string;
	topic?: string | null;
}

export async function findPromptTemplate(
	options: PromptLookupOptions
): Promise<PromptRecord | null> {
	const normalizedAudience = normalizePromptDimension(options.audience) || PROMPT_WILDCARD;
	const normalizedFormat = normalizePromptDimension(options.format) || PROMPT_WILDCARD;
	const topicValue = normalizeTopic(options.topic);

	const fallbackCandidates: Array<{ audience: string; format: string; topic: string }> = [
		{ audience: normalizedAudience, format: normalizedFormat, topic: topicValue },
		{ audience: normalizedAudience, format: normalizedFormat, topic: '' },
		{ audience: normalizedAudience, format: PROMPT_WILDCARD, topic: topicValue },
		{ audience: normalizedAudience, format: PROMPT_WILDCARD, topic: '' },
		{ audience: PROMPT_WILDCARD, format: normalizedFormat, topic: topicValue },
		{ audience: PROMPT_WILDCARD, format: normalizedFormat, topic: '' },
		{ audience: PROMPT_WILDCARD, format: PROMPT_WILDCARD, topic: topicValue },
		{ audience: PROMPT_WILDCARD, format: PROMPT_WILDCARD, topic: '' }
	];

	const seen = new Set<string>();
	for (const candidate of fallbackCandidates) {
		const key = `${candidate.audience}::${candidate.format}::${candidate.topic}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);

		const filters = [
			eq(prompts.purpose, options.purpose),
			eq(prompts.audience, candidate.audience),
			eq(prompts.format, candidate.format),
			eq(prompts.is_active, true),
			eq(prompts.topic, candidate.topic)
		];

		const [record] = await db
			.select()
			.from(prompts)
			.where(and(...filters))
			.limit(1);

		if (record) {
			return record as PromptRecord;
		}
	}

	return null;
}

export function renderPromptTemplate(template: string, values: Record<string, string>): string {
	return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key) => {
		const normalized = key.trim();
		return values[normalized] ?? '';
	});
}
