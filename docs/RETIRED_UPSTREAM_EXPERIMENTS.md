# Retired upstream experiments

Immutable foundation: `1d5420787b2f5a7a42b2a9ce17792ed7f97149fc` from
https://github.com/yxshee/mapmitra. Git history is preserved; use
`git show <foundation>:<path>` to inspect old source or documentation.

- Quinjet's unauthenticated HTTP ride matching, broken accept/decline lifecycle,
  unused MySQL helper and disabled queue worker were replaced by dedicated Go
  latest-position tracking. CampusCompass does not offer ride booking/matching.
- frontend/mockbackend, hardcoded nearby vehicle records and httpbin effect
  were removed. Simulated vehicles now publish through the real authenticated
  API and display a simulation label.
- Public Nominatim autocomplete was removed; campus-sized POIs use canonical
  local data and deterministic ranking.
- Incomplete Google OAuth/Firebase-style callbacks, Passport sessions, raw
  refresh storage and inconsistent user/token imports were replaced by one
  tested local authentication design.
- Road-drawing submission to an unrelated host, placeholder admin sections,
  recommendations, emergency claims and unsupported accessibility claims were
  removed. Real notices inform visitors without modifying GraphHopper roads.
- The four large upstream documentation index/quick-start/project/technology
  documents were removed from the active tree because they advertise APIs and
  integration absent from source. Their introduced claims and immutable file
  references remain in UPSTREAM_DELTA and ARCHITECTURE_REALITY_AUDIT.

This is explicit scope reduction, not a claim to have finished those upstream
experiments. The inherited React/Leaflet/campus-data/GraphHopper/landmark concepts
and original MIT attribution remain acknowledged.
