"""Release source-boundary checks; domain/runtime tests live in each service."""
import argparse
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--revision", help="Check immutable tracked source from Git")
args = parser.parse_args()

if args.revision:
    names = subprocess.check_output(["git", "ls-tree", "-r", "--name-only", args.revision], cwd=ROOT, text=True).splitlines()
    def read(name):
        return subprocess.check_output(["git", "show", f"{args.revision}:{name}"], cwd=ROOT).decode("utf-8", "replace")
else:
    names = [str(p.relative_to(ROOT)).replace("\\", "/") for base in ["frontend/src", "backend/src", "tracking"] for p in (ROOT / base).rglob("*") if p.is_file() and "node_modules" not in p.parts]
    def read(name):
        return (ROOT / name).read_text(encoding="utf-8")

failures = []
for name in names:
    if not name.startswith(("frontend/src/", "backend/src/", "tracking/")) or not name.endswith((".js", ".jsx", ".go")):
        continue
    source = read(name)
    if name.startswith("frontend/src/") and any(host in source for host in ["shouryadoes.tech", "httpbin.org", "nominatim.openstreetmap.org"]):
        failures.append(f"{name}: prohibited inherited service/autocomplete host")
    if name.startswith("backend/src/") and "firebaseAuthCallback" in source:
        failures.append(f"{name}: unverified Firebase callback remains")
    if name.startswith("frontend/src/") and ('requestID = "user1"' in source or 'requestID: "user1"' in source):
        failures.append(f"{name}: shared hardcoded ride identity")

if args.revision:
    data_a = read("routing-backend/api/thaparMap.geojson")
    data_b = read("frontend/public/thaparMap.geojson")
    if data_a != data_b:
        failures.append("campus GeoJSON copies diverge")
else:
    if not (ROOT / "data/campus.geojson").is_file() or not (ROOT / "data/campus.osm").is_file():
        failures.append("canonical campus dataset missing")
    for name in ["frontend/public/thaparMap.geojson", "routing-backend/api/thaparMap.geojson", "frontend/mockbackend"]:
        if (ROOT / name).exists():
            failures.append(f"{name}: obsolete authoritative data/backend remains")
    if (ROOT / "quinjet").exists():
        failures.append("unretained ride experiment remains in active tree")

license_text = (ROOT / "LICENSE").read_text(encoding="utf-8")
if "Copyright (c) 2024 Yash Dogra" not in license_text:
    failures.append("original MIT attribution missing")

for failure in failures:
    print("FAIL", failure)
if failures:
    print(f"{len(failures)} boundary violations")
    sys.exit(1)
print("Source boundary checks passed (runtime evidence is separate).")
