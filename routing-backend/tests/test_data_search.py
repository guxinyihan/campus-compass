import pytest
from shapely.geometry import Point, shape

from api.campus import POI, CampusData, load_campus, normalize
from api.config import Settings


def feature(name="Library", coordinates=None, geometry_type="Point", **props):
    return {
        "type": "Feature",
        "properties": {"name": name, **props},
        "geometry": {"type": geometry_type, "coordinates": coordinates or [76.36, 30.352]},
    }


def test_ranking_aliases_and_stable_ties():
    pois = [
        POI(str(i), name, aliases, "library", 30.352, 76.36, True)
        for i, (name, aliases) in enumerate(
            [
                ("Prelibrary", ()),
                ("West Library", ()),
                ("Library Annex", ()),
                ("Library", ()),
                ("Archive", ("Library",)),
            ]
        )
    ]
    data = CampusData({}, pois, {})
    assert [p["name"] for p in data.search(" LIBRARY ")["pois"]] == [
        "Archive",
        "Library",
        "Library Annex",
        "West Library",
        "Prelibrary",
    ]
    assert data.search("library", limit=2)["total"] == 5
    assert len(data.search("library", limit=2)["pois"]) == 2
    assert data.search("library") == CampusData({}, list(reversed(pois)), {}).search("library")
    assert normalize(" Ｅ-Block\t") == "e block"


def test_canonical_dataset_and_duplicate_names(campus_data):
    assert campus_data.report["features"] == 395
    assert len(campus_data.pois) == 106
    assert campus_data.report["duplicateNames"]["tennis court"] == 8
    courts = campus_data.search("Tennis Court")["pois"]
    assert len(courts) == len({p["id"] for p in courts}) == 8
    assert campus_data.search("a HOSTEL")["pois"][0]["name"] == "Agira Hall"
    assert all(p.category != "highway" for p in campus_data.landmarks)


def test_polygon_anchor_is_inside_not_hole(write_features):
    polygon = feature(
        coordinates=[
            [[76.36, 30.352], [76.362, 30.352], [76.362, 30.354], [76.36, 30.354], [76.36, 30.352]],
            [
                [76.3605, 30.3525],
                [76.3605, 30.3535],
                [76.3615, 30.3535],
                [76.3615, 30.3525],
                [76.3605, 30.3525],
            ],
        ],
        geometry_type="Polygon",
    )
    data = load_campus(write_features([polygon]))
    assert shape(polygon["geometry"]).contains(Point(data.pois[0].lng, data.pois[0].lat))


def test_poi_ids_do_not_depend_on_feature_order(write_features):
    features = [feature("East", [76.362, 30.352]), feature("West", [76.36, 30.352])]
    first = load_campus(write_features(features)).search()
    second = load_campus(write_features(list(reversed(features)))).search()
    assert first == second


@pytest.mark.parametrize(
    "features",
    [
        [],
        [feature(name="")],
        [feature(name=None)],
        [feature(coordinates=[0, 0])],
        [feature(coordinates=[30.352, 76.36])],
        [feature(coordinates=[76.36, float("nan")])],
        [feature(coordinates=[76.36])],
        [feature(coordinates=[76.36, 30.352, 1])],
        [feature(coordinates=[True, 30.352])],
        [feature(), feature()],
        [
            feature(
                coordinates=[
                    [
                        [76.36, 30.352],
                        [76.362, 30.354],
                        [76.362, 30.352],
                        [76.36, 30.354],
                        [76.36, 30.352],
                    ]
                ],
                geometry_type="Polygon",
            )
        ],
    ],
)
def test_invalid_canonical_data_fails_clearly(write_features, features):
    with pytest.raises(ValueError, match="Canonical campus data cannot load"):
        load_campus(write_features(features))


def test_missing_osm_and_invalid_geojson(data_dir):
    (data_dir / "campus.osm").unlink()
    with pytest.raises(ValueError, match="campus.osm"):
        load_campus(data_dir)
    (data_dir / "campus.geojson").write_text("broken JSON")
    with pytest.raises(ValueError, match="Canonical campus data"):
        load_campus(data_dir)


def test_osm_missing_way_node_fails(data_dir):
    (data_dir / "campus.osm").write_text(
        '<osm version="0.6"><node id="1" lat="30.352" lon="76.36"/><way id="2"><nd ref="999"/><tag k="highway" v="footway"/></way></osm>'
    )
    with pytest.raises(ValueError, match="missing node"):
        load_campus(data_dir)


def test_same_names_different_geometry_remain_separate(write_features):
    data = load_campus(write_features([feature(), feature(coordinates=[76.361, 30.352])]))
    assert len(data.pois) == 2
    assert data.report["duplicateNames"] == {"library": 2}


@pytest.mark.parametrize(
    "url",
    ["file:///tmp", "http://user:secret@engine", "http://engine/route", "http://engine?q=bad"],
)
def test_service_base_url_validation(monkeypatch, url):
    monkeypatch.setenv("GRAPHHOPPER_BASE_URL", url)
    with pytest.raises(ValueError):
        Settings.from_env()


def test_startup_paths_independent_of_working_directory(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    settings = Settings.from_env()
    assert load_campus(settings.data_dir).report["features"] == 395
