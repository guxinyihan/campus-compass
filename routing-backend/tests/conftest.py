import json
from copy import deepcopy
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from api.app import create_app
from api.campus import load_campus
from api.config import Settings

ROOT = Path(__file__).resolve().parents[2]
REQUEST = {
    "start": {"lat": 30.3529363, "lng": 76.3613209},
    "destination": {"lat": 30.352642, "lng": 76.370234},
    "profile": "walking",
}
NORMAL = {
    "paths": [
        {
            "distance": 120.0,
            "time": 90000,
            "points": {"coordinates": [[76.36, 30.352], [76.361, 30.353], [76.362, 30.354]]},
            "instructions": [
                {"text": "Continue", "distance": 80.0, "interval": [0, 1]},
                {"text": "Keep left onto campus road", "distance": 40, "interval": [1, 2]},
                {"text": "Arrive at destination", "distance": 0, "interval": [2, 2]},
            ],
        }
    ]
}


@pytest.fixture
def request_body():
    return deepcopy(REQUEST)


@pytest.fixture
def normal_payload():
    return deepcopy(NORMAL)


@pytest.fixture(scope="session")
def campus_data():
    return load_campus(ROOT / "data")


@pytest.fixture
def client_factory():
    clients = []

    def factory(handler=None):
        def default(request):
            if request.url.path == "/info":
                return httpx.Response(200, json={"profiles": [{"name": "walking"}]})
            return httpx.Response(200, json=NORMAL)

        client = TestClient(
            create_app(Settings(data_dir=ROOT / "data"), httpx.MockTransport(handler or default))
        )
        client.__enter__()
        clients.append(client)
        return client

    yield factory
    for client in clients:
        client.__exit__(None, None, None)


@pytest.fixture
def data_dir(tmp_path):
    (tmp_path / "campus.osm").write_bytes((ROOT / "data/campus.osm").read_bytes())
    (tmp_path / "campus.geojson").write_bytes((ROOT / "data/campus.geojson").read_bytes())
    return tmp_path


@pytest.fixture
def write_features(data_dir):
    def write(features):
        (data_dir / "campus.geojson").write_text(
            json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf-8"
        )
        return data_dir

    return write
