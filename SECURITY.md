# Security Policy

## Reporting a vulnerability

Please report security issues **privately**, not as a public issue or pull request.

- Preferred: open a private [GitHub Security Advisory](../../security/advisories/new) on this repo.
- Or email **hyperdopeofficial@protonmail.com** with the details and, if possible, a minimal
  reproduction.

We aim to acknowledge reports within a few days. This is a small, volunteer-maintained project, so
please allow reasonable time for a fix before any public disclosure. Fixes ship in the next release;
we'll credit reporters who want it.

## Scope

This is a **client-side** calculator: static HTML, CSS, and JavaScript with no backend and no
accounts. It runs entirely in the visitor's browser. The most relevant issue class is therefore
**cross-site scripting (XSS)** — untrusted text (a typed phrase, an imported cipher/settings/history
file, or a custom cipher name) reaching the DOM as markup. All user-supplied text is escaped at
render (`escHtml`) and cipher/settings imports are parsed as data, never `eval`'d.

In scope: XSS and injection in the calculator code; unsafe handling of imported files; anything that
lets one file or link run code in a user's browser at this origin.

Out of scope: how a given operator deploys or hosts a copy (serve only the built page, not the repo
`.git`/tooling); third-party CDNs; issues requiring a already-compromised browser or machine.

## Deploying safely

If you self-host, serve the **page files only** behind a static web server, ideally with a
Content-Security-Policy. Do not expose the repository's `.git` directory or tooling from your web
root.

## Supported versions

Security fixes are made against the latest release on `master`.
