---
status: accepted
---

# Identify experiment conversions by experiment and variant IDs

Experiment-related conversions are attributed with explicit experiment and variant IDs rather than reusable labels such as `A` and `B`. Labels are meaningful only within one experiment and previously caused a conversion to be credited to every experiment sharing the label; durable IDs preserve experiment boundaries and keep completed analytics from changing when later experiments reuse familiar variant names.

## Consequences

Conversion events that claim experiment attribution carry both IDs and analytics group by them. Events without both IDs remain unattributed to an experiment rather than being inferred from a reusable label or campaign page. The completed CTA experiment is frozen at its retirement cutoff using its legacy, label-based data; historical rows are not assigned inferred IDs because the available visitor and session clues cannot prove attribution.
