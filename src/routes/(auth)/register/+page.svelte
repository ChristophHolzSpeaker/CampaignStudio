<!-- src/routes/(auth)/register/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();
</script>

<svelte:head>
	<title>Create account</title>
</svelte:head>

<form class="row flex-center flex" method="POST" use:enhance>
	<div class="form-widget col-6">
		<h1 class="header">Create your account</h1>
		<p class="description">Sign up to get started</p>
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
				placeholder="Create a password"
				value={form?.password ?? ''}
			/>
		</div>
		{#if form?.errors?.password}
			<span class="error flex items-center text-sm">
				{form?.errors?.password}
			</span>
		{/if}
		<div>
			<label for="confirmPassword">Confirm password</label>
			<input
				id="confirmPassword"
				name="confirmPassword"
				class="input input-kinetic"
				type="password"
				placeholder="Confirm your password"
				value={form?.confirmPassword ?? ''}
			/>
		</div>
		{#if form?.errors?.confirmPassword}
			<span class="error flex items-center text-sm">
				{form?.errors?.confirmPassword}
			</span>
		{/if}
		<div>
			<button class="btn-primary" disabled={form?.pending}>
				{form?.pending ? 'Creating account...' : 'Create account'}
			</button>
		</div>
		<div class="form-footer">
			<p>
				Already have an account? <a href="/login">Sign in</a>
			</p>
		</div>
	</div>
</form>
