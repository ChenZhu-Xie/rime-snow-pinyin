# Repository operating rules

## Upstream integration

- Learn the intent of each upstream change instead of copying its literal keys or code.
- When an upstream feature depends on a keyboard layout, remap its initials, finals, tones, auxiliary keys, empty slots, and candidate behavior to the equivalent semantics of this repository's current layouts.
- Before accepting an upstream encoding change, measure collisions or vacant-code usage in both layouts and add regression coverage for the locally adapted behavior.
- Keep generators, generated artifacts, documentation, and tests synchronized with every semantic migration.

## Releases

- Before every release, fetch and inspect the upstream repository's tags.
- Always use the upstream repository's latest tag as this repository's release tag, keeping the latest tag number exactly aligned with upstream; never invent or independently increment a version number for local changes.

## Rime integration tests

- Do not attempt to run Mira through this machine's WSL or Docker environments; they are not suitable for the repository's real Rime candidate tests.
- Run local static, generation, and corpus checks first, then push the branch and use GitHub Actions for Mira-based schema and candidate verification.
