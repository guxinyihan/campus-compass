"""Run with the routing requirements installed; report duplicate names, never merge them."""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "routing-backend"))
from api.campus import load_campus

parser = argparse.ArgumentParser()
parser.add_argument("--data-dir", type=Path, default=ROOT / "data")
args = parser.parse_args()
try:
    campus = load_campus(args.data_dir)
except ValueError as error:
    print(str(error), file=sys.stderr)
    sys.exit(1)
print(json.dumps(campus.report, indent=2, sort_keys=True))
