---
"@oscaner-skills/cdd-engine": minor
---

Register the round and document identity domains in the artifact matrix. `CarrierRulings.pathFor` is retired: the rulings sidecar's name is rendered from the REVIEWED round's identity, so a fix dispatch handed a draft carrier reads the same `<line>-<op>-<cycle>.c<cycle>.rulings.json` sidecar a final carrier names. `SlugIndex#identityDoc` / `#planOf` are retired in favour of `docsOf(slug)` (the set, 0/1/n) and `hasIdentity(slug)`; the document domain's `read` reports a duplicated identity as `invalid(found)` while `attribute` still answers the identity.
