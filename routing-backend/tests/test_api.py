import asyncio
import json

import httpx
import pytest

from api.config import BOUNDS


def test_route_contract_and_engine_coordinate_order(client_factory, request_body, normal_payload):
    seen = []

    def handler(request):
        seen.append(json.loads(request.content))
        return httpx.Response(200, json=normal_payload)

    response = client_factory(handler).post("/api/routes", json=request_body)
    assert response.status_code == 200
    result = response.json()
    assert result["geometry"] == {
        "type": "LineString",
        "coordinates": normal_payload["paths"][0]["points"]["coordinates"],
    }
    assert result["distanceMeters"] == 120
    assert result["durationSeconds"] == 90
    assert result["profile"] == "walking"
    assert len(result["instructions"]) == 3
    assert result["instructions"][0]["point"] == {"lat": 30.352, "lng": 76.36}
    assert result["instructions"][1]["text"].startswith("Keep left onto campus road")
    assert "Unknown Landmark" not in response.text
    assert seen == [
        {
            "points": [[76.3613209, 30.3529363], [76.370234, 30.352642]],
            "profile": "walking",
            "instructions": True,
            "locale": "en",
            "points_encoded": False,
            "snap_preventions": ["ferry"],
        }
    ]


@pytest.mark.parametrize(
    "change",
    [
        {"start": {"lat": 0, "lng": 0}},
        {"start": {"lat": 91, "lng": 76.36}},
        {"destination": {"lat": 30.35, "lng": 181}},
        {"start": {"lat": 30.35, "lng": 76.0}},
        {"start": {"lat": "30.352", "lng": 76.36}},
        {"start": {"lat": True, "lng": 76.36}},
        {"start": {}},
        {"destination": []},
        {"profile": "wheelchair"},
        {"profile": "car"},
        {"secret": "unexpected"},
        {"start": {"lat": 30.352, "lng": 76.36, "accuracy": 10}},
    ],
)
def test_invalid_request_never_contacts_engine(client_factory, request_body, change):
    def unreachable(_request):
        pytest.fail("invalid request reached the engine")

    request_body.update(change)
    response = client_factory(unreachable).post("/api/routes", json=request_body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_REQUEST"
    assert "secret" not in response.text


@pytest.mark.parametrize("raw", ['{"start":{"lat":NaN,"lng":76.36}}', "not JSON"])
def test_malformed_json_is_safe(client_factory, raw):
    response = client_factory().post(
        "/api/routes", content=raw, headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


@pytest.mark.parametrize(
    "status,payload,expected_status,code",
    [
        (
            400,
            {
                "hints": [
                    {"details": "com.graphhopper.util.exceptions.ConnectionNotFoundException"}
                ],
                "message": "internal-host secret",
            },
            404,
            "ROUTE_NOT_FOUND",
        ),
        (
            400,
            {"hints": [{"details": "com.graphhopper.util.exceptions.PointNotFoundException"}]},
            422,
            "ROUTE_POINT_UNAVAILABLE",
        ),
        (
            400,
            {"hints": [{"details": "com.graphhopper.util.exceptions.PointOutOfBoundsException"}]},
            422,
            "ROUTE_POINT_UNAVAILABLE",
        ),
        (400, {"message": "secret untrusted raw message"}, 502, "ROUTING_ENGINE_REJECTED"),
        (500, {"message": "secret internal stack trace"}, 503, "ROUTING_ENGINE_UNAVAILABLE"),
        (503, {}, 503, "ROUTING_ENGINE_UNAVAILABLE"),
        (200, {"paths": []}, 404, "ROUTE_NOT_FOUND"),
        (200, {}, 502, "MALFORMED_ROUTE"),
        (200, [], 502, "MALFORMED_ROUTE"),
    ],
)
def test_engine_errors_are_safe(
    client_factory, request_body, status, payload, expected_status, code
):
    response = client_factory(lambda _: httpx.Response(status, json=payload)).post(
        "/api/routes", json=request_body
    )
    assert response.status_code == expected_status
    assert response.json()["error"]["code"] == code
    assert "secret" not in response.text and "internal" not in response.text


@pytest.mark.parametrize(
    "error,status,code",
    [
        (httpx.ConnectTimeout, 504, "ROUTING_TIMEOUT"),
        (httpx.ReadTimeout, 504, "ROUTING_TIMEOUT"),
        (httpx.ConnectError, 503, "ROUTING_ENGINE_UNAVAILABLE"),
    ],
)
def test_transport_failures(client_factory, request_body, error, status, code):
    def handler(request):
        raise error("secret internal-host detail", request=request)

    response = client_factory(handler).post("/api/routes", json=request_body)
    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    assert "secret" not in response.text


def test_invalid_engine_json(client_factory, request_body):
    response = client_factory(lambda _: httpx.Response(200, content=b"not JSON")).post(
        "/api/routes", json=request_body
    )
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "MALFORMED_ROUTE"


def test_anonymous_canonical_data_and_search(client_factory):
    client = client_factory()
    data = client.get("/api/campus").json()
    assert data["type"] == "FeatureCollection" and len(data["features"]) == 395
    assert data["bounds"] == BOUNDS
    assert data["profiles"] == ["walking"]
    assert data["attribution"]["license"] == "ODbL-1.0"
    result = client.get("/api/pois", params={"q": "LiBrArY"}).json()
    assert result["total"] == 1
    assert result["pois"][0]["name"] == "Nava Nalanda Library"
    assert result["pois"][0]["category"] == "library"
    assert client.get("/api/pois").json()["total"] == 106
    assert client.get("/api/pois", params={"q": "nothing-like-this-campus-poi"}).json() == {
        "pois": [],
        "total": 0,
    }
    assert client.get("/api/pois", params={"q": "x" * 121}).status_code == 422
    assert client.get("/api/pois", params={"limit": 201}).status_code == 422


@pytest.mark.parametrize("payload", [{}, {"profiles": [{"name": "car"}]}, {"profiles": None}, []])
def test_health_requires_walking_engine(client_factory, payload):
    client = client_factory(lambda _: httpx.Response(200, json=payload))
    assert client.get("/live").status_code == 200
    response = client.get("/health")
    assert response.status_code == 503
    assert response.json()["dependencies"]["graphhopper"] == "unavailable"


def test_health_and_exact_cors_origin(client_factory):
    client = client_factory()
    assert client.get("/health").status_code == 200
    allowed = client.options(
        "/api/routes",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    denied = client.options(
        "/api/routes",
        headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in denied.headers
    assert client.get("/route_instructions").json()["error"]["code"] == "NOT_FOUND"


def test_async_engine_requests_do_not_block_event_loop(request_body):
    from api.graphhopper import GraphHopperClient
    from api.models import RouteRequest

    async def exercise():
        entered = 0
        both_entered = asyncio.Event()

        async def transport(_request):
            nonlocal entered
            entered += 1
            if entered == 2:
                both_entered.set()
            await asyncio.wait_for(both_entered.wait(), timeout=1)
            return httpx.Response(200, json={"paths": []})

        async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
            engine = GraphHopperClient("http://engine", client)
            await asyncio.gather(
                engine.route(RouteRequest(**request_body)),
                engine.route(RouteRequest(**request_body)),
            )
        assert entered == 2

    asyncio.run(exercise())


def test_overall_deadline_bounds_a_stalled_engine(client_factory, request_body, monkeypatch):
    import api.graphhopper as graphhopper

    monkeypatch.setattr(graphhopper, "ROUTE_TIMEOUT_SECONDS", 0.02)

    async def stalled(_request):
        await asyncio.Event().wait()

    response = client_factory(stalled).post("/api/routes", json=request_body)
    assert response.status_code == 504
    assert response.json()["error"]["code"] == "ROUTING_TIMEOUT"
