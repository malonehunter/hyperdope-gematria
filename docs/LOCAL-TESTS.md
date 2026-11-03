# Local test CI and rollout

## Run locally

Use **Node.js 24.21.0 (Krypton LTS)** and Bash, then run:

```sh
bash scripts/test-local.sh safety
bash scripts/test-local.sh full
```

The runner works from any current directory. It installs nothing and executes
Node's built-in test runner. `full` includes every top-level `tests/*.test.js`;
`safety` explicitly includes refresh safety, cloud-restore safety, and atomic
history-reconciliation safety. New tests must follow that naming convention.
Missing suites and failing assertions exit nonzero.

The historical `tests/localstorage_test.js` is Windows Script Host/ActiveX code,
not a Node test. `tests/localstorage_test.py` attempts to execute JavaScript with
Python `exec`. Neither is part of the Node suite. The Node-compatible coverage
is `tests/localstorage.test.js`; this workflow does not claim to run every file
whose name happens to contain “test”.

## Workflow boundary

`.github/workflows/local-tests.yml` runs on ordinary `pull_request` events,
pushes to `master`, and manual dispatch (once available on the default
branch). There are no path filters, so a required check will not silently be
omitted for documentation-only PRs. Its two independent matrix checks are:

- `Local tests (safety)`
- `Local tests (full)`

`fail-fast: false` lets both report. There is **no `continue-on-error`, expected
failure exemption, assertion suppression, or Numogram exclusion**. A green
safety check is not a green full suite. Tests use local source and synthetic
browser/storage/database doubles, not a live SDK, database or network service.
The GitHub runner itself still needs network access for checkout/Node setup;
this is not an OS-level network sandbox.

Security/scope: GitHub-hosted `ubuntu-24.04`, ten-minute job timeout,
`contents: read` only, checkout `persist-credentials: false`, no project secrets,
no dependency install, no package cache, no uploads, no production environment,
no deployment permissions, and no `pull_request_target` or self-hosted runner.
Action commit pins were resolved using the official repositories' GitHub API
`git/ref/tags/v6` endpoints, and their `action.yml` inputs were checked:

- checkout: `d23441a48e516b6c34aea4fa41551a30e30af803`
- setup-node: `249970729cb0ef3589644e2896645e5dc5ba9c38`

Node 24.21.0 was selected from the official Node distribution index's LTS
releases and actually exercised locally using the official Linux x64 archive,
checked against its published SHA-256 list. Update the Node patch/action pins
through reviewed PRs; pins do not update themselves.

This workflow does **not** replace or modify the existing dynamic GitHub Pages
build/deployment. It does not gate a separate Pages deployment after a direct
push. Branch protections are needed to prevent unchecked default-branch writes.
No repository settings were changed by this work.

## History reconciliation checkpoint (2026-11-01)

The new `tests/history-sync-reconciliation.test.js` is part of the required
safety set. It executes production history sync in isolated VMs and uses the
vendored Supabase client with intercepted `fetch` to prove that a supported
snapshot produces one short RPC `POST`, with phrases only in its body. It also
proves canonical full-history handling during Match filtering, zero remote
writes above 2,000 phrases, bounded retry/pending behavior, the migration's
caller-scoped contract, and every served history-sync content key.

Local Node 26.7.0 results after implementation:

| Repository | Focused history | Safety | Full |
| --- | --- | --- | --- |
| gematro-hyperdope | 8 / 8 | 49 / 49 | 67 pass / 1 known Numogram fail |
| ciphersnews | 8 / 8 | 49 / 49 | 67 pass / 1 known Numogram fail |
| cyphers-news.github.io | 8 / 8 | 49 / 49 | 73 / 73 |

These are local synthetic tests. They do not prove that the migration has been
applied, a deployed client is current, a real member can sync, or provider logs
are clean. Database application and client deployment remain separate gates.

## Earlier verified CI baseline

At the inspected default-branch heads:

| Repository | Head | Full pass / fail | Exit | Safety pass / fail |
| --- | --- | --- | --- | --- |
| gematro-hyperdope | `80c98dff92dc8226cdea2541c56fc8c85ad3097d` | 47 / 1 | 1 | 41 / 0 |
| ciphersnews | `989af008520cbbc9f327536975a0edcc7e116dba` | 42 / 1 | 1 | 41 / 0 |
| cyphers-news.github.io | `836687bde14b2e0765afd20726685e4b07735f3d` | 48 / 0 | 0 | 41 / 0 |

Full-suite totals were reproduced on both Node 26.7.0 and 24.21.0. The actual
new runner was then exercised on 24.21.0 for both modes in each repository;
safety exited 0 everywhere. Safety comprises 8 refresh and 33 cloud-restore
tests. Node reports older assertion-script files as one test each, so these
counts are not counts of every internal assertion.

