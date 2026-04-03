<script>
	const navLinks = [
		{ label: 'Dashboard', href: '#', active: false },
		{ label: 'Prompt Library', href: '#', active: true },
		{ label: 'Analytics', href: '#', active: false },
		{ label: 'Settings', href: '#', active: false }
	];
</script>

<header class="admin-shell-header">
	<h2 class="text-4xl">Christoph Campaign Studio</h2>
	<nav class="header-nav">
		{#each navLinks as link (link.label)}
			<a class="nav-link" href={link.href} class:active={link.active}>{link.label}</a>
		{/each}
	</nav>
	<div class="header-tools">
		<button class="icon-btn" type="button" aria-label="Notifications">
			<span class="material-symbols-outlined">notifications</span>
		</button>
		<button class="icon-btn" type="button" aria-label="Help">
			<span class="material-symbols-outlined">help_outline</span>
		</button>
		<img
			class="avatar"
			src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=64&q=80"
			alt="Administrator portrait"
		/>
	</div>
</header>

<style>
	header {
		height: 72px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 2.5rem;
		background: rgba(249, 249, 249, 0.92);
		backdrop-filter: blur(18px);
		border-bottom: 0;
		position: sticky;
		top: 0;
		z-index: 30;
	}

	.header-nav {
		display: flex;
		gap: 1.75rem;
	}

	.header-nav a {
		font-size: 0.85rem;
		color: #4a4a4a;
		text-decoration: none;
		position: relative;
		padding-bottom: 0.125rem;
	}

	.header-nav a.active {
		color: #b8002a;
		font-weight: 700;
	}

	.header-tools {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.icon-btn {
		background: transparent;
		border: none;
		color: #4a4a4a;
		font-size: 1.2rem;
		padding: 0.3rem;
	}

	.avatar {
		width: 40px;
		height: 40px;
		border-radius: 0;
		border: 2px solid rgba(0, 0, 0, 0.08);
		object-fit: cover;
	}

	@media (max-width: 1024px) {
		.header-nav {
			display: none;
		}

		header {
			padding-inline: 1.25rem;
		}
	}
</style>
