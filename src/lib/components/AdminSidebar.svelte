<script>
	const navItems = [
		{ label: 'Editor', icon: 'edit_note', active: true, href: '/admin/prompts' },
		{ label: 'Templates', icon: 'auto_awesome_motion', active: false, href: '/admin/templates' },
		{ label: 'Variables', icon: 'variables', active: false, href: '/admin/variables' },
		{ label: 'History', icon: 'history', active: false, href: '/admin/history' },
		{ label: 'Library', icon: 'book_5', active: false, href: '/admin/library' }
	];
</script>

<aside class="admin-shell-sidebar">
	<div class="sidebar-brand">
		<div class="brand-icon">
			<span class="material-symbols-outlined">precision_manufacturing</span>
		</div>
		<div>
			<p class="brand-label">Prompt Engine</p>
			<p class="brand-note">V2.4 Architectural</p>
		</div>
	</div>

	<nav class="sidebar-nav">
		{#each navItems as item (item.label)}
			<a href={item.href} class:active={item.active}>
				<span class="material-symbols-outlined">{item.icon}</span>
				{item.label}
			</a>
		{/each}
	</nav>

	<button class="new-prompt-btn" type="button">New Prompt</button>

	<div class="sidebar-footer">
		<a href="/admin/docs">Documentation</a>
		<a href="/logout">Log Out</a>
	</div>
</aside>

<style>
	aside {
		width: 280px;
		background: #f4f4f4;
		padding: 2rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
		height: calc(100vh - 72px);
		position: sticky;
		top: 74px;
		align-self: flex-start;
	}

	.sidebar-brand {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.brand-icon {
		width: 42px;
		height: 42px;
		background: #b8002a;
		display: grid;
		place-items: center;
		color: white;
	}

	.brand-label {
		font-size: 0.8rem;
		letter-spacing: 0.3em;
		margin: 0;
	}

	.brand-note {
		font-size: 0.65rem;
		letter-spacing: 0.15em;
		margin: 0;
		color: #4a4a4a;
	}

	.sidebar-nav {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.sidebar-nav a {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.25em;
		font-size: 0.72rem;
		color: #4a4a4a;
		text-decoration: none;
	}

	.sidebar-nav a.active {
		background: #ffffff;
		color: #b8002a;
		border-left: 3px solid #b8002a;
		padding-left: 0.25rem;
	}

	.new-prompt-btn {
		border: none;
		background: linear-gradient(135deg, #b8002a, #e2183b);
		color: #fff;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		padding: 0.9rem 1.2rem;
		font-size: 0.75rem;
		display: block;
	}

	.sidebar-footer {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: auto;
	}

	.sidebar-footer a {
		text-transform: uppercase;
		letter-spacing: 0.25em;
		font-size: 0.65rem;
		color: #5d3f3f;
		text-decoration: none;
	}

	@media (max-width: 1024px) {
		aside {
			display: none;
		}
	}
</style>
