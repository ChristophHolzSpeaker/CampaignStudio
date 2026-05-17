import type { SupabaseClient } from '@supabase/supabase-js';
// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: SupabaseClient;
		}
		interface PageState {
			modal?:
				| { kind: 'youtube'; url: string }
				| {
						kind: 'hero-image-picker';
						campaignId: number;
						campaignPageId: number;
						sectionIndex: number;
				  }
				| { kind: 'booking'; data: Record<string, unknown> }
				| null;
		}
		// interface Platform {}
	}
}

export {};
