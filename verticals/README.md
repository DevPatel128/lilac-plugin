# Vertical packs

A vertical pack adds vertical depth to a build: up to 3 extra brief questions, default requirements, integrations with fallbacks, blocks, tests and a rights note. Copy `_template/` to start one. Check with `node scripts/packs.mjs validate <pack>`.

Built: none yet in this file's scope (see folders next to it). Everything in the table below is **not built**: a stub with proposed signature features and rights flags, to be researched first (`last_verified` and `expires` are required before a pack ships).

| Vertical | Proposed signature feature | Rights flags | Status |
|---|---|---|---|
| restaurant | Menu with allergens, table booking | Allergen law, photo rights | not built |
| e-commerce | Catalogue, cart, checkout | Consumer law, tax, payment terms | not built |
| photographer | Gallery with client proofing | Image licensing, model releases | not built |
| fitness | Class schedule and booking | Health claims, waivers | not built |
| SaaS | Pricing page, docs, changelog | Terms, privacy, data processing | not built |
| real estate | Listings with search and enquiry | Listing data licence, fair-housing rules | not built |
| events | Ticketed schedule and speakers | Ticketing terms, speaker consent | not built |
| podcast | Episode player and feed | Music and guest rights | not built |
| hotel | Rooms and availability enquiry | Booking terms, data protection | not built |
| clinic | Services and appointment request | Health data, advertising rules | not built |
| nonprofit | Donation flow and impact report | Charity registration, donor data | not built |
| architecture | Project case studies | Client and image permissions | not built |
| automotive | Inventory and test-drive request | Finance advertising, listing data | not built |
| fashion | Lookbook and drops | Image and model rights, returns law | not built |

Demand: `node scripts/packs.mjs demand <vertical>` logs interest locally in `.lilac/pack-demand.json`. Nothing is sent anywhere; sharing is opt-in and not built.
