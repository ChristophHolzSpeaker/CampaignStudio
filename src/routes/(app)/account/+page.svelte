<!-- src/routes/(app)/account/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();
</script>

<svelte:head>
	<title>Account</title>
</svelte:head>

{#if data.session}
	<div class="row flex-center flex">
		<div class="form-widget col-6">
			<h1 class="header">Account</h1>
			<p class="description">Welcome back, {data.session.user.email}!</p>

			<form method="POST" use:enhance>
				<div>
					<button class="btn-primary" disabled={form?.pending}>
						{form?.pending ? 'Signing out...' : 'Sign out'}
					</button>
				</div>
			</form>

			<p class="help-text">You can now access protected routes in the application.</p>
		</div>
	</div>
{:else}
	<div class="row flex-center flex">
		<div class="form-widget col-6">
			<h1 class="header">Account</h1>
			<p class="description">You are not signed in.</p>
			<p>
				Please <a href="/login">sign in</a> to access your account.
			</p>
		</div>
	</div>
{/if}
