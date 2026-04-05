# Replit Update Package

This folder is a ready handoff package to update Replit to latest `main` safely.

Current expected version:
- `APP_VERSION_TAG`: `v2.2.24`
- Expected commit on `main`: `7f17752be99542f09c0b36acad2501b6cb1f11e6`

## How to run on Replit

1. Open Replit Shell in project root.
2. Run:

```bash
bash artifacts/replit-update-package/replit_update.sh
```

3. Restart Replit app/deployment after script completes.

## If script stops with "working tree dirty"

Either commit pending local work first, or discard local changes intentionally, then rerun:

```bash
git fetch origin main
git reset --hard origin/main
bash artifacts/replit-update-package/replit_update.sh
```

## Verification

After update, follow:
- [VERIFY.md](./VERIFY.md)
