<script lang="ts">
	type SaveResult = {
		saved: boolean;
		nextValue?: string;
		nextCampaignPageId?: number;
	};

	let {
		as = 'div',
		value,
		editable,
		multiline = false,
		className = '',
		onSave
	}: {
		as?: keyof HTMLElementTagNameMap;
		value: string;
		editable: boolean;
		multiline?: boolean;
		className?: string;
		onSave: (nextValue: string) => Promise<SaveResult>;
	} = $props();

	let elementRef = $state<HTMLElement | null>(null);
	let isEditing = $state(false);
	let isSaving = $state(false);
	let displayValue = $state(value);
	let originalValue = $state('');

	$effect(() => {
		if (!isEditing && value !== displayValue) {
			displayValue = value;
			if (elementRef && elementRef.textContent !== value) {
				elementRef.textContent = value;
			}
		}
	});

	function normalizeValue(input: string): string {
		return input.replace(/\r\n?/g, '\n').trim();
	}

	function readElementValue(): string {
		return normalizeValue(elementRef?.textContent ?? '');
	}

	function startEditing(): void {
		if (!editable || isSaving || !elementRef) {
			return;
		}

		isEditing = true;
		originalValue = readElementValue();
	}

	function cancelEditing(): void {
		if (!elementRef || isSaving) {
			return;
		}

		displayValue = originalValue;
		elementRef.textContent = originalValue;
		isEditing = false;
		elementRef.blur();
	}

	async function saveEditing(): Promise<void> {
		if (!isEditing || isSaving || !elementRef) {
			return;
		}

		const nextValue = readElementValue();
		if (nextValue === normalizeValue(originalValue)) {
			displayValue = originalValue;
			elementRef.textContent = originalValue;
			isEditing = false;
			return;
		}

		isSaving = true;
		try {
			const result = await onSave(nextValue);
			const savedValue = normalizeValue(result.nextValue ?? nextValue);
			displayValue = savedValue;
			if (elementRef.textContent !== savedValue) {
				elementRef.textContent = savedValue;
			}
			originalValue = savedValue;
			isEditing = false;
		} finally {
			isSaving = false;
		}
	}

	async function handleBlur(): Promise<void> {
		await saveEditing();
	}

	async function handleKeydown(event: KeyboardEvent): Promise<void> {
		if (event.key === 'Escape') {
			event.preventDefault();
			cancelEditing();
			return;
		}

		if (!multiline && event.key === 'Enter') {
			event.preventDefault();
			await saveEditing();
			return;
		}

		if (multiline && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			await saveEditing();
		}
	}

	function handlePaste(event: ClipboardEvent): void {
		if (!isEditing || !elementRef) {
			return;
		}

		event.preventDefault();
		const pastedText = event.clipboardData?.getData('text/plain') ?? '';
		if (!pastedText.length) {
			return;
		}

		document.execCommand('insertText', false, pastedText);
	}
</script>

<svelte:element
	this={as}
	bind:this={elementRef}
	contenteditable={editable}
	spellcheck={false}
	data-editing={isEditing ? 'true' : 'false'}
	class={[
		className,
		editable &&
			'cursor-text rounded-sm transition hover:outline hover:outline-1 hover:outline-primary/50 hover:outline-dashed focus:outline focus:outline-1 focus:outline-primary/60 focus:outline-dashed',
		isSaving && 'opacity-70'
	]}
	role={editable ? 'textbox' : undefined}
	tabindex={editable ? 0 : undefined}
	onfocus={startEditing}
	onblur={handleBlur}
	onkeydown={handleKeydown}
	onpaste={handlePaste}>{displayValue}</svelte:element
>