Local validation also included `bash -n` and actionlint 1.7.12 (without the
optional ShellCheck integration). Independent review found that the original
seven-case scratch validation missed an important case: on Node 24.21.0, one
missing safety filename could be silently ignored if the other file passed.
The runner now explicitly checks that every selected file exists and is readable
before launching Node. Both individual-missing-file tests failed before this
correction and passed afterward.

`tests/test-local-runner.test.js` now contains twelve reproducible synthetic
checks: each of the three safety files individually missing, all missing, empty
full suite, invalid mode, isolated passing safety, a failure in each safety
file, passing full suite, and a discovered failure outside the safety list. It
invokes the real runner from another working directory with disposable
fixtures; it does not load the application or call network services.

With those ten regression cases included, the final local full-suite results on
Node 24.21.0 are **57 pass / 1 fail** for gematro-hyperdope, **52 pass / 1 fail**
for ciphersnews, and **58 pass / 0 fail** for cyphers-news.github.io. The remaining
failures are the same pre-existing Numogram assertion. Safety remains **41 pass /
0 fail** in each repository; it does not include the separate runner regressions.
Scratch execution logs are not published in this repository.

No GitHub-hosted run has been executed or verified by this local-only work.
Browser appearance, live persistence, deployed cache headers and warm-cache
behavior are not covered. At that earlier checkpoint there was no
cache-reference gate. The 2026-11-01 history reconciliation test now verifies
the content-derived key for every served `auth/history-sync.js` consumer;
deployed cache behavior remains a separate release obligation.

## Numogram diagnosis: not just one off-mode assertion

`tests/numogram.test.js` is byte-identical in all three repositories. In
`gematro-hyperdope` and `ciphersnews`, Node stops that assertion script at line
457: it expects `numogramGeoPanel()` to return an empty string with
`numCosmo = 'off'`. Actual output is a 5,051-character Planetwork SVG with ten
rows (Sun through Pluto). The other test files still run under `node --test`.

The implementation explains the disagreement:

- `calc/numogram.js:780–804`, `numCosmoRows()`, defaults to `NUM_PLANETWORK`.
  Its adjacent comment explicitly says the panel now shows under both models
  because hiding canonical planet attributions hid the connection between the
  halves of the feature.
- `:1042–1101`, `numogramGeoPanel()`, has no off-mode empty guard. Demon and
  divine modes dispatch separately, and other modes render the supplied rows.
- `:1902–1915`, `numogramApply()`, renders the panel and sets `display = ''`,
  with a matching “shown under both cosmologies now” comment.
- `:1488–1493`, `NUM_MODELS`, exposes Numogram/off, Gnosticism/geo-extended,
  Pandemonium/demon and Divination/divine. Geo/cross now use `NUM_GNOSTIC`, not
  the old classical/extended Ptolemaic row set. `numGeoSet` does not affect
  these rows. Some older comments/ARIA strings still describe Ptolemaic models
  or “diagram and nothing else”; those are conflicting evidence, not authority.

The `cyphers-news.github.io` implementation retains the older geo/cross-only
panel: off returns empty, classical draws nine rows, extended draws twelve,
and selection draws a cross-map tie. This matches the unchanged test.

Local history has only a bundled Numogram introduction per repository:
`85bd1f330a694edc52992400dd9c378524b1f271` (gematro, “Numogram”),
`79caee39ebbfffdfa68eec1ec951cef0f9c334a1` (ciphersnews, “Numogram update”), and
`0a4fbacf3e455bf99564b304093ee05f1cc29ef5` (GitHub Pages, “v3.1 (Numogram, MD,
Astro)”). The first two current source files are byte-identical; the gematro
source is unchanged since its introduction. Tracked Markdown did not provide
an authoritative resolution. Thus code/comments support a changed UI design,
but history does not establish the owner's intended contract. A CI change
must not silently restore the old model or bless the new one.

### Assertions hidden behind line 457

A scratch-only diagnostic executed the unchanged assertion script with an
assertion wrapper that recorded `AssertionError`s and continued. This was
**not a passing suite**: existing “all checks passed” console text is not
meaningful under that probe. It recorded **31 failing assertion invocations**
in each of gematro/ciphersnews, versus zero in GitHub Pages. Repeated loop
assertions and dependent expectations mean this is not 31 independent bugs.
Fresh VM metric probes, without any test execution/mutation, independently
confirmed the row sets, geometry, gate positions and hit counts below.

