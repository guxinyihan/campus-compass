"""Validate inherited data and derive one deterministic, in-memory POI index."""

import hashlib
import json
import math
import re
import unicodedata
import xml.etree.ElementTree as ET
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from shapely.geometry import shape
from shapely.validation import explain_validity

from .config import BOUNDS, CENTER, in_campus

ATTRIBUTION = {
    "text": "© OpenStreetMap contributors",
    "url": "https://www.openstreetmap.org/copyright",
    "license": "ODbL-1.0",
    "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
}


def normalize(text: str) -> str:
    return " ".join(re.sub(r"[^\w]+", " ", unicodedata.normalize("NFKC", text).casefold()).split())


def coordinate_pairs(value):
    if not isinstance(value, list) or not value:
        raise ValueError("geometry coordinates must be non-empty arrays")
    if isinstance(value[0], (float, int)):
        if len(value) != 2 or any(
            isinstance(x, bool) or not isinstance(x, (float, int)) or not math.isfinite(x)
            for x in value
        ):
            raise ValueError("coordinates must be finite [longitude, latitude] pairs")
        yield value
    else:
        for child in value:
            yield from coordinate_pairs(child)


@dataclass(frozen=True)
class POI:
    id: str
    name: str
    aliases: tuple[str, ...]
    category: str
    lat: float
    lng: float
    landmark: bool

    def public(self):
        return {
            "id": self.id,
            "name": self.name,
            "aliases": list(self.aliases),
            "category": self.category,
            "lat": self.lat,
            "lng": self.lng,
        }


class CampusData:
    def __init__(self, geojson: dict, pois: list[POI], report: dict):
        self.geojson = geojson
        self.pois = tuple(sorted(pois, key=lambda p: (normalize(p.name), p.id)))
        self.landmarks = tuple(p for p in self.pois if p.landmark)
        self.report = report

    def map_response(self):
        return {
            **self.geojson,
            "bounds": BOUNDS,
            "center": CENTER,
            "profiles": ["walking"],
            "attribution": ATTRIBUTION,
        }

    def search(self, query: str = "", limit: int = 100):
        query = normalize(query)
        ranked = []
        for poi in self.pois:
            labels = [normalize(poi.name), *(normalize(a) for a in poi.aliases)]
            ranks = []
            for label in labels:
                if not query or query == label:
                    ranks.append(0)
                elif label.startswith(query):
                    ranks.append(1)
                elif any(
                    label[pos:].startswith(query)
                    for pos in range(len(label))
                    if pos == 0 or label[pos - 1] == " "
                ):
                    ranks.append(2)
                elif query in label:
                    ranks.append(3)
            if ranks:
                ranked.append((min(ranks), normalize(poi.name), poi.id, poi))
        ranked.sort(key=lambda item: item[:3])
        return {"pois": [p.public() for *_, p in ranked[:limit]], "total": len(ranked)}


def validate_osm(path: Path):
    root = ET.parse(path).getroot()
    if root.tag != "osm" or root.get("version") != "0.6":
        raise ValueError("campus.osm must contain OSM XML 0.6")
    nodes = {}
    for node in root.findall("node"):
        lat, lng = float(node.attrib["lat"]), float(node.attrib["lon"])
        if (
            not math.isfinite(lat)
            or not math.isfinite(lng)
            or not (-90 <= lat <= 90 and -180 <= lng <= 180)
        ):
            raise ValueError("OSM node coordinate outside geographic range")
        if node.attrib["id"] in nodes:
            raise ValueError("duplicate OSM node ID")
        nodes[node.attrib["id"]] = (lng, lat)
    ways = root.findall("way")
    if (
        not nodes
        or not ways
        or not any(tag.get("k") == "highway" for way in ways for tag in way.findall("tag"))
    ):
        raise ValueError("OSM input contains no routable road data")
    for way in ways:
        if any(nd.get("ref") not in nodes for nd in way.findall("nd")):
            raise ValueError("OSM way references a missing node")
    return {"nodes": len(nodes), "ways": len(ways), "relations": len(root.findall("relation"))}


