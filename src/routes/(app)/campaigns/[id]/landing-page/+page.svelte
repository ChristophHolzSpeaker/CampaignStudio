<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import ShallowRouteModal from '$lib/components/blocks/ShallowRouteModal.svelte';
	import YouTubeEmbed from '$lib/components/blocks/YouTubeEmbed.svelte';
	import PageRenderer from '$lib/components/page-renderer/PageRenderer.svelte';
	import type { LandingPageDocument } from '$lib/page-builder/page';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageProps } from './$types';
	import Button from '$lib/components/elements/Button.svelte';

	type LandingPageEditState = {
		values: {
			changePrompt: string;
		};
		message?: string;
		success?: boolean;
		campaignPageId?: number;
	};

	let { data, form }: PageProps = $props();

	const getViewData = () =>
		data as {
			page: LandingPageDocument;
			availableLogos: Array<{ id: string; name: string; logoUrl: string; logoAlt: string }>;
			availableKeynotes: Array<{
				id: string;
				title: string;
				summary: string;
				imageUrl: string;
				imageAlt: string;
			}>;
			campaignId: number;
			campaignPageId: number | null;
			campaignStatus: string | null;
		};

	const getCurrentLogoIds = () => {
		const section = getViewData().page.sections.find(
			(item) => item.type === 'logos_of_trust_ribbon'
		);
		if (!section || !('logos' in section.props) || !Array.isArray(section.props.logos)) {
			return [] as string[];
		}

		const byName = new Map(
			getViewData().availableLogos.map((logo) => [logo.name.trim().toLowerCase(), logo.id])
		);

		return section.props.logos
			.map((logo) => byName.get(logo.name.trim().toLowerCase()))
			.filter((id): id is string => Boolean(id));
	};

	const canEditPage = () => {
		const viewData = getViewData();
		return Boolean(viewData.campaignPageId) && viewData.campaignStatus !== 'published';
	};
	const getComposerHint = () => {
		const viewData = getViewData();
		if (!viewData.campaignPageId) {
			return 'Open a campaign page version to use AI edits.';
		}

		if (viewData.campaignStatus === 'published') {
			return 'This campaign is published. Archive it before editing the landing page.';
		}

		return 'Describe text, section order, section removal, or approved media changes.';
	};

	const getCurrentKeynoteIds = () => {
		const section = getViewData().page.sections.find((item) => item.type === 'keynote_speeches');
		if (!section || !('keynoteIds' in section.props) || !Array.isArray(section.props.keynoteIds)) {
			return [] as string[];
		}

		return section.props.keynoteIds.filter((id): id is string => typeof id === 'string');
	};

	const isKeynoteSelectionDisabled = (keynoteId: string) => {
		const selected = getCurrentKeynoteIds();
		return selected.length >= 3 && !selected.includes(keynoteId);
	};

	let busy = $state(false);

	const handleEditSubmit: SubmitFunction = () => {
		busy = true;

		return async ({ update }) => {
			try {
				await update({ reset: true, invalidateAll: true });
			} finally {
				busy = false;
			}
		};
	};
</script>

<div class="preview-page">
	<PageRenderer page={getViewData().page} />
</div>

