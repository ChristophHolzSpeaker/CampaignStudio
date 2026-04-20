import {
	findPromptTemplate,
	normalizePromptDimension,
	renderPromptTemplate,
	type PromptPurpose,
	type PromptRecord
} from '$lib/server/prompts/client';

type CampaignPromptContext = {
	name: string;
	audience: string;
	format: string;
	topic: string;
	language: string;
	geography: string;
	notes: string | null;
};

export type PromptGuidanceResult = {
	guidance: string;
	matchedPromptId: number | null;
	matchedPromptName: string | null;
	matchedAudience: string | null;
	matchedFormat: string | null;
};

function classifyAudience(audience: string): string {
	const value = normalizePromptDimension(audience).toLowerCase();
	if (!value) {
		return '';
	}

	if (/(bank|financ|insurance|asset manager|fintech)/.test(value)) {
		return 'finance_leaders';
	}

	if (/(association|verband|federation|non-profit|ngo)/.test(value)) {
		return 'association_leaders';
	}

	if (/(cio|cto|cdo|it |technology|tech|software|engineering)/.test(value)) {
		return 'enterprise_it_leaders';
	}

	if (/(founder|startup|entrepreneur|executive)/.test(value)) {
		return 'business_leaders';
	}

	return '';
}

function classifyFormat(format: string): string {
	const value = normalizePromptDimension(format).toLowerCase();
	if (!value) {
		return '';
	}

	if (/(keynote|opening talk|closing talk|speech)/.test(value)) {
		return 'keynote';
	}

	if (/(panel|moderation|moderator|fireside)/.test(value)) {
		return 'panel_discussion';
	}

	if (/(workshop|masterclass|training|seminar)/.test(value)) {
		return 'workshop';
	}

	if (/(breakfast|lunch|dinner|roundtable)/.test(value)) {
		return 'executive_roundtable';
	}

	if (/(webinar|virtual|online)/.test(value)) {
		return 'webinar';
	}

	return '';
}

function buildCandidateValues(rawValue: string, classifiedValue: string): string[] {
	const normalizedRaw = normalizePromptDimension(rawValue);
	const values = [normalizedRaw, classifiedValue].filter((value) => value.length > 0);
	return [...new Set(values)];
}

function buildPromptGuidance(record: PromptRecord, context: CampaignPromptContext): string {
	const renderedUserGuidance = renderPromptTemplate(record.user_prompt_template, {
		prompt: context.notes ?? '',
		campaign_name: context.name,
		audience: context.audience,
		format: context.format,
		topic: context.topic,
		language: context.language,
		geography: context.geography,
		notes: context.notes ?? ''
	}).trim();

	const sections = [
		`Prompt library record: ${record.name} (#${record.id})`,
		'Apply this as soft guidance only; runtime schema and section constraints remain mandatory.',
		record.system_prompt.trim()
	];

	if (renderedUserGuidance.length > 0) {
		sections.push('Template guidance:', renderedUserGuidance);
	}

	return sections.join('\n\n');
}

export async function resolvePromptGuidanceForCampaign(
	purpose: PromptPurpose,
	context: CampaignPromptContext
): Promise<PromptGuidanceResult> {
	const audienceCandidates = buildCandidateValues(
		context.audience,
		classifyAudience(context.audience)
	);
	const formatCandidates = buildCandidateValues(context.format, classifyFormat(context.format));

	const lookupAttempts: Array<{ audience: string; format: string }> = [];
	const seen = new Set<string>();
	for (const audienceCandidate of audienceCandidates) {
		for (const formatCandidate of formatCandidates) {
			const key = `${audienceCandidate}::${formatCandidate}`;
			if (seen.has(key)) {
				continue;
			}
			seen.add(key);
			lookupAttempts.push({ audience: audienceCandidate, format: formatCandidate });
		}
	}

	for (const attempt of lookupAttempts) {
		const match = await findPromptTemplate({
			purpose,
			audience: attempt.audience,
			format: attempt.format,
			topic: context.topic
		});

		if (match) {
			return {
				guidance: buildPromptGuidance(match, context),
				matchedPromptId: match.id,
				matchedPromptName: match.name,
				matchedAudience: match.audience,
				matchedFormat: match.format
			};
		}
	}

	return {
		guidance: '',
		matchedPromptId: null,
		matchedPromptName: null,
		matchedAudience: null,
		matchedFormat: null
	};
}