def load_campus(data_dir: Path) -> CampusData:
    try:
        geojson = json.loads((data_dir / "campus.geojson").read_text(encoding="utf-8"))
        osm = validate_osm(data_dir / "campus.osm")
        if (
            not isinstance(geojson, dict)
            or geojson.get("type") != "FeatureCollection"
            or not isinstance(geojson.get("features"), list)
            or not geojson["features"]
        ):
            raise ValueError("campus.geojson must be a non-empty FeatureCollection")
        pois, pairs, names, ids = [], [], Counter(), set()
        for index, feature in enumerate(geojson["features"]):
            if (
                not isinstance(feature, dict)
                or feature.get("type") != "Feature"
                or not isinstance(feature.get("properties"), dict)
            ):
                raise ValueError(f"feature {index} is not a GeoJSON feature with properties")
            geometry = feature.get("geometry")
            if not isinstance(geometry, dict) or geometry.get("type") not in {
                "Point",
                "MultiPoint",
                "LineString",
                "MultiLineString",
                "Polygon",
                "MultiPolygon",
            }:
                raise ValueError(f"feature {index} has unsupported geometry")
            coords = list(coordinate_pairs(geometry.get("coordinates")))
            if any(not in_campus(lat, lng) for lng, lat in coords):
                raise ValueError(f"feature {index} lies outside the campus service boundary")
            geom = shape(geometry)
            if geom.is_empty or not geom.is_valid:
                raise ValueError(f"feature {index} has invalid geometry: {explain_validity(geom)}")
            pairs.extend(coords)
            props = feature["properties"]
            name = props.get("name")
            if name is None:
                continue
            if not isinstance(name, str) or not normalize(name):
                raise ValueError(f"feature {index} has an invalid POI name")
            name = " ".join(name.split())
            aliases = set()
            for key in ("name:en", "alt_name", "short_name", "loc_name", "old_name"):
                value = props.get(key)
                if isinstance(value, str):
                    aliases.update(
                        a.strip()
                        for a in value.split(";")
                        if normalize(a) and normalize(a) != normalize(name)
                    )
            category = next(
                (
                    str(props[k])
                    for k in (
                        "amenity",
                        "tourism",
                        "shop",
                        "leisure",
                        "building",
                        "barrier",
                        "highway",
                    )
                    if props.get(k)
                ),
                "poi",
            )
            if category == "yes":
                category = "building"
            point = (
                geom.interpolate(0.5, normalized=True)
                if geom.geom_type in {"LineString", "MultiLineString"}
                else geom.representative_point()
            )
            digest = hashlib.sha256(
                json.dumps(feature, sort_keys=True, separators=(",", ":")).encode()
            ).hexdigest()[:16]
            poi_id = f"poi-{digest}"
            if poi_id in ids:
                raise ValueError(f"feature {index} duplicates an identical named POI")
            ids.add(poi_id)
            names[normalize(name)] += 1
            # Roads, walls and the entire university boundary are unsuitable cues.
            is_landmark = (
                not props.get("highway")
                and not props.get("barrier")
                and props.get("amenity") != "university"
            )
            pois.append(
                POI(poi_id, name, tuple(sorted(aliases)), category, point.y, point.x, is_landmark)
            )
        if not pois:
            raise ValueError("campus data contains no named POIs")
        report = {
            "features": len(geojson["features"]),
            "pois": len(pois),
            "duplicateNames": {name: count for name, count in sorted(names.items()) if count > 1},
            "actualBounds": [
                min(c[0] for c in pairs),
                min(c[1] for c in pairs),
                max(c[0] for c in pairs),
                max(c[1] for c in pairs),
            ],
            "serviceBounds": BOUNDS,
            "osm": osm,
        }
        return CampusData(geojson, pois, report)
    except (OSError, ValueError, TypeError, KeyError, ET.ParseError) as exc:
        raise ValueError(f"Canonical campus data cannot load: {exc}") from exc
