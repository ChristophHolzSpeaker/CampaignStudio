import type { Component } from 'svelte';
import ComplianceFooterSection from '$lib/components/page-sections/ComplianceFooterSection.svelte';
import FrictionlessFunnelSection from '$lib/components/page-sections/FrictionlessFunnelSection.svelte';
import HybridContentSection from '$lib/components/page-sections/HybridContentSection.svelte';
import ImmediateAuthorityHero from '$lib/components/page-sections/ImmediateAuthorityHero.svelte';
import LogosOfTrustRibbon from '$lib/components/page-sections/LogosOfTrustRibbon.svelte';
import ProofOfPerformanceSection from '$lib/components/page-sections/ProofOfPerformanceSection.svelte';
import SEO from '$lib/components/page-sections/SEO.svelte';
import { sectionSpecs } from './specs';
import type { PageSectionSpec, PageSectionType } from './types';

export type SectionComponentRegistry = Record<PageSectionType, Component<any>>;

export interface SectionRegistryEntry<
	TType extends PageSectionType = PageSectionType
> extends PageSectionSpec<TType> {
	component: Component<any>;
}

export type SectionRegistry = {
	[K in PageSectionType]: SectionRegistryEntry<K>;
};

export const sectionComponentRegistry: SectionComponentRegistry = {
	seo: SEO,
	immediate_authority_hero: ImmediateAuthorityHero,
	logos_of_trust_ribbon: LogosOfTrustRibbon,
	hybrid_content_section: HybridContentSection,
	proof_of_performance: ProofOfPerformanceSection,
	frictionless_funnel_booking: FrictionlessFunnelSection,
	compliance_transparency_footer: ComplianceFooterSection
};

export const sectionRegistry: SectionRegistry = {
	seo: {
		...sectionSpecs.seo,
		component: sectionComponentRegistry.seo
	},
	immediate_authority_hero: {
		...sectionSpecs.immediate_authority_hero,
		component: sectionComponentRegistry.immediate_authority_hero
	},
	logos_of_trust_ribbon: {
		...sectionSpecs.logos_of_trust_ribbon,
		component: sectionComponentRegistry.logos_of_trust_ribbon
	},
	hybrid_content_section: {
		...sectionSpecs.hybrid_content_section,
		component: sectionComponentRegistry.hybrid_content_section
	},
	proof_of_performance: {
		...sectionSpecs.proof_of_performance,
		component: sectionComponentRegistry.proof_of_performance
	},
	frictionless_funnel_booking: {
		...sectionSpecs.frictionless_funnel_booking,
		component: sectionComponentRegistry.frictionless_funnel_booking
	},
	compliance_transparency_footer: {
		...sectionSpecs.compliance_transparency_footer,
		component: sectionComponentRegistry.compliance_transparency_footer
	}
};

export function getSectionSpec(type: PageSectionType): PageSectionSpec {
	return sectionSpecs[type];
}

export function getSectionComponent(type: PageSectionType): Component<any> {
	return sectionComponentRegistry[type];
}

export function getSectionRegistryEntry(type: PageSectionType): SectionRegistryEntry {
	return sectionRegistry[type];
}