| Test lines | Observed mismatch in gematro/ciphersnews |
| --- | --- |
| 457 | Off mode draws ten Planetwork rows, rather than empty output. |
| 531–533, 536 | Four geometry assertions fail: tests expect Zone 6 upper-left, Zone 3 upper-right and 6 left of 3, and Zone 2 in the middle band. Current 3=(273,88), 6=(384,107), 2=(588,316) differ. |
| 641, 647, 678 | Minimum gate clearance is -46 versus required 10; gate labels 6 and 21 have identical positions (~315.846,171.425), so their separation is zero. Path/zone clearance is ~-1.642 for tractor-4::5 against Zone 4, below required 10. |
| 707 | 19 forgiving hit strokes, expected 14; the renderer additionally emits tractor hit strokes. |
| 716 | Eight ordered-pair failures, representing four unique overlapping hit-disc pairs: 0/9, 1/8, 2/7, 4/5. Distances are 111, 111, ~109.659 and ~109.836; each needs >112 under the test's radius+8 contract. |
| 761, 763, 766 | Classical geo draws ten Gnostic rows, not nine Ptolemaic rows. MOON, SUN and STARS are absent; URANUS, NEPTUNE and PLUTO are present. |
| 772–777 | Four Earth/Moon/Sun/Stars ordering assertions fail against that changed dataset (some expected bodies do not exist). |
| 785, 792, 795 | No schematic-Ptolemaic caption; selected Mars yields no old `numBandTie` (expected one); extended cross-map remains ten rows (expected twelve). |

The fresh Gnostic row order is VOID, SATURN, EARTH, PLUTO, JUPITER, VENUS,
URANUS, MARS, MERCURY, NEPTUNE in both classical/extended and geo/cross.
Canonical arithmetic, frozen data, and canonical SVG invariance across modes
were not the failing assertions. This is not caused by the Node LTS choice.
The overlaps deserve separate layout review; not every failure can safely be
classified as merely stale semantic expectations. No production code or tests
were changed to make these findings disappear.

**Owner decision needed:** confirm (1) whether canonical/off includes the
Planetwork side panel, (2) whether Gnosticism replaces the tested Ptolemaic
classical/extended/cross-map views, and (3) the intended canonical arrangement
and collision/hit-area requirements. Then repair the chosen product contract
and its regression tests together in a separate reviewed change. An off-mode
early return alone leaves many failures and would not resolve this baseline.

## Owner rollout and required checks

1. Review these local files on `ci/local-test-gate`. Commit/push with the
   owner's normal GitHub Desktop workflow and open a PR to `master`.
   No commit, push, remote settings change or deployment was made here.
2. Inspect the first GitHub run and confirm both named checks actually appear.
   For gematro/ciphersnews, expect the full check to stay red until the Numogram
   decisions and repairs are reviewed. Keep it red; do not hide it with an
   exclusion, `continue-on-error`, or an “expected failure” conversion.
3. **Staged enforcement requires an explicit owner decision.** After the hosted
   safety check has passed, the proposed interim rule for gematro-hyperdope and
   ciphersnews requires `Local tests (safety)` plus independent approval. Keep
   `Local tests (full)` running and visibly red, but not required during that
   recorded temporary baseline exception. This protects the named safety
   regressions, not the full application. Record a baseline-resolution owner
   and next review checkpoint; it is not permission for unrelated feature work.
   If staged enforcement is not approved or configured, CI is observation only.
   For cyphers-news.github.io, require both checks after their hosted runs pass.
4. In repository Settings, configure an **active** branch ruleset/protection for
   `master` that requires PRs, the applicable checks above from GitHub Actions,
   and an up-to-date branch. Confirm actual emitted check names rather than
   guessing a workflow prefix. Apply the appropriate rules separately to each
   repository. After separately reviewed Numogram resolution and a hosted-green
   full run, add `Local tests (full)` as required in the other two repositories
   and close their documented temporary exceptions.
5. Require **at least one independent approving reviewer**, dismiss stale
   approvals after new commits, and require approval of the most recent
   reviewable push by someone other than its pusher where supported. Merely
   requiring a PR is not an approval gate. The PR author cannot approve their
   own PR; a bot's report is not a substitute for the designated human review.
   If the team cannot supply an eligible independent reviewer, the intended
   enforcement is incomplete: report that blocker rather than lowering the
   approval count or bypassing it silently.
6. Remove routine bypass permissions, including administrator bypass where
   available; any retained break-glass role must be named and explicitly
   authorized. Block force pushes and default-branch deletion. Apply review to
   changes in workflows, runners, tests and ownership rules too: a contributor
   can otherwise change what counts as passing. Verify settings and plan/org
   support before claiming enforcement. Existing automatic Pages deployment is
   still separate; protection must prevent unchecked default-branch writes.
7. Verify the configured rules with a disposable PR that deliberately fails an
   existing **required safety case** using synthetic data: the check must turn
   red and normal merge must be blocked. A new test outside the safety list
   would test only the nonrequired full check during staged adoption. Restore
   the safety test, verify hosted green, and verify that missing/stale approval
   still blocks merging. Do not merge the intentionally failing fixture. Do not
   publish private incident probes or exploit fixtures. Leave Pages settings
   unchanged.
These are owner steps, not actions already performed. The workflow alone
cannot prohibit direct pushes or enforce any merge policy.
