# Campaign Studio

Campaign Studio creates controlled, campaign-specific landing pages and measures how those pages turn visitors into leads.

## Language

**Experiment**:
A time-bounded comparison of landing-page experiences intended to inform a product-owner decision.
_Avoid_: Test campaign, automatic optimization

**Control**:
The established landing-page experience against which an experiment compares a change.
_Avoid_: Default variant, old version

**Treatment**:
The changed landing-page experience being compared with the control.
_Avoid_: Winner, new default

**Assignment**:
The persistent allocation of an eligible visitor to one experiment variant.
_Avoid_: Exposure, impression

**Exposure**:
An eligible visit on which the visitor's assigned experiment variant is rendered, whether or not every external asset loads successfully.
_Avoid_: Assignment, successful playback

**Conversion**:
A lead-created outcome attributed to the visitor's assigned experiment and variant.
_Avoid_: CTA click, engagement

**Diagnostic event**:
A supporting observation, such as a CTA click or video playback error, that helps explain experiment performance but does not select the winner.
_Avoid_: Conversion, goal event
