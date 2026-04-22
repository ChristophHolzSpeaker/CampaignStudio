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
			campaignId: number | null;
			campaignPageId: number | null;
			campaignStatus: string | null;
		};

	const getEditState = (): LandingPageEditState | null => {
		const actionData = form as { pageEdit?: LandingPageEditState } | null | undefined;
		return actionData?.pageEdit ?? null;
	};

	const getPromptValue = () => getEditState()?.values.changePrompt ?? '';
	const getEditMessage = () => getEditState()?.message ?? null;
	const getEditMessageIsSuccess = () => getEditState()?.success === true;
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
			return 'This campaign is published. Unpublish it before editing the landing page.';
		}

		return 'Describe text, section order, section removal, or approved media changes.';
	};

	const handleEditSubmit: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				const actionData = result.data as { pageEdit?: LandingPageEditState } | undefined;
				const nextCampaignPageId = actionData?.pageEdit?.campaignPageId;

				if (typeof nextCampaignPageId === 'number' && Number.isFinite(nextCampaignPageId)) {
					await goto(`/preview/landing-page?campaignPageId=${nextCampaignPageId}`, {
						replaceState: true,
						invalidateAll: true,
						noScroll: true,
						keepFocus: true
					});
					return;
				}
			}

			if (result.type === 'success' || result.type === 'failure') {
				await update({ reset: result.type === 'success' });
				return;
			}

			await update();
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
				name="change_prompt"
				rows="3"
				placeholder="e.g. Move testimonials above the booking section and tighten the hero headline"
				disabled={!canEditPage()}>{getPromptValue()}</textarea
			>
			<button type="submit" disabled={!canEditPage()}>Apply changes</button>
		</div>
		{#if getEditMessage()}
			<p class="composer-message" class:success={getEditMessageIsSuccess()}>{getEditMessage()}</p>
		{/if}
	</form>
</aside>

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
		right: 1rem;
		bottom: 1rem;
		left: 1rem;
		z-index: 40;
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
		display: grid;
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
</style>
