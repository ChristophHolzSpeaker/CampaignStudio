<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import Button from '$lib/components/elements/Button.svelte';
	import Input from '$lib/components/elements/Input.svelte';

	let { form } = $props<{ form: ActionData }>();
</script>

<svelte:head>
	<title>Sign in</title>
</svelte:head>

<div class="min-h-screen bg-sky-50 py-12">
	<div class="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4">
		<div class="mx-auto w-full max-w-md">
			<div class="space-y-6 bg-white p-8 shadow-lg">
				<p class="text-[0.6rem] tracking-[0.5em] text-slate-500 uppercase">Campaign studio</p>
				<h1 class="text-4xl font-semibold text-slate-900">Christoph Campaign Studio</h1>
				<p class="text-sm leading-relaxed text-slate-500">
					Enter your work email and password to unlock guided AI campaigns for your team.
				</p>

				<form method="POST" class="space-y-6" use:enhance>
					{#if form?.message}
						<div
							class={`rounded-2xl border px-4 py-3 text-xs font-semibold tracking-[0.4em] uppercase ${
								form?.success
									? 'border-emerald-400/70 bg-emerald-50 text-emerald-600'
									: 'border-rose-400/70 bg-rose-50 text-rose-600'
							}`}
						>
							{form.message}
						</div>
					{/if}

					<Input
						id="email"
						name="email"
						label="Email address"
						type="email"
						placeholder="you@example.com"
						value={form?.email ?? ''}
						error={form?.errors?.email}
						autocomplete="username"
					/>

					<Input
						id="password"
						name="password"
						label="Password"
						type="password"
						placeholder="Enter your password"
						value={form?.password ?? ''}
						error={form?.errors?.password}
						autocomplete="current-password"
					/>

					<Button isSubmitting={form?.pending}>
						{form?.pending ? 'Signing in...' : 'Sign in'}
					</Button>

					<p class="text-center text-xs text-slate-400 uppercase">
						Need an account? <a class="font-semibold" href="/register">Sign up</a>
					</p>
				</form>
			</div>
		</div>
	</div>
</div>
