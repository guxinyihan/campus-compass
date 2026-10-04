# CampusCompass identity and administration

Node 24 + Express 5 + MongoDB 8. Passwords use bcrypt (12 rounds). Public
registration always creates students. Access JWTs expire after 15 minutes;
their current role is checked against Mongo on every protected request. There
are no OAuth/Firebase/session/refresh-token routes in v1.

From the repository root, run `python scripts/init-env.py`, then:

```sh
cd backend
npm ci
npm run seed:admin
npm start
```

Use a local Mongo instance via root `.env` MONGO_URI, or run the documented
Compose stack and `docker compose exec api node src/seed.js`. The seed creates
an admin only from private server configuration; it refuses to silently promote
an existing student. Credentials are not printed or tracked.

The API owns users, current roles, vehicle metadata/driver assignments and
scheduled notices. It never stores GPS positions. Its tracking grants bind the
authenticated driver to one assigned active vehicle, distinct token audience,
token type and secret, with a maximum 120-second lifetime. Former assignments
can remain authorized by already issued grants until those grants expire.

Vehicle assignment is unique per driver through Mongo indexes. Role/assignment
mutations serialize per driver in the single v1 API process; horizontal API
replication needs Mongo transactions/replica-set administration first.

`/health` pings actual Mongo; `/live` reports process liveness. Inputs are strict,
errors are safe and CORS uses explicit origins. Auth endpoints have bounded
per-process rate counters. This is a local demo, not verified production scale.

```sh
npm run lint
npm test
```

Tests use a disposable MongoDB 8.0.18 binary, or MONGO_TEST_URI in CI, with a
uniquely named `campuscompass_test_*` database. The fixture never drops a shared
developer database. See [API contracts](../docs/API_CONTRACTS.md) and
[validation evidence](../docs/VALIDATION.md). Package license metadata has been
corrected from ISC to the canonical root MIT; history supports stale default
metadata, not a separate owner or grant.
