export {
	pageSectionTypeSchema,
	immediateAuthorityHeroPropsSchema,
	logosOfTrustRibbonPropsSchema,
	hybridContentSectionPropsSchema,
	proofOfPerformancePropsSchema,
	frictionlessFunnelBookingPropsSchema,
	complianceTransparencyFooterPropsSchema,
	immediateAuthorityHeroSectionSchema,
	logosOfTrustRibbonSectionSchema,
	hybridContentSectionSchema,
	proofOfPerformanceSectionSchema,
	frictionlessFunnelBookingSectionSchema,
	complianceTransparencyFooterSectionSchema,
	pageSectionSchema,
	pageSectionsSchema
} from './schema';

export { sectionSpecs } from './specs';

export {
	sectionComponentRegistry,
	sectionRegistry,
	getSectionSpec,
	getSectionComponent,
	getSectionRegistryEntry,
	type SectionComponentRegistry,
	type SectionRegistryEntry,
	type SectionRegistry
} from './registry';

export {
	pageSectionTypes,
	type PageSectionType,
	type ImmediateAuthorityHeroProps,
	type TrustLogoItem,
	type LogosOfTrustRibbonProps,
	type HybridBenefitItem,
	type HybridDeepDiveItem,
	type HybridSupportingVisualItem,
	type HybridContentSectionProps,
	type TestimonialItem,
	type ProofOfPerformanceProps,
	type IntroQuestionType,
	type IntroQuestionItem,
	type FrictionlessFunnelBookingProps,
	type ComplianceLinkItem,
	type ComplianceTransparencyFooterProps,
	type SectionPropsByType,
	type PageSection,
	type PageSectionComponent,
	type PageSectionSpec,
	type PageSectionSpecMap
} from './types';
