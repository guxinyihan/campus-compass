# Canonical campus database

`campus.geojson` is the richer 395-feature frontend JOSM export inherited from
MapMitra `1d5420787b2f5a7a42b2a9ce17792ed7f97149fc`, copied without modifying its
bytes. SHA-256: `ebfd58f3ad294ed358069f37448e98772d0b753e6c99d0366cf4e4b80ad3df3c`.
`campus.osm` is the accompanying XML extract, also unchanged; SHA-256:
`b3857f0c38c2fb481626e86fe086df1edd2b3f1f41469bc91dc060817f430230`.
These are the audited Windows checkout bytes, including CRLF newlines;
`.gitattributes` preserves them across platforms. The original LF Git blob hashes
are recorded separately in the detailed provenance document.

© OpenStreetMap contributors. These databases are under
[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), with
[OSM attribution](https://www.openstreetmap.org/copyright), separately from the
MIT application code. Original XML copyright/license attributes are preserved.
Export date and campus survey provenance remain unknown.

The routing API validates these files on startup and derives the single POI
index in memory. Polygon POIs use an interior representative point; linear POIs
use a midpoint. These points are search anchors, not verified building entrances.
Stable IDs hash canonical feature JSON. Aliases use existing OSM naming tags;
duplicate names retain separate IDs and are reported rather than silently merged.
No generated frontend copy or independent search index is shipped.

Run `python scripts/validate-campus-data.py` after installing routing requirements.
The original GeoJSON's declared bounds plus 0.001 degrees on each side define
service limits (latitude 30.3491–30.3598, longitude 76.3572–76.37529). These limits
do not certify campus property borders. The full OSM extract has additional nodes
outside them to preserve complete roads; the validator permits those OSM nodes
while enforcing geographic ranges and all way references.

See [detailed provenance](../docs/DATA_LICENSE_AND_PROVENANCE.md).
