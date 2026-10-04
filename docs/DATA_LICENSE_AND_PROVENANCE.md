# Campus map data, code licensing and provenance

Audit date: 2026-10-04. Source inspected: MapMitra commit `1d5420787b2f5a7a42b2a9ce17792ed7f97149fc`. Root `LICENSE` remains the canonical MIT **software** license with `Copyright (c) 2024 Yash Dogra`. This does not relicense map databases or dependencies.

## Audited original files

The following SHA-256 values describe the audited **Windows checkout bytes**
(CRLF, produced by `core.autocrlf=true`), not the original LF Git blobs. The
canonical files preserve those audited bytes; narrowly scoped `.gitattributes`
entries disable newline conversion for them so their hashes stay identical on
Windows/Linux checkouts and in container build contexts.

| File | Evidence and origin | SHA-256 |
| --- | --- | --- |
| `routing-backend/graphhopper/thapar_map.osm` | OSM XML 0.6; `openstreetmap-cgimap 2.0.1` generator; explicit OpenStreetMap/contributors copyright, attribution URL and ODbL URL. 4,100 nodes, 455 ways, 10 relations. | `b3857f0c38c2fb481626e86fe086df1edd2b3f1f41469bc91dc060817f430230` |
| `routing-backend/api/thaparMap.geojson` | JOSM FeatureCollection; 389 features, 101 named features; all 3,437 unique coordinate pairs exactly match OSM nodes in the accompanying XML. Strong evidence of OSM derivation. | `2e3c22d67753644cf20d28a2561b023231d9a2658d77a0f708f5afa5aeb52888` |
| `frontend/public/thaparMap.geojson` | JOSM FeatureCollection; 395 features, 106 named features; all 3,465 unique coordinate pairs exactly match OSM nodes. Strong evidence of OSM derivation. | `ebfd58f3ad294ed358069f37448e98772d0b753e6c99d0366cf4e4b80ad3df3c` |

All three enter the currently retained file history in `df8d9e5` (2024-12-22, "Add files via upload"). Git does not document the original export command, extraction date, edits, contributor permissions for local additions, or a campus survey. OSM object timestamps span 2011-02-09 through 2024-12-04; those are object edit timestamps, **not** a certified extraction date or evidence that the map is currently accurate. A `source=Local Knowledge` feature remains OSM-derived; that tag does not grant separate ownership.

For exact historical comparison, the foundation commit's LF Git blob SHA-256
values are OSM `fdbe61816da20503ba94bda963e91919d1496e4c936b718efdb49bad6f9e6be2`,
API GeoJSON `d5ccc6635e57f8c51ffd2e14ef490005c2c8b76dd9e383882608073bd9c63302`,
frontend GeoJSON `ec8d090c82b12ffa174276d9f9b2ac31a49ff24d2b295e50e4fd4824c5bc25a2`.
The newline difference does not change geometry, properties or licensing.

The XML's declared extract envelope is latitude 30.35012–30.35864, longitude 76.35846–76.37395. Complete OSM ways include nodes outside it; actual node bounds are latitude 30.3474352–30.3632701, longitude 76.3500425–76.3951185. GeoJSON declared bounds are longitude 76.3582–76.37429, latitude 30.3501–30.3588. Do not mistake extract bounds for a surveyed campus boundary.

## The GeoJSON copies differ materially

Comparing features by exact geometry, the frontend includes six additional features: a service road, three Inter Tower Path bridge segments, a hospital point, and the university polygon. Five shared features have different properties: Open Air Theatre/OAT naming, Shadowz/Fashion Point naming, G Block canteen spacing, Shiv Mandir amenity classification, and Fete Area amenity classification. The API copy is therefore not interchangeable with the frontend copy. All geometries in both copies passed Shapely validity checking in the audit environment.

CampusCompass now retains the richer frontend GeoJSON as `data/campus.geojson` and the XML as `data/campus.osm`, byte-for-byte with the hashes above. The two divergent original GeoJSON paths and original OSM path are removed from the active tree. The routing service validates this canonical dataset and derives the single POI index in memory; the frontend obtains campus geometries and POI results through its APIs. The historical copies remain in Git. No map coordinate or property was changed during this migration. Future data transformations must be explicit and deterministic and update provenance and hashes.

## Data redistribution and attribution

Treat the XML and both GeoJSON exports as OpenStreetMap-derived data under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), not MIT. Preserve original notices. Redistributed data needs attribution and the license or its link. Publicly used derivative databases must remain under permitted share-alike terms; when applicable, offer a machine-readable database or complete alterations/method free online (sections 4.2, 4.4 and 4.6). This repository supplies the extract and transformation source. Map images and individual route output are distinct from the database; producing an output alone does not automatically relicense application source code (section 4.5).

The application must visibly credit **© OpenStreetMap contributors**, link to [OpenStreetMap copyright and licensing](https://www.openstreetmap.org/copyright), and make data-license details easy to find. OSMF guidance covers database, interactive map, search and routing attribution separately. Preserve readable attribution in screenshots as well. See [OSMF attribution guidance](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines).

## Tiles and geocoding are separate services

OpenStreetMap database availability does not confer unrestricted use of OSMF infrastructure. Raster tiles remain an internet dependency. Follow the [OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/), including attribution, normal caching and avoiding bulk/offline downloading; use a suitable tile provider for a deployment beyond this local demonstration.

Public OSMF Nominatim forbids client autocomplete. Upstream's per-keystroke calls are not acceptable; campus search must use the local POI index. See the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/).

## GraphHopper and package metadata

GraphHopper is separately licensed under [Apache 2.0](https://github.com/graphhopper/graphhopper/blob/10.0/LICENSE.txt). Retain dependency licenses and notices when redistributing its jar/container; do not describe GraphHopper as MIT. The upstream image `israelhikingmap/graphhopper:10.0` is a third-party packaging dependency, not proof of routing correctness.

`backend/package.json` has `license: ISC`, empty author/description/keywords, and no separate backend license or ISC grant. The same metadata appears in initial backend upload `0661241` and later reuploads. Root history starts with MIT (`196296a`) and later corrects the copyright spelling to Yash Dogra (`7af0efb`). Evidence supports stale default npm metadata, not a second licensor; aligning the package declaration with root MIT is the chosen correction. The historical inconsistency is documented here instead of silently inventing ownership.

## Remaining provenance limits

The campus dataset is inherited; CampusCompass does not claim to have surveyed or originally authored it. No verified export recipe or campus authority validation was found. Geometry validity does not prove factual correctness, walkability, accessibility, current opening hours or permission to enter a site. Attribution and ODbL terms apply to future data changes as well as this extract.
