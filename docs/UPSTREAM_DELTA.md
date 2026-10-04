# Upstream delta (verified 2026-10-04)

Source: https://github.com/yxshee/mapmitra, full Git clone (no shallow flag or ZIP).

`git ls-remote ... HEAD refs/heads/main` returned
`1d5420787b2f5a7a42b2a9ce17792ed7f97149fc` for both. This is the previously
audited commit, **not** the supplied observed HEAD `5e80c182...`.

Git ancestry, rather than wall-clock timestamps, determines ordering:

| Commit | Relationship | Actual changes |
|---|---|---|
| `f4f82eaf6f8a7acba9168e0b5de93ae90bfe0be7` | Ancestor of current main | Four service README files; 2,662 insertions, 5 deletions; documentation only |
| `5e80c1821088963b9f28d938f6000a2f3d7f58da` | Child of f4f82ea, parent of current main | Four files under docs/; 2,880 insertions; documentation only |
| `1d5420787b2f5a7a42b2a9ce17792ed7f97149fc` | Actual main HEAD; CampusCompass foundation | Empty tree delta relative to 5e80c18; commit message `chore: sync` |

The sync commit has an earlier author/committer clock time than its parent.
This does not change ancestry. `git diff 1d542078 HEAD` and `git log
1d542078..HEAD` were empty immediately after cloning. There are **zero new
source or documentation changes since the previously audited revision**.
The two documentation commits were already included in that revision.

## Documentation claims introduced by those commits

Examples in the upstream tree (line references refer to the foundation):

- `docs/PROJECT_DOCUMENTATION.md:70,296,420,817`: frontend/driver WebSocket tracking and a `/ws/tracking` endpoint.
- `docs/PROJECT_DOCUMENTATION.md:23,308,430`: 90% ETA accuracy, ETA calculations and ETA broadcasts.
- `docs/DOCUMENTATION_INDEX.md:162,206,313`: 15+ endpoints, driver WebSocket flow and claimed working real-time communication.
- `docs/QUICK_START_GUIDE.md:28-29,113`: two services on port 5000 and Go/WebSocket/Redis tracking.
- `docs/TECHNOLOGY_STACK.md:719`: WebSocket example code appears in documentation, not a reachable Go handler.
- Service READMEs describe authentication, driver/admin workflows and deployment beyond the actual connected runtime.

These claims require source and runtime evidence. The reality audit documents
which are partial, absent or broken; CampusCompass does not adopt them as proof.
The root Compose file only covered GraphHopper, Python, Redis and Quinjet, not
the React/Node/Mongo application. There was no workflow under `.github/workflows`.

## Reproduction

```sh
git log --oneline --all
git cat-file -t 1d5420787b2f5a7a42b2a9ce17792ed7f97149fc
git merge-base --is-ancestor 5e80c1821088963b9f28d938f6000a2f3d7f58da 1d5420787b2f5a7a42b2a9ce17792ed7f97149fc
git diff --name-status 1d5420787b2f5a7a42b2a9ce17792ed7f97149fc upstream/main
git show --stat f4f82eaf6f8a7acba9168e0b5de93ae90bfe0be7
git show --stat 5e80c1821088963b9f28d938f6000a2f3d7f58da
```

CampusCompass develops from actual main without rewriting upstream commits.
The unmodified root MIT LICENSE retains Copyright (c) 2024 Yash Dogra.
