import { z } from 'zod';

export const landingPagePlanSectionTypeSchema = z.enum([
	'immediate_authority_hero',
	'logos_of_trust_ribbon',
	'hybrid_content_section',
	'proof_of_performance',
	'frictionless_funnel_booking',
	'compliance_transparency_footer'
]);

const landingPagePlanSectionSchema = z.object({
	type: landingPagePlanSectionTypeSchema,
	purpose: z.string().trim().min(1),
	contentDirection: z.string().trim().min(1)
});

export const landingPagePlanSchema = z
	.object({
		pageTitle: z.string().trim().min(1),
		conversionGoal: z.string().trim().min(1),
		messagingAngle: z.string().trim().min(1),
		sectionPlan: z.array(landingPagePlanSectionSchema).min(4).max(6)
	})
	.refine(
		(plan) => {
			const sectionTypes = plan.sectionPlan.map((section) => section.type);
			return (
				sectionTypes.includes('immediate_authority_hero') &&
				sectionTypes.includes('frictionless_funnel_booking') &&
				sectionTypes.includes('compliance_transparency_footer')
			);
		},
		{
			message:
				'sectionPlan must include immediate_authority_hero, frictionless_funnel_booking, and compliance_transparency_footer.',
			path: ['sectionPlan']
		}
	)
	.refine(
		(plan) => {
			const sectionTypes = plan.sectionPlan.map((section) => section.type);
			return sectionTypes.length === new Set(sectionTypes).size;
		},
		{
			message: 'sectionPlan must not contain duplicate section types.',
			path: ['sectionPlan']
		}
	);

export type LandingPagePlan = z.infer<typeof landingPagePlanSchema>;
