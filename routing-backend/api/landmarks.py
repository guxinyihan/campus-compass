"""Haversine ground distances; deterministic cues without inventing maneuvers."""

import math

from .campus import POI
from .models import Coordinate, Landmark

LANDMARK_RADIUS_METERS = 45.0
EARTH_RADIUS_METERS = 6_371_008.8


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    lat1, lng1, lat2, lng2 = map(math.radians, (lat1, lng1, lat2, lng2))
    a = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_METERS * math.asin(math.sqrt(min(1.0, max(0.0, a))))


def nearest_landmark(point: Coordinate, landmarks: tuple[POI, ...]) -> Landmark | None:
    candidates = [
        (haversine(point.lat, point.lng, p.lat, p.lng), p.name.casefold(), p.id, p)
        for p in landmarks
    ]
    candidates = [item for item in candidates if item[0] <= LANDMARK_RADIUS_METERS]
    if not candidates:
        return None
    distance, _, _, poi = min(candidates, key=lambda item: item[:3])
    return Landmark(id=poi.id, name=poi.name, distanceMeters=round(distance, 1))
