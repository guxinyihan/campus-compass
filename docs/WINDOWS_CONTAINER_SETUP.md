# Windows container environment checkpoint

Updated 2026-10-04 after the user authorized environment setup, restart and
continued publication work. The dedicated Linux Docker Engine is running and all
five application images have built successfully. All seven services became
healthy; actual GraphHopper, Mongo/Redis/WebSocket, four Chrome workflows,
engine outage/recovery, finite simulator/TTL and Linux Go race acceptance passed.
Publication and hosted CI remain the next steps at this checkpoint.

## Windows and Docker Desktop work performed

- Verified Windows 11 build **26200.9457**, about 32 GB RAM and firmware
  virtualization enabled. The initial Windows hypervisor state was false.
- Enabled **VirtualMachinePlatform** and installed Microsoft **WSL 3.0.1.0**,
  kernel **6.18.40.1-1**, using
  `wsl --install --no-distribution --web-download`.
- Restarted Windows after the user's explicit approval. The hypervisor is now
  active; the feature installation is no longer waiting for that restart.
- The existing per-user Docker Desktop **4.83.0.234302** still failed after the
  restart, reporting Windows **AF_UNIX error 1920** in `dockerInference`, then
  `SecretsEngine` involving `engine.sock`.
- Upgraded Desktop with the official, signature- and checksum-verified
  **4.93.0.240920** installer. The upgrade did not repair the pre-existing socket
  problem. No factory reset, Docker data deletion or volume deletion was used.
- Stopped Desktop. Backed up and removed its `Docker Desktop` value from the
  current user's `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` key and
  set Desktop `AutoStart` to false to prevent repeated startup error popups.

Keep Docker Desktop stopped for this project. The commands below use the
dedicated WSL Docker Engine directly and do not depend on Desktop's named pipe.

## Working dedicated WSL engine

- Created the dedicated **CampusCompassEngine** WSL distribution using
  **Ubuntu 24.04.5**. Project administration commands run as its Linux root user.
- Installed Docker through its official Ubuntu apt repository. Actual server
  queries reported **Docker Engine 29.8.2** and **Docker Compose 5.6.0**.
- Created the previously absent `C:\Users\admin\.wslconfig` with mirrored
  networking, `autoProxy` and `dnsTunneling`, allowing WSL to consume the existing
  Windows proxy configuration. These are WSL host settings.
- Configured the daemon's proxy in private `/etc/docker/daemon.json`. Proxy
  values are not included in repository documentation or application settings.
- A BuildKit build from the Windows NTFS-mounted source failed with an extended
  attribute/cache permission error. Exported the exact tracked Git snapshot
  **16db02c** into Linux storage at **/opt/campuscompass** using `git archive`,
  preserving the canonical data from Git. The original Windows Git repository
  and its upstream history remain intact.
- Copied the existing private application `.env` separately into that Linux
  workspace with mode **600**. It remains excluded from Git and Docker build
  contexts.

The Linux directory is a build/runtime snapshot, not a replacement for the
Windows Git repository. Later source changes must be synchronized deliberately;
editing or committing Windows files alone does not update an already exported
Linux snapshot.

## Observed image build and local network overlay

All five application images built successfully from snapshot **16db02c**:
frontend, Node API, routing API, GraphHopper and Go tracking. That snapshot pins
the frontend builder to Node **24.18.0-alpine** and the tracking builder to Go
**1.26.5-alpine**. Redis **7.4.7-alpine** was pulled successfully; the MongoDB
**8.0.18** pull and complete stack startup were still underway at this checkpoint.
An image build or image pull does not establish healthy service operation.

The host's loopback proxy required an ignored local build overlay,
`/opt/campuscompass/work/local-build-network.yml`, setting `build.network: host`
for those five services. The observed build passed the inherited proxy through
Docker build arguments. This affects build networking only; runtime startup uses
the unmodified base Compose file.

From PowerShell, with that existing local overlay and proxy environment:

