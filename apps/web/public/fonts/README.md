# LINE Seed Sans

Self-hosted font files for the Platform Control dashboard.

Install from the repo root:

```bash
./scripts/setup-fonts.sh
```

This copies:

**Latin (woff2 via `@fontsource/line-seed-jp`)**
- `LINESeedSans_W_Th.woff2` — Thin (100)
- `LINESeedSans_W_Rg.woff2` — Regular (400)
- `LINESeedSans_W_Bd.woff2` — Bold (700)

**Thai (ttf via `@fontpkg/line-seed-sans-th`)**
- `LINESeedSansTH_Th.ttf` — Thin (100)
- `LINESeedSansTH_Rg.ttf` — Regular (400)
- `LINESeedSansTH_Bd.ttf` — Bold (700)

Both subsets share the CSS family name `LINE Seed Sans` with `unicode-range` so Latin and Thai render with matching LINE typography.

License: SIL Open Font License (LINE Seed / Dalton Maag).

Until fonts are installed, the UI falls back to system sans-serif defined in `globals.css`.
