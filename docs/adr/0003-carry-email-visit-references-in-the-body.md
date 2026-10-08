---
status: accepted
---

# Carry email visit references in the prefilled body

Keep the page-only `speakerlp+{campaignPageId}@christophholz.com` recipient from ADR-0002. Christoph accepts this short alias but does not want visitor tokens appended to the address.

Campaign Studio, rather than artifact authors, adds a short opaque visit reference to mailto bodies at runtime. The worker links it only to a recorded visit in the alias's campaign/page. Address-copy actions stay address-only and provide campaign attribution without guaranteed ad attribution. Deleted, unknown or conflicting references never trigger a guessed visitor match.

This extends ADR-0002 with optional visit provenance; it does not infer experiment or variant identity from the page alias.