<aside class="edit-composer" aria-label="Landing page editor">
	<form method="POST" use:enhance={handleEditSubmit} action="?/editPage" class="composer-form">
		<input type="hidden" name="campaignPageId" value={getViewData().campaignPageId ?? ''} />
		<div class="composer-top-row">
			<p class="composer-title">Edit landing page with AI</p>
			<p class="composer-hint">{getComposerHint()}</p>
		</div>
		<div class="composer-controls">
			<textarea
				value={form?.pageEdit?.values?.changePrompt ?? ''}
				name="change_prompt"
				rows="3"
				placeholder="e.g. Move testimonials above the booking section and tighten the hero headline"
				disabled={!canEditPage()}
			></textarea>
			<Button variant="dark" isSubmitting={busy} disabled={!canEditPage()}>Apply changes</Button>
		</div>
		{#if form?.pageEdit}
			<p class="composer-message" class:success={form?.pageEdit?.success ?? false}>
				{form?.pageEdit?.message ?? ''}
			</p>
		{/if}
	</form>
</aside>

<div class="picker-stack">
	<aside class="logo-picker" aria-label="Landing page logo picker">
		<form method="POST" use:enhance={handleEditSubmit} action="?/setLogos" class="picker-form">
			<input type="hidden" name="campaignPageId" value={getViewData().campaignPageId ?? ''} />
			<p class="picker-title">Logos for trust ribbon</p>
			<div class="picker-grid">
				{#each getViewData().availableLogos as logo (logo.id)}
					<label class="picker-item">
						<input
							type="checkbox"
							name="logoIds"
							value={logo.id}
							checked={getCurrentLogoIds().includes(logo.id)}
							disabled={!canEditPage()}
						/>
						<img src={logo.logoUrl} alt={logo.logoAlt} class="picker-logo" />
						<span>{logo.name}</span>
					</label>
				{/each}
			</div>
			<button type="submit" disabled={!canEditPage()}>Save logos</button>
		</form>
	</aside>

	<aside class="keynote-picker" aria-label="Landing page keynote picker">
		<form method="POST" use:enhance={handleEditSubmit} action="?/setKeynotes" class="picker-form">
			<input type="hidden" name="campaignPageId" value={getViewData().campaignPageId ?? ''} />
			<p class="picker-title">Keynotes</p>
			<div class="picker-grid keynote-picker-grid">
				{#each getViewData().availableKeynotes as keynote (keynote.id)}
					<label class="picker-item keynote-item">
						<input
							type="checkbox"
							name="keynoteIds"
							value={keynote.id}
							checked={getCurrentKeynoteIds().includes(keynote.id)}
							disabled={!canEditPage()}
						/>
						<img src={keynote.imageUrl} alt={keynote.imageAlt} class="picker-keynote-image" />
						<span>{keynote.title}</span>
					</label>
				{/each}
			</div>
			<button type="submit" disabled={!canEditPage()}>Save keynotes</button>
		</form>
	</aside>
</div>

{#if page.state.modal?.kind === 'youtube'}
	<ShallowRouteModal title="Showreel" onclose={() => history.back()}>
		<YouTubeEmbed url={page.state.modal.url} />
	</ShallowRouteModal>
{/if}

<style>
	.preview-page {
		padding-bottom: 12rem;
	}

	.edit-composer {
		position: fixed;
		right: auto;
		bottom: 1rem;
		left: 1rem;
		z-index: 40;
		width: calc(280px - 1rem);
		border: 1px solid #d9dbcf;
		background: #faf8f1;
		box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18);
	}

	.composer-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.875rem;
	}

	.composer-top-row {
		display: flex;
		flex-direction: column;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.composer-title {
		margin: 0;
		font-family: 'Space Grotesk', sans-serif;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #1f2937;
	}

	.composer-hint {
		margin: 0;
		font-size: 0.78rem;
		color: #4b5563;
	}

	.composer-controls {
		display: block;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.75rem;
	}

	.composer-controls textarea {
		width: 100%;
		resize: vertical;
		border: 1px solid #cbd5e1;
		background: #ffffff;
		padding: 0.625rem 0.75rem;
		font-size: 0.85rem;
		line-height: 1.45;
		color: #0f172a;
	}

	.composer-controls textarea:disabled {
		background: #f1f5f9;
		color: #64748b;
	}

	.composer-controls button {
		align-self: end;
		border: 1px solid #0f172a;
		background: #0f172a;
		padding: 0.6rem 0.9rem;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #ffffff;
		cursor: pointer;
	}

	.composer-controls button:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.composer-message {
		margin: 0;
		font-size: 0.8rem;
		color: #b91c1c;
	}

	.composer-message.success {
		color: #166534;
	}

	@media (max-width: 900px) {
		.preview-page {
			padding-bottom: 14rem;
		}

		.composer-top-row {
			flex-direction: column;
			align-items: flex-start;
		}

		.composer-controls {
			grid-template-columns: 1fr;
		}

		.composer-controls button {
			justify-self: stretch;
		}
	}

	.picker-stack {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		z-index: 40;
		display: grid;
		gap: 0.75rem;
	}

	.logo-picker,
	.keynote-picker {
		width: 320px;
		border: 1px solid #d9dbcf;
		background: #ffffff;
		box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18);
	}

	.picker-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.875rem;
	}

	.picker-title {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #1f2937;
	}

	.picker-grid {
		display: grid;
		max-height: 200px;
		overflow: auto;
		gap: 0.5rem;
	}

	.picker-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
	}

	.picker-logo {
		height: 20px;
		max-width: 70px;
		object-fit: contain;
	}

	.keynote-picker-grid {
		max-height: 260px;
	}

	.keynote-item {
		align-items: flex-start;
	}

	.picker-keynote-image {
		width: 56px;
		height: 42px;
		object-fit: cover;
		border: 1px solid #d1d5db;
	}
</style>
