"""Environment configuration; paths are independent of the working directory."""

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
# The inherited GeoJSON envelope plus 0.001 degrees (about 100 m) on each side.
# This is a service boundary, not a surveyed campus/property boundary.
BOUNDS = {"south": 30.3491, "north": 30.3598, "west": 76.3572, "east": 76.37529}
CENTER = {"lat": 30.35445, "lng": 76.366245}


def in_campus(lat: float, lng: float) -> bool:
    return BOUNDS["south"] <= lat <= BOUNDS["north"] and BOUNDS["west"] <= lng <= BOUNDS["east"]


@dataclass(frozen=True)
class Settings:
    data_dir: Path = ROOT / "data"
    graphhopper_url: str = "http://localhost:8989"
    origins: tuple[str, ...] = ("http://localhost:5173", "http://127.0.0.1:5173")

    @classmethod
    def from_env(cls):
        url = os.getenv("GRAPHHOPPER_BASE_URL", "http://localhost:8989").rstrip("/")
        parsed = urlsplit(url)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("GRAPHHOPPER_BASE_URL must be an HTTP(S) service base URL")
        if parsed.path not in {"", "/"} or parsed.username or parsed.password:
            raise ValueError("GRAPHHOPPER_BASE_URL must not contain a route path or credentials")
        origins = tuple(
            x.strip()
            for x in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(
                ","
            )
            if x.strip()
        )
        if not origins or "*" in origins:
            raise ValueError("CORS_ORIGINS must contain explicit frontend origins")
        return cls(Path(os.getenv("CAMPUS_DATA_DIR", str(ROOT / "data"))), url, origins)
