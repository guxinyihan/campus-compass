"""Derive a loopback native configuration from the canonical container profile."""
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
target = root / "work" / "graphhopper-native.yml"
if target.exists():
    raise SystemExit("Existing native configuration preserved; remove it intentionally to regenerate.")
template = (root / "routing-backend/graphhopper/config.yml").read_text(encoding="utf-8")
template = template.replace("/data/campus.osm", json.dumps((root / "data/campus.osm").as_posix()))
template = template.replace("/graph-cache", json.dumps((root / "work/graphhopper-cache").as_posix()))
template = template.replace("bind_host: 0.0.0.0", "bind_host: 127.0.0.1")
target.parent.mkdir(parents=True, exist_ok=True)
with target.open("x", encoding="utf-8", newline="\n") as output:
    output.write(template)
print("Created ignored work/graphhopper-native.yml with loopback engine binding.")