```powershell
wsl -d CampusCompassEngine -u root --cd /opt/campuscompass --exec sh -c 'docker compose -f docker-compose.yml -f work/local-build-network.yml --progress plain build --build-arg HTTP_PROXY="$HTTP_PROXY" --build-arg HTTPS_PROXY="$HTTPS_PROXY" --build-arg NO_PROXY="localhost,127.0.0.1,mongo,redis,graphhopper,api,routing-api,tracking"'
```

The overlay and proxy configuration are machine-specific ignored setup, not
required configuration for a host with working direct network access.

## Resume container acceptance

Verify both the actual server and the Compose plugin before continuing:

```powershell
wsl -d CampusCompassEngine -u root --cd /opt/campuscompass --exec docker version
wsl -d CampusCompassEngine -u root --cd /opt/campuscompass --exec docker compose version
wsl -d CampusCompassEngine -u root --cd /opt/campuscompass --exec docker compose -f docker-compose.yml config --quiet
wsl -d CampusCompassEngine -u root --cd /opt/campuscompass --exec docker compose -f docker-compose.yml up -d --wait
wsl -d CampusCompassEngine -u root --cd /opt/campuscompass --exec docker compose -f docker-compose.yml ps
wsl -d CampusCompassEngine -u root --cd /opt/campuscompass --exec docker compose -f docker-compose.yml exec api node src/seed.js
```

Run the host acceptance tools from the original Windows CampusCompass repository,
preserving its private `.env` and using the loopback service addresses:

```powershell
node --env-file=.env scripts/seed-demo.mjs
node --env-file=.env scripts/acceptance.mjs
```

Confirm all seven services are healthy and verify a positive route through the
actual container GraphHopper engine and canonical OSM input. Repeat browser,
finite simulator and GraphHopper outage/recovery scenarios against this stack
and actual Redis 7.4.7. The native evidence in [VALIDATION.md](VALIDATION.md) does
not replace these container checks.

Only this project's owned native processes should be stopped if they occupy
5173/4000/5001/8081. Preserve persisted project volumes when stopping the stack:

```powershell
wsl -d CampusCompassEngine -u root --cd /opt/campuscompass --exec docker compose -f docker-compose.yml down
```

## Remaining release work

Systemd services alone did not keep the WSL instance alive between host commands.
The initial browser attempt therefore encountered connection refusal after the
instance went idle. A dedicated hidden session keeps this local stack available:

```powershell
$campusSession = Start-Process wsl -ArgumentList '-d', 'CampusCompassEngine', '-u', 'root', '--exec', 'sleep', 'infinity' -WindowStyle Hidden -PassThru
wsl -d CampusCompassEngine -u root --cd /opt/campuscompass --exec docker compose up -d --wait
```

Stop the Compose stack intentionally before ending that session. The session is
local development tooling; no Windows logon startup task was added for it.

The authenticated GitHub account was checked as `guxinyihan` with repo/workflow
scopes. Repository-name availability must be checked again immediately before
creating the requested new public repository. The repository CI checkout now
fetches full upstream history; a reproduced shallow-clone license-check failure
passed after fetching that history.

An earlier independent history review inspected 501 reachable objects across
60 commits. Tested token/private-key shapes were absent; historical Mongo
credential-form documentation examples used placeholders. This is a scoped
scan, not proof that every possible secret pattern is absent. Host setup helpers,
diagnostics, the build overlay and application credentials remain untracked.

Actual container acceptance has passed. Update the validation ledger, recheck
secret/license/Git hygiene and repository-name availability, create the new
unused public repository, retain `upstream`, add `origin`, push and inspect the
actual Actions results. Address real failures and only then create
`FINAL_REPORT.md`. Public repository creation and hosted CI remain unverified
until their actual results are recorded.

References: [Microsoft WSL installation](https://learn.microsoft.com/en-us/windows/wsl/install),
[Microsoft WSL networking](https://learn.microsoft.com/en-us/windows/wsl/networking),
[Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/).
