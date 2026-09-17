# Marketing site tooling

This private package owns the dependencies needed to generate and validate the
marketing site. Sources remain in `docs-src/`, generators in `scripts/`, and
ignored output in `docs/` at the repository root.

From the repository root, without installing the mobile application:

```sh
npm ci --prefix apps/site
npm run build --prefix apps/site
npm run check --prefix apps/site
```

The root `npm ci`, `npm run docs:build`, and `npm run docs:check` remain supported.
The root package depends on this local package so normal Node resolution works
for both installations. Existing deployment commands remain compatible. Using the
smaller standalone installation in CI or a hosting provider requires a separate
configuration change; this package does not apply that change.

Only core build/check dependencies belong here. Deployment, optional browser
SEO audits, and mobile tooling still use their existing root commands. Keep the
standalone lockfile and root lockfile consistent when updating dependencies.
