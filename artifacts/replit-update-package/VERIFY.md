# Replit Post-Update Verification

## 1) Git commit proof

```bash
git rev-parse HEAD
git log --oneline -n 3
```

Expected latest includes:
- `7f17752 fix(release): bump desktop app package version to 2.2.24`

## 2) App version proof (source)

```bash
grep -n "APP_VERSION_TAG" artifacts/design-tool/src/lib/appVersion.ts
```

Expected:
- `APP_VERSION_TAG = "v2.2.24"`

## 3) API install fallback proof

```bash
grep -n "LATEST_KNOWN_TAG" artifacts/api-server/src/routes/install.ts
```

Expected:
- `LATEST_KNOWN_TAG = "v2.2.24"`

## 4) UI runtime proof

1. Open app route.
2. Hard refresh once (`Ctrl+Shift+R`).
3. Confirm version text is not stuck at `v2.2.23`.
4. Confirm new features banner appears on home for first load after version change.

## 5) If still old version appears

- Clear browser cache and site data.
- Restart Replit run process.
- For deployments: trigger a fresh deploy build (deployment does not always auto-rebuild on git push).
