---
"superpowers-overrides": major
---

BREAKING: Overrides version scheme is now three-segment `{superpowers-semver}-overrides.{major}.{minor}.{patch}` (e.g. `6.2.0-overrides.0.15.0`). Legacy single-counter `{base}-overrides.{N}` is rejected by release validation. Any superpowers semver segment change resets overrides to `{new-base}-overrides.0.0.0`.
