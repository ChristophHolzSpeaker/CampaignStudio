<!-- src/routes/(auth)/login/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();
</script>

<svelte:head>
	<title>Sign in</title>
</svelte:head>

<form class="row flex-center flex" method="POST" use:enhance>
	<div class="form-widget col-6">
		<h1 class="header">Sign in to your account</h1>
		<p class="description">Enter your email and password to continue</p>
		{#if form?.message !== undefined}
			<div class="success {form?.success ? '' : 'fail'}">
				{form?.message}
			</div>
		{/if}
		<div>
			<label for="email">Email address</label>
			<input
				id="email"
				name="email"
				class="input input-kinetic"
				type="email"
				placeholder="Your email"
				value={form?.email ?? ''}
			/>
		</div>
		{#if form?.errors?.email}
			<span class="error flex items-center text-sm">
				{form?.errors?.email}
			</span>
		{/if}
		<div>
			<label for="password">Password</label>
			<input
				id="password"
				name="password"
				class="input input-kinetic"
				type="password"
				placeholder="Enter your password"
				value={form?.password ?? ''}
			/>
		</div>
		{#if form?.errors?.password}
			<span class="error flex items-center text-sm">
				{form?.errors?.password}
			</span>
		{/if}
		<div>
			<button class="btn-primary" disabled={form?.pending}>
				{form?.pending ? 'Signing in...' : 'Sign in'}
			</button>
		</div>
		<div class="form-footer">
			<p>
				Don't have an account? <a href="/register">Sign up</a>
			</p>
		</div>
	</div>
</form>
