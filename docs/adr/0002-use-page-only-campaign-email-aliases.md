---
status: accepted
---

# Use page-only aliases for Campaign Studio email replies

Campaign Studio mail links use `speakerlp+{campaignPageId}@christophholz.com` so inbound replies can resolve the campaign and page from one durable ID while keeping the public address compact. Because the address does not carry experiment and variant IDs, an inbound email reply is not classified as an experiment conversion unless another deterministic source supplies both IDs; the system must not infer experiment attribution from the campaign page alone.
