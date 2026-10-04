"""Create private local configuration without replacing an existing .env."""
from pathlib import Path
import secrets

root = Path(__file__).resolve().parents[1]
target = root / '.env'
if target.exists():
    raise SystemExit('Existing .env preserved. Edit it directly if changes are needed.')
lines = (root / '.env.example').read_text(encoding='utf-8').splitlines()
private_keys = {'JWT_SECRET', 'TRACKING_JWT_SECRET', 'ADMIN_PASSWORD', 'DEMO_PASSWORD'}
text = '\n'.join(f'{line.split("=", 1)[0]}={secrets.token_urlsafe(36)}'
                 if line.split('=', 1)[0] in private_keys else line for line in lines) + '\n'
with target.open('x', encoding='utf-8', newline='\n') as output:
    output.write(text)
print('Created ignored .env. Credentials were not printed. Keep this file private.')
