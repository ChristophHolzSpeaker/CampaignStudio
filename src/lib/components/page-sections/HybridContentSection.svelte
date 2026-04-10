<script lang="ts">
	import type { HybridContentSectionProps } from '$lib/page-builder/sections/types';

	let { props }: { props?: HybridContentSectionProps } = $props();
</script>

<!--desktop version-->
<!-- Strategy Content Section -->
<section class="py-24 lg:py-40" aria-label="Hybrid Content section">
	<div class="mx-auto max-w-7xl px-8">
		<div class="mb-32 grid items-end gap-16 lg:grid-cols-12">
			<div class="lg:col-span-8">
				<h2 class="mb-8 text-4xl font-bold tracking-tight lg:text-6xl">
					Bridging the AI-Workforce Gap
				</h2>
				<p class="text-2xl leading-relaxed text-secondary">
					Most talks stay in the abstract. Christoph translates complex algorithmic shifts into
					direct competitive advantages for your members.
				</p>
			</div>
			<div class="flex justify-start lg:col-span-4 lg:justify-end">
				<span class="mb-4 h-[2px] w-16 bg-primary lg:mb-0"></span>
			</div>
		</div>
		<!-- Bento Grid of Benefits -->
		<div class="grid gap-8 md:grid-cols-3">
			<div
				class="flex flex-col justify-between rounded-2xl bg-surface-container-lowest p-10 transition-colors duration-300 hover:bg-white"
			>
				<div>
					<span class="material-symbols-outlined mb-6 text-4xl text-primary">tune</span>
					<h3 class="mb-4 text-xl font-bold">Customizable content</h3>
					<p class="text-secondary">
						Every keynote is tailored to the specific regulatory and economic climate of your
						industry association.
					</p>
				</div>
			</div>
			<div class="bg-surface-container flex flex-col justify-between rounded-2xl p-10">
				<div>
					<span class="material-symbols-outlined mb-6 text-4xl text-primary">bolt</span>
					<h3 class="mb-4 text-xl font-bold">Actionable takeaways</h3>
					<p class="text-secondary">
						No vague promises. Attendees leave with a roadmap for 90-day implementation within their
						own firms.
					</p>
				</div>
			</div>
			<div
				class="flex flex-col justify-between rounded-2xl bg-surface-container-lowest p-10 transition-colors duration-300 hover:bg-white"
			>
				<div>
					<span class="material-symbols-outlined mb-6 text-4xl text-primary">analytics</span>
					<h3 class="mb-4 text-xl font-bold">Industry analysis</h3>
					<p class="text-secondary">
						Deep dives into sector-specific data that reveals hidden opportunities in the AI
						landscape.
					</p>
				</div>
			</div>
		</div>
	</div>
</section>
<!-- Deep Dive Section -->
<section class="relative overflow-hidden bg-on-surface py-24 text-surface lg:py-40">
	<div class="relative z-10 mx-auto max-w-7xl px-8">
		<div class="grid items-center gap-20 lg:grid-cols-2">
			<div>
				<h2 class="mb-12 text-4xl font-bold tracking-tight lg:text-6xl">
					Beyond Trends: The Operational Reality
				</h2>
				<div class="space-y-12">
					<div class="flex gap-6">
						<span class="font-label text-lg text-primary">01</span>
						<div>
							<h4 class="mb-2 text-2xl font-bold">Strategic Visioning</h4>
							<p class="text-surface-variant text-lg leading-relaxed">
								Aligning leadership on long-term technological trajectories beyond the current hype
								cycle.
							</p>
						</div>
					</div>
					<div class="flex gap-6">
						<span class="font-label text-lg text-primary">02</span>
						<div>
							<h4 class="mb-2 text-2xl font-bold">Implementation Readiness</h4>
							<p class="text-surface-variant text-lg leading-relaxed">
								Assessing cultural and technical friction points to ensure AI integration is smooth
								and profitable.
							</p>
						</div>
					</div>
				</div>
			</div>
			<div class="relative">
				<div
					class="bg-surface-container-highest/10 border-surface-variant/20 flex aspect-square items-center justify-center rounded-full border"
				>
					<div class="absolute h-3/4 w-3/4 rounded-full bg-primary/20 blur-3xl"></div>
					<div class="p-12 text-center">
						<span class="material-symbols-outlined mb-6 text-8xl text-primary" data-weight="fill"
							>hub</span
						>
						<p class="font-label text-sm tracking-widest text-primary uppercase">
							Neural Network Analysis
						</p>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
