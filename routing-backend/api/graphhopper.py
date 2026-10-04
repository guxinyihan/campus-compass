"""Bounded asynchronous requests to the local walking engine."""

import asyncio

import httpx

from .errors import RoutingError
from .models import RouteRequest

ROUTE_TIMEOUT_SECONDS = 12


class GraphHopperClient:
    def __init__(self, url: str, client: httpx.AsyncClient):
        self.url = url.rstrip("/")
        self.client = client

    async def route(self, request: RouteRequest):
        body = {
            "points": [
                [request.start.lng, request.start.lat],
                [request.destination.lng, request.destination.lat],
            ],
            "profile": "walking",
            "instructions": True,
            "locale": "en",
            "points_encoded": False,
            "snap_preventions": ["ferry"],
        }
        try:
            async with asyncio.timeout(ROUTE_TIMEOUT_SECONDS):
                response = await self.client.post(f"{self.url}/route", json=body)
        except (httpx.TimeoutException, TimeoutError) as exc:
            raise RoutingError(
                504, "ROUTING_TIMEOUT", "Walking route calculation timed out. Try again."
            ) from exc
        except httpx.RequestError as exc:
            raise RoutingError(
                503, "ROUTING_ENGINE_UNAVAILABLE", "The walking route engine is unavailable."
            ) from exc
        if response.status_code >= 500:
            raise RoutingError(
                503, "ROUTING_ENGINE_UNAVAILABLE", "The walking route engine is unavailable."
            )
        if response.status_code >= 400:
            try:
                payload = response.json()
                details = (
                    {
                        hint.get("details", "").rsplit(".", 1)[-1]
                        for hint in payload.get("hints", [])
                        if isinstance(hint, dict)
                    }
                    if isinstance(payload, dict)
                    else set()
                )
            except (ValueError, AttributeError, TypeError):
                details = set()
            if details & {
                "ConnectionNotFoundException",
                "PointOutOfBoundsException",
                "PointNotFoundException",
                "PointDistanceExceededException",
            }:
                if details & {
                    "PointOutOfBoundsException",
                    "PointNotFoundException",
                    "PointDistanceExceededException",
                }:
                    raise RoutingError(
                        422,
                        "ROUTE_POINT_UNAVAILABLE",
                        "A selected point cannot connect to the walking network.",
                    )
                raise RoutingError(
                    404, "ROUTE_NOT_FOUND", "No walking route connects these points."
                )
            raise RoutingError(
                502, "ROUTING_ENGINE_REJECTED", "The routing engine could not process this request."
            )
        try:
            return response.json()
        except ValueError as exc:
            raise RoutingError(
                502, "MALFORMED_ROUTE", "The routing engine returned an invalid route."
            ) from exc

    async def ready(self) -> bool:
        try:
            async with asyncio.timeout(3):
                response = await self.client.get(f"{self.url}/info", timeout=2)
            data = response.json()
            return (
                response.status_code == 200
                and isinstance(data, dict)
                and any(
                    p.get("name") == "walking"
                    for p in data.get("profiles", [])
                    if isinstance(p, dict)
                )
            )
        except (httpx.RequestError, TimeoutError, ValueError, TypeError):
            return False
