# Windows container environment checkpoint

Updated 2026-10-04 after the user's instruction to handle environment setup and
publication directly. This is a resumable checkpoint, not a completed release.

## Work performed

- Found the existing per-user Docker Desktop **4.83.0.234302** installation.
  It was outside the shell PATH; no redundant Docker installation was made.
- Verified Windows 11 build **26200.9457**, about 32 GB RAM and firmware
  virtualization enabled. The initial Windows hypervisor state was false.
- Launched a narrowly scoped administrator setup through the ordinary Windows
  elevation mechanism. Enabled **VirtualMachinePlatform** without restarting.
- Installed Microsoft **WSL 3.0.1.0**, kernel **6.18.40.1-1**, using
  `wsl --install --no-distribution --web-download`. No unrelated user Linux
  distribution was installed.
- Recorded successful installation (exit 0) with **restartNeeded: true**.
  Windows reports that the changes will not take effect until restart.
- Started existing Docker Desktop. Client **29.6.2** and its bundled Compose
  **5.3.1** are available, but the server remains unavailable before restart.
- Rechecked the authenticated GitHub account `guxinyihan` with repo/workflow
  scopes. The requested `guxinyihan/campus-compass` repository was absent at this
  check. Availability must be rechecked immediately before creation.
- Fixed the repository CI checkout to fetch full history. Reproduced the
  license-check failure in a depth-one clone, then verified it passes after
  fetching complete history. Application source did not change.
- Independent history review inspected 501 reachable objects across 60 commits
  at the previous source snapshot. Tested token/private-key shapes were absent;
  historical Mongo credential-form documentation examples used placeholders.
  This is a scoped scan, not proof that every possible secret pattern is absent.

The host-specific administrator helper and diagnostic result are ignored under
`work/provisioning/`; they contain no application credentials. No automatic
restart, public repository creation or hosted CI success is claimed.

## Resume after Windows restart

Start Docker Desktop, then use its installed CLI directly if PATH has not been
refreshed:

```powershell
$dockerExe = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'
& $dockerExe desktop start --detach
& $dockerExe version
& $dockerExe compose version
```

Both Client and Server must appear in `docker version`. A client version or
temporarily existing named pipe alone does not establish engine readiness.

From the CampusCompass root, preserve the existing private `.env` and run:

```powershell
& $dockerExe compose config --quiet
& $dockerExe compose build
& $dockerExe compose up -d --wait
& $dockerExe compose ps
& $dockerExe compose exec api node src/seed.js
node --env-file=.env scripts/seed-demo.mjs
node --env-file=.env scripts/acceptance.mjs
```

Only this project's owned native processes should be stopped if they occupy
5173/4000/5001/8081. Do not stop unrelated applications or delete persisted
volumes. Repeat the browser and finite simulator scenarios against the actual
container stack and Redis 7.4.7. Repeat the GraphHopper container outage/recovery
scenario. The unit tests and native evidence in [VALIDATION.md](VALIDATION.md)
do not replace these required container checks.

Once those gates pass, recheck secret/license/Git hygiene and repository-name
availability, create the new unused public repository under the authenticated
account, retain `upstream`, add `origin`, push and inspect the actual Actions
results. Address real failures and only then create `FINAL_REPORT.md`.

References: [Microsoft WSL installation](https://learn.microsoft.com/en-us/windows/wsl/install),
[Docker Windows setup](https://docs.docker.com/desktop/setup/install/windows-install/).
