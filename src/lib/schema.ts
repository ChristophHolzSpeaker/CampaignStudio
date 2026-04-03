import { z } from 'zod';

const heroSectionProps = z.object({
	headline: z.string(),
	subheadline: z.string(),
	ctaLabel: z.string()
});

const benefitsItem = z.object({
	title: z.string(),
	body: z.string()
});

const benefitsSectionProps = z.object({
	title: z.string(),
	items: z.array(benefitsItem).length(3)
});

const leadFormSectionProps = z.object({
	title: z.string(),
	description: z.string(),
	buttonLabel: z.string()
});

const heroSection = z.object({
	type: z.literal('hero'),
	props: heroSectionProps
});

const benefitsSection = z.object({
	type: z.literal('benefits'),
	props: benefitsSectionProps
});

const leadFormSection = z.object({
	type: z.literal('lead_form'),
	props: leadFormSectionProps
});

export const IntermediatePageSchema = z.object({
	title: z.string(),
	goal: z.string(),
	audience: z.string(),
	offer_summary: z.string(),
	hero: z.object({
		headline: z.string(),
		subheadline: z.string(),
		cta_label: z.string()
	}),
	benefits: z.object({
		title: z.string(),
		items: z
			.array(
				z.object({
					title: z.string(),
					body: z.string()
				})
			)
			.length(3)
	}),
	lead_form: z.object({
		title: z.string(),
		description: z.string(),
		button_label: z.string()
	})
});

export const PageSchema = z.object({
	title: z.string(),
	goal: z.string(),
	audience: z.string(),
	sections: z.tuple([heroSection, benefitsSection, leadFormSection])
});

const layoutActionSchema = z.enum(['keep', 'reorder']);
const editScopeOption = z.enum(['keep', 'revise']);

const sectionOrderSchema = z
	.array(z.enum(['hero', 'benefits', 'lead_form']))
	.length(3)
	.refine((order) => new Set(order).size === 3, {
		message: 'section_order must include hero, benefits, and lead_form exactly once'
	});

export const EditPlanSchema = z.object({
	change_summary: z.string(),
	tone_direction: z.string(),
	audience_adjustment: z.string(),
	layout_action: layoutActionSchema,
	section_order: sectionOrderSchema,
	edit_scope: z.object({
		hero: editScopeOption,
		benefits: editScopeOption,
		lead_form: editScopeOption
	}),
	hero_guidance: z.string(),
	benefits_guidance: z.string(),
	lead_form_guidance: z.string()
});

export type IntermediatePage = z.infer<typeof IntermediatePageSchema>;
export type Page = z.infer<typeof PageSchema>;
export type EditPlan = z.infer<typeof EditPlanSchema>;
