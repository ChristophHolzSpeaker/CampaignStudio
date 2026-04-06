<script lang="ts">
	type Props = {
		isSubmitting?: undefined | boolean;
		children?: any;
	};

	let { children, isSubmitting = false }: Props = $props();
</script>

<button type="submit" class="btn-primary" disabled={isSubmitting}>
	{@render children?.()}
</button>
