<script lang="ts">
	import type { ProofOfPerformanceProps, TestimonialItem } from '$lib/page-builder/sections/types';

	let { props }: { props?: ProofOfPerformanceProps } = $props();

	const fallbackTestimonials: TestimonialItem[] = [
		{
			quote:
				"Christoph didn't just talk about the future; he made us feel like we were already there. Our members were energized and, more importantly, prepared.",
			name: 'Alex Morgan',
			role: 'Director',
			company: 'Innovation Alliance',
			photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
			photoAlt: 'Portrait of Alex Morgan',
			rating: 5,
			featured: true
		},
		{
			quote:
				'A surgical approach to tech speaking. No fluff, just pure strategic value that resonated with every CEO in the room.',
			name: 'Jordan Reyes',
			role: 'VP',
			company: 'Global Retail Forum',
			photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
			photoAlt: 'Portrait of Jordan Reyes',
			rating: 5
		}
	];

	const title = $derived(props?.title ?? 'What organizers say after the keynote');
	const testimonials = $derived(
		props?.testimonials?.length ? props.testimonials : fallbackTestimonials
	);
	const leadTestimonial = $derived(
		testimonials.find((testimonial) => testimonial.featured) ?? testimonials[0]
	);
	const supportingTestimonials = $derived(
		testimonials.filter((testimonial) => testimonial !== leadTestimonial)
	);

	const stars = (rating?: number) => (rating ? '★'.repeat(rating) : '');
</script>

<section
	class="bg-surface-container-low px-6 py-20 sm:px-8 lg:px-12 lg:py-28"
	aria-label="Proof of Performance section"
>
	<div class="mx-auto max-w-7xl">
		<h2 class="mb-20 text-4xl leading-[0.95] font-bold tracking-tight text-on-surface lg:text-6xl">
			{title}
		</h2>

		{#if leadTestimonial}
			<article class=" relative mb-8 bg-surface p-8 lg:mb-10 lg:p-12">
				<span class="absolute -top-5 left-6 text-5xl text-primary/15 lg:left-8 lg:text-6xl">“</span>
				<blockquote class="relative z-10">
					<p class="mb-8 text-xl leading-snug font-medium text-on-surface lg:text-2xl">
						{leadTestimonial.quote}
					</p>
					<footer class="flex flex-col justify-between gap-4 md:flex-row md:items-center">
						<div class="flex flex-col gap-4 md:flex-row md:items-center">
							<div class="h-12 w-12 overflow-hidden rounded-full lg:h-14 lg:w-14">
								<img
									src={leadTestimonial.photoUrl}
									alt={leadTestimonial.photoAlt}
									class="h-full w-full object-cover"
								/>
							</div>
							<div>
								<cite class="block font-bold text-on-surface not-italic"
									>{leadTestimonial.name}</cite
								>
								<span class="text-xs tracking-[0.12em] text-on-surface/65 uppercase">
									{leadTestimonial.role}, {leadTestimonial.company}
								</span>
							</div>
						</div>
						{#if leadTestimonial.rating}
							<p class="text-sm tracking-[0.18em] text-primary">{stars(leadTestimonial.rating)}</p>
						{/if}
					</footer>
				</blockquote>
			</article>
		{/if}

		{#if supportingTestimonials.length > 0}
			<div class="grid gap-6 lg:grid-cols-2 lg:gap-8">
				{#each supportingTestimonials as testimonial (`testimonial-${testimonial.name}-${testimonial.company}`)}
					<article class=" relative bg-surface p-8">
						<span class="absolute -top-4 left-6 text-4xl text-primary/12">“</span>
						<blockquote class="relative z-10">
							<p class="mb-6 text-lg leading-relaxed font-medium text-on-surface">
								{testimonial.quote}
							</p>
							<footer class="flex flex-col justify-between gap-4 md:flex-row md:items-center">
								<div class="flex flex-col gap-3 md:flex-row md:items-center">
									<div class="h-11 w-11 overflow-hidden rounded-full">
										<img
											src={testimonial.photoUrl}
											alt={testimonial.photoAlt}
											class="h-full w-full object-cover"
										/>
									</div>
									<div>
										<cite class="block font-bold text-on-surface not-italic"
											>{testimonial.name}</cite
										>
										<span class="text-xs tracking-widest text-on-surface/65 uppercase">
											{testimonial.role}, {testimonial.company}
										</span>
									</div>
								</div>
								{#if testimonial.rating}
									<p class="text-sm tracking-[0.18em] text-primary">{stars(testimonial.rating)}</p>
								{/if}
							</footer>
						</blockquote>
					</article>
				{/each}
			</div>
		{/if}
	</div>
</section>
