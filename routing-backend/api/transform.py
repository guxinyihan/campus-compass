"""Reject malformed engine payloads before exposing the stable route contract."""

import math

from .campus import CampusData
from .errors import RoutingError
from .landmarks import nearest_landmark
from .models import Coordinate, Instruction, RouteGeometry, RouteResponse


def number(value):
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or value < 0
    ):
        raise ValueError("invalid route measurement")
    return float(value)


def transform_route(payload: dict, campus: CampusData) -> RouteResponse:
    try:
        if not isinstance(payload, dict) or not isinstance(payload.get("paths"), list):
            raise ValueError("missing paths")
        if not payload["paths"]:
            raise RoutingError(404, "ROUTE_NOT_FOUND", "No walking route connects these points.")
        path = payload["paths"][0]
        distance, duration = number(path["distance"]), number(path["time"]) / 1000
        coordinates = path["points"]["coordinates"]
        if not isinstance(coordinates, list) or len(coordinates) < 2:
            raise ValueError("missing route geometry")
        points = []
        for coordinate in coordinates:
            if not isinstance(coordinate, list) or len(coordinate) != 2:
                raise ValueError("invalid coordinate pair")
            lng, lat = coordinate
            points.append(Coordinate(lat=lat, lng=lng))
        source_instructions = path["instructions"]
        if not isinstance(source_instructions, list) or not source_instructions:
            raise ValueError("missing route instructions")
        instructions = []
        previous = 0
        for source in source_instructions:
            interval = source["interval"]
            if (
                not isinstance(interval, list)
                or len(interval) != 2
                or any(type(i) is not int for i in interval)
            ):
                raise ValueError("invalid instruction interval")
            start, end = interval
            if not (previous <= start <= end < len(points)):
                raise ValueError("instruction interval outside route geometry")
            previous = start
            text = source["text"]
            if not isinstance(text, str) or not text.strip():
                raise ValueError("missing instruction text")
            point = points[start]
            landmark = nearest_landmark(point, campus.landmarks)
            # Preserve GraphHopper's maneuver. "Near" conveys proximity only.
            text = (
                text.strip()
                if landmark is None
                else f"{text.strip().rstrip('.')} (near {landmark.name})."
            )
            instructions.append(
                Instruction(
                    point=point,
                    text=text,
                    distanceMeters=number(source["distance"]),
                    landmark=landmark,
                )
            )
        return RouteResponse(
            geometry=RouteGeometry(coordinates=[[p.lng, p.lat] for p in points]),
            distanceMeters=distance,
            durationSeconds=duration,
            instructions=instructions,
        )
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise RoutingError(
            502, "MALFORMED_ROUTE", "The routing engine returned an invalid route."
        ) from exc
