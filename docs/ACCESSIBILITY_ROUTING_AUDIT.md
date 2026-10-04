# Physical accessibility routing audit

Audit date: 2026-10-04. Source inspected: MapMitra `1d5420787b2f5a7a42b2a9ce17792ed7f97149fc`.

**Conclusion: wheelchair/accessibility routing is unsupported. Release scope is ordinary walking routing only.** UI accessibility and physical route accessibility are different concerns. Keyboard support, labels and legibility cannot prove a physical path is suitable for a wheelchair.

## Data evidence

Counts below are elements/features carrying the exact tag, not percentages of surveyed pedestrian infrastructure. OSM XML includes 4,565 node/way/relation elements; API GeoJSON has 389 features; frontend GeoJSON has 395 features.

| Tag | OSM XML | API GeoJSON | Frontend GeoJSON |
| --- | ---: | ---: | ---: |
| `wheelchair` | 0 | 0 | 0 |
| `highway` | 202 | 126 | 130 |
| `highway=steps` | 0 | 0 | 0 |
| `foot` (`yes`) | 36 | 36 | 36 |
| `surface` | 108 | 86 | 89 |
| `smoothness` | 0 | 0 | 0 |
| `incline` (`0`) | 4 | 1 | 4 |
| `kerb` | 0 | 0 | 0 |
| `steps` | 0 | 0 | 0 |
| `ramp` | 0 | 0 | 0 |

XML surface values are asphalt (9), paved (93), grass (1), concrete (5). GeoJSON mainly contains paved paths. Four mapped zero-incline bridge segments do not establish incline coverage across the network. There is no trustworthy evidence about kerb heights, usable width, ramps, entrances, elevator access, obstructions or consistent step mapping. **Absence of a steps tag is unknown data, not proof of a step-free path.** The local dataset has no accessibility survey timestamp or test route evaluated by campus accessibility users.

## Routing profile evidence

`routing-backend/graphhopper/config.yml` defines `car` and `foot`; CH preparation is for `foot`. It uses `foot.json` and `foot_elevation.json` and encodes pedestrian speed/priority/access, hiking/mountain-bike ratings and average slope. It has no wheelchair profile, no wheelchair-specific encoded access, and no kerb/smoothness constraint. Elevation provider is commented out. `routing-backend/api/app.py` always requests `profile: foot`. There is no accessible-route request model, alternate output, fixture, measured evaluation or route that demonstrably avoids an inaccessible segment.

The official [GraphHopper 10 foot model](https://github.com/graphhopper/graphhopper/blob/10.0/core/src/main/resources/com/graphhopper/custom_models/foot.json) models pedestrian access, speeds and hiking suitability. A normal foot profile must not be advertised as a wheelchair profile. GraphHopper's [profile configuration](https://github.com/graphhopper/graphhopper/blob/10.0/docs/core/profiles.md) permits custom profiles, but an implementation still needs reliable data and evidence that the resulting route materially follows the intended constraints.

## Release decision

- Expose `walking` as the single supported navigation profile.
- Reject unsupported accessibility/wheelchair profile requests rather than silently returning a foot route.
- Describe duration as estimated walking time; neither wheelchair suitability nor 90% ETA accuracy is claimed.
- Keep a clear UI/README limitation: physical route accessibility has not been validated.
- Roadmap: audited accessibility map data and a separately evaluated profile, including width, slope, surface, kerbs, steps, ramps and entrance coverage; field checks with appropriate campus stakeholders; regression cases where routes differ.

Map-data provenance and ODbL obligations are described in [DATA_LICENSE_AND_PROVENANCE.md](DATA_LICENSE_AND_PROVENANCE.md). This audit is an engineering assessment of available evidence, not a certification of campus accessibility.
