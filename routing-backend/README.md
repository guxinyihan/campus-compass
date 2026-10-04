# CampusCompass routing service

FastAPI validates the canonical campus dataset, owns its local POI search index,
calls GraphHopper asynchronously for walking routes and augments instructions
with deterministic nearby landmark cues. Shapely validates geometries and selects
interior POI anchors; Haversine supplies ground distances. No external geocoder,
GeoPandas, location database or blocking Requests client is used.

From this directory, with Python 3.12 or newer:

```sh
python -m venv .venv
# POSIX: source .venv/bin/activate
# PowerShell: .venv/Scripts/Activate.ps1
python -m pip install -r requirements-dev.txt
python -m pytest -q
python -m ruff check api tests
python -m ruff format --check api tests
python ../scripts/validate-campus-data.py
python -m uvicorn api.app:app --host 127.0.0.1 --port 5001 --no-access-log
```

`GRAPHHOPPER_BASE_URL` defaults to `http://localhost:8989` and must be the service
base URL (no `/route` suffix). `CAMPUS_DATA_DIR` defaults to the repository `data/`
regardless of working directory. `CORS_ORIGINS` is a comma-separated allowlist;
the default allows the Vite localhost/127.0.0.1 origins on 5173. Missing/invalid
campus data stops startup with a clear validation error. `/health` returns 503
until the walking engine is ready. `/live` reports process liveness.

Public endpoints are `/api/campus`, `/api/pois?q=library`, and `/api/routes`.
Route bodies use `{start:{lat,lng},destination:{lat,lng},profile:"walking"}`;
responses contain GeoJSON LineString geometry, `distanceMeters`,
`durationSeconds`, `profile`, and instructions with `point`, `text`,
`distanceMeters` and optional `landmark`. Errors use `{error:{code,message}}`.
See [algorithms and limitations](../docs/ROUTING_AND_POI_ALGORITHMS.md) for ranking,
bounds, timeouts, landmark selection and safe engine failure mapping.

The root Compose build uses `Dockerfile` and `graphhopper/Dockerfile`, both with
repository-root build context. Java 21/GraphHopper 10.2 imports `data/campus.osm`
through `graphhopper/config.yml`. The official jar is SHA-256 verified. The API
data mount is read-only; the generated graph has a named volume. Rebuild that
volume when the OSM input or encoded profile changes. The profile uses ordinary
`foot.json`; wheelchair suitability has not been validated.

Tests use MockTransport and do not establish live integration. Native engine
tests and actual container acceptance are separate evidence. Full service setup
and current release gates are documented at the repository root.

Application code remains MIT, map data ODbL, GraphHopper Apache 2.0.
See [data provenance](../docs/DATA_LICENSE_AND_PROVENANCE.md).
