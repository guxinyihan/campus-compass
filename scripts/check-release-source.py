"""Check tracked release source, while never printing suspected secret values."""
from pathlib import Path
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
files = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')
failures = []
for name in files:
    if not name:
        continue
    parts = Path(name).parts
    if name == '.env' or name.endswith(('.rdb', '.exe', '.log')) or any(p in parts for p in ['node_modules', '__pycache__', '.venv', 'graph-cache']):
        failures.append(f'{name}: generated/private file is tracked')
    file = root / name
    if not file.is_file() or file.suffix.lower() in {'.png', '.jpg', '.gif', '.ico'}:
        continue
    text = file.read_text(encoding='utf-8', errors='replace')
    if re.search(r'gh[pousr]_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----', text):
        failures.append(f'{name}: secret-shaped material found (redacted)')
    if re.search(r'mongodb(?:\+srv)?://[^\s/@:]+:[^\s/@]+@', text):
        failures.append(f'{name}: credential-bearing Mongo URI found (redacted)')
    if name.startswith(('frontend/src/', 'backend/src/', 'tracking/')):
        emails = re.findall(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', text)
        if any(not e.endswith('@example.test') for e in emails):
            failures.append(f'{name}: non-demo personal email in application source')

if (root / 'LICENSE').read_bytes().replace(b'\r\n', b'\n') != subprocess.check_output(['git', 'show', '1d5420787b2f5a7a42b2a9ce17792ed7f97149fc:LICENSE'], cwd=root).replace(b'\r\n', b'\n'):
    failures.append('LICENSE: canonical upstream license changed')
if 'ODbL' not in (root / 'docs/DATA_LICENSE_AND_PROVENANCE.md').read_text(encoding='utf-8'):
    failures.append('Map-data license notice missing')
if not any('OpenStreetMap' in p.read_text(encoding='utf-8') and 'attribution' in p.read_text(encoding='utf-8') for p in (root / 'frontend/src').rglob('*.jsx')):
    failures.append('Visible map attribution missing from Leaflet source')
for failure in failures:
    print('FAIL', failure)
if failures:
    sys.exit(1)
print('Tracked-source secret/license/hygiene checks passed; this is not an exhaustive credential audit.')