<!--/desktop version-->
<!--mobile version-->
<section class="space-y-12 bg-surface px-6 py-20">
	<div class="space-y-4">
		<h2
			class="border-l-4 border-primary pl-4 text-3xl leading-tight font-extrabold tracking-tighter"
		>
			Bridging the AI-Workforce Gap
		</h2>
	</div>
	<div class="space-y-6">
		<!-- Benefit Card 1 -->
		<div class="bg-surface-container-highest space-y-4 rounded-xl p-8">
			<div
				class="flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary shadow-sm"
			>
				<span class="material-symbols-outlined">tune</span>
			</div>
			<h3 class="text-xl font-bold tracking-tight">Customizable content</h3>
			<p class="leading-relaxed text-secondary">
				Every industry faces unique disruption. Keynotes are engineered to reflect your specific
				market dynamics and regulatory landscape.
			</p>
		</div>
		<!-- Benefit Card 2 -->
		<div class="border-outline-variant/10 space-y-4 rounded-xl border bg-white p-8 shadow-sm">
			<div
				class="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-low text-primary"
			>
				<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1">bolt</span
				>
			</div>
			<h3 class="text-xl font-bold tracking-tight">Actionable takeaways</h3>
			<p class="leading-relaxed text-secondary">
				Moving beyond theory to provide concrete frameworks your leadership team can implement the
				Monday after the event.
			</p>
		</div>
		<!-- Benefit Card 3 -->
		<div class="bg-surface-container-highest space-y-4 rounded-xl p-8">
			<div
				class="flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary shadow-sm"
			>
				<span class="material-symbols-outlined">analytics</span>
			</div>
			<h3 class="text-xl font-bold tracking-tight">Industry analysis</h3>
			<p class="leading-relaxed text-secondary">
				Data-driven insights that separate artificial hype from sustainable technological ROI in
				today's competitive climate.
			</p>
		</div>
	</div>
</section>
<!-- Deep Dive: Beyond Trends -->
<section class="overflow-hidden bg-on-surface px-6 py-20 text-surface">
	<div class="relative space-y-16">
		<div class="space-y-6">
			<h2 class="text-4xl leading-none font-extrabold tracking-tighter">
				Beyond Trends: The Operational Reality
			</h2>
			<p class="text-surface-dim/80 text-lg">
				The AI conversation has shifted from "if" to "how." Christoph Holz delivers the
				architectural blueprint for this transition.
			</p>
		</div>
		<div class="grid grid-cols-1 gap-12">
			<div class="group">
				<div class="font-label mb-4 text-4xl font-bold text-primary opacity-80">01</div>
				<h4 class="mb-4 text-2xl font-bold">Strategic Visioning</h4>
				<p class="text-surface-dim/70 leading-relaxed">
					Aligning C-suite expectations with technological feasibility to create long-term
					competitive advantages that scale.
				</p>
			</div>
			<div class="group">
				<div class="font-label mb-4 text-4xl font-bold text-primary opacity-80">02</div>
				<h4 class="mb-4 text-2xl font-bold">Implementation Readiness</h4>
				<p class="text-surface-dim/70 leading-relaxed">
					Assessing organizational culture and technical infrastructure to ensure AI integration is
					a success, not a friction point.
				</p>
			</div>
		</div>
	</div>
</section>
<!--/mobile version-->
