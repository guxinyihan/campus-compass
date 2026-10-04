# Routing, search and landmark algorithms

The routing service owns `data/campus.geojson` and derives its only POI index at
startup. The browser retrieves search results from `/api/pois`; `/api/campus`
serves the same source's geometries and license metadata. No public geocoder is
called. Startup requires valid GeoJSON/Shapely geometries, finite two-dimensional
coordinates inside the service boundary, at least one named POI, and OSM XML with
geographically valid nodes, highway ways and complete way-node references.
Duplicate normalized names are reported and remain separate search results.

## Search

1. Apply Unicode NFKC normalization, lowercase using casefold, replace punctuation
   with spaces, and collapse whitespace to both query and labels.
2. Labels consist of the feature name and existing `name:en`, `alt_name`,
   `short_name`, `loc_name` and `old_name` aliases. Semicolon aliases are split.
3. Score exact match 0, full-label prefix 1, prefix at a word boundary 2, substring
   3. Use the best label score; omit non-matches.
4. Sort by score, normalized primary name and stable feature ID. Empty queries
   return alphabetical results. Limits truncate results after ranking; `total`
   reports the count before truncation. Maximum query length is 120 and maximum
   result limit is 200 (default 200; current index has 106 records).

IDs are the first 16 hexadecimal characters of SHA-256 over canonical sorted
feature JSON, prefixed `poi-`; identical named features fail validation. Points
use their coordinates, line features use a midpoint, and polygons use an interior
representative point so anchors do not fall into holes. Building anchors are not
verified entrances. A `building=yes` category is displayed as `building`.

The bounded campus-size index makes a linear scan practical; no external search
service or fuzzy/AI ranking is needed. Rankings are deterministic and unit tested.

## Walking routes

`POST /api/routes` accepts named `{lat,lng}` points and `profile:"walking"`.
Numeric strings, booleans, unknown fields, non-finite coordinates and other
profiles are rejected. Both geographic range and service bounds are checked:
latitude 30.3491–30.3598, longitude 76.3572–76.37529. This is the inherited GeoJSON
declared envelope plus 0.001 degrees (roughly 100 m) on each side, not a surveyed
property boundary. Visitor coordinates are used for this explicit request only;
the routing API has no location persistence and its runtime disables access logs.

The HTTPX async client posts `[longitude,latitude]` points to internal GraphHopper
profile `walking`. Connect/pool timeout is 2 s, write 5 s, read 10 s; the entire
request has a 12 s deadline. GraphHopper itself has an 8 s routing budget. Engine
redirects are not followed. The output preserves LineString coordinate order,
distance in meters and converts GraphHopper milliseconds to seconds. Instruction
points use the start of each interval, where the maneuver begins. Malformed
measurements, missing paths/geometry/instructions and invalid intervals are rejected.

Engine connection failures/5xx yield 503, timeouts 504, no-route errors 404,
unconnectable/out-of-bounds engine points 422, and invalid JSON/payloads or other
engine rejections 502. Public errors use `{error:{code,message}}`; internal engine
text and exception strings are never copied. `/health` checks that `/info` responds
with the walking profile and returns 503 otherwise; `/live` checks process liveness.

## Landmark cues

For each maneuver point, compute Haversine distance to named landmark anchors
with mean Earth radius 6,371,008.8 m. This estimates ground distance and avoids the
roughly 16% Web Mercator scale inflation at campus latitude. Use the nearest anchor
within **45 m**, tie-breaking by lowercase name then ID. Named roads, barriers and
university-area features are excluded as landmark cues. Landmark matches append
`(near Name).` and retain GraphHopper's original maneuver, so proximity does not
invent a turn, destination entrance, route through a building, or direction toward
a landmark. No match preserves the original wording exactly.

These are simple spatial cues rather than perception or a surveyed entrance
model. Large buildings may have no nearby anchor at a real entrance. The inherited
data and pedestrian profile do not validate wheelchair suitability, accessibility,
current construction or restricted entry. Duration is estimated walking time;
no ETA accuracy percentage is claimed.

## Engine build and verification boundary

The Dockerfile uses Java 21 and the official GraphHopper 10.2 release jar, verified
against SHA-256 `ead763749c395ea0cc45b3fd10092d6de84d62fb5cbaf7d416ba6cc142c5716c`.
The walking profile uses the release's `foot.json` without an elevation provider.
Small graph components are retained; disconnected points receive no-route errors.
Database input mounts read-only at `/data`, generated graph files use `/graph-cache`.
The API and engine run as separate non-root users.

Configuration derives from the official [GraphHopper 10.2 example](https://github.com/graphhopper/graphhopper/blob/10.2/config-example.yml)
and [foot model](https://github.com/graphhopper/graphhopper/blob/10.2/core/src/main/resources/com/graphhopper/custom_models/foot.json).
GraphHopper is Apache 2.0; map data remains ODbL and code MIT.

`pytest` fixtures use HTTPX MockTransport and never require a live engine. These
verify domain behavior and safe failures; they cannot prove OSM import or engine
integration. Run the separate native/container acceptance checks against two
known campus points and require non-empty geometry, positive measurements and
instructions. Native evidence must be labeled separately from the mandatory
container acceptance gate.
