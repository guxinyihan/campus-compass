"""Explicit coordinate order and strict request/response contracts."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .config import in_campus


class Coordinate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lng: float = Field(ge=-180, le=180, allow_inf_nan=False)


class RouteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    start: Coordinate
    destination: Coordinate
    profile: Literal["walking"] = "walking"

    @field_validator("start", "destination")
    @classmethod
    def campus_coordinate(cls, value: Coordinate):
        if not in_campus(value.lat, value.lng):
            raise ValueError("coordinate outside the campus service boundary")
        return value


class Landmark(BaseModel):
    id: str
    name: str
    distanceMeters: float


class Instruction(BaseModel):
    point: Coordinate
    text: str
    distanceMeters: float
    landmark: Landmark | None = None


class RouteGeometry(BaseModel):
    type: Literal["LineString"] = "LineString"
    coordinates: list[list[float]]


class RouteResponse(BaseModel):
    geometry: RouteGeometry
    distanceMeters: float
    durationSeconds: float
    profile: Literal["walking"] = "walking"
    instructions: list[Instruction]
