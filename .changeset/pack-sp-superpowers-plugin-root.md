---
"superpowers-overrides": minor
---

Breaking: Cursor Team Marketplace installs **superpowers** from plugin root (`./plugins/superpowers`) instead of `cursor-plugins/superpowers/`. Removed redundant wrapper; upstream submodule `.cursor-plugin` is the manifest source. Refresh marketplace or reinstall. Adds `cursor-plugins/README.md` documenting hybrid emit (plugin-root vs wrapper). Does not change superpowers submodule content or hook logic.
