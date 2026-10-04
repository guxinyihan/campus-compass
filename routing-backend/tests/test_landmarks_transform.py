import pytest

from api.campus import POI, CampusData
from api.errors import RoutingError
from api.landmarks import haversine, nearest_landmark
from api.models import Coordinate
from api.transform import transform_route


def landmark(name="Library", lat=30.352, lng=76.36, id="a"):
    return POI(id, name, (), "library", lat, lng, True)


def test_haversine_known_ground_distances():
    assert haversine(0, 0, 0, 1) == pytest.approx(111195.08, abs=0.1)
    assert haversine(30.352, 76.36, 30.352, 76.361) == pytest.approx(95.96, abs=0.2)
    assert haversine(30.352, 76.36, 30.353, 76.36) == pytest.approx(111.195, abs=0.1)
    assert haversine(30.352, 76.36, 30.352, 76.36) == 0


def test_landmark_radius_and_deterministic_tie():
    point = Coordinate(lat=30.352, lng=76.36)
    assert nearest_landmark(point, (landmark(lat=30.3525),)) is None
    close = nearest_landmark(point, (landmark(lat=30.3523),))
    assert close.name == "Library" and close.distanceMeters == pytest.approx(33.4, abs=0.1)
    candidates = (landmark("Zebra", id="z"), landmark("Alpha", id="a"))
    assert (
        nearest_landmark(point, candidates).id
        == nearest_landmark(point, tuple(reversed(candidates))).id
        == "a"
    )


def test_no_landmark_preserves_every_original_word(normal_payload):
    output = transform_route(normal_payload, CampusData({}, [], {}))
    assert [i.text for i in output.instructions] == [
        i["text"] for i in normal_payload["paths"][0]["instructions"]
    ]
    assert all(i.landmark is None for i in output.instructions)


def test_nearby_landmark_augments_original_turn_and_maneuver_point(normal_payload):
    normal_payload["paths"][0]["instructions"][0]["text"] = "Turn right onto Bridge Road"
    output = transform_route(normal_payload, CampusData({}, [landmark()], {}))
    assert output.instructions[0].text == "Turn right onto Bridge Road (near Library)."
    assert output.instructions[0].point == Coordinate(lat=30.352, lng=76.36)
    assert output.instructions[0].landmark.distanceMeters == 0
    assert output.instructions[1].text == "Keep left onto campus road"


@pytest.mark.parametrize(
    "kind",
    [
        "distance",
        "time",
        "geometry",
        "point",
        "coordinateType",
        "interval",
        "intervalType",
        "text",
        "instructions",
        "nan",
        "negative",
        "bool",
    ],
)
def test_malformed_engine_payload_rejected(normal_payload, kind):
    path = normal_payload["paths"][0]
    if kind in {"distance", "time"}:
        del path[kind]
    elif kind == "geometry":
        path["points"]["coordinates"] = []
    elif kind == "point":
        path["points"]["coordinates"][0] = [76.36, 130]
    elif kind == "coordinateType":
        path["points"]["coordinates"][0] = ["76.36", 30.352]
    elif kind == "interval":
        path["instructions"][0]["interval"] = [0, 100]
    elif kind == "intervalType":
        path["instructions"][0]["interval"] = [True, 1]
    elif kind == "text":
        path["instructions"][0]["text"] = None
    elif kind == "instructions":
        path["instructions"] = []
    elif kind == "nan":
        path["distance"] = float("nan")
    elif kind == "negative":
        path["instructions"][0]["distance"] = -1
    elif kind == "bool":
        path["distance"] = True
    with pytest.raises(RoutingError) as error:
        transform_route(normal_payload, CampusData({}, [], {}))
    assert error.value.code == "MALFORMED_ROUTE"
