#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="$ROOT/apps/web"
FONT_DIR="$WEB_DIR/public/fonts"
FONT_PKG="$WEB_DIR/node_modules/@fontsource/line-seed-jp/files"

TH="$FONT_DIR/LINESeedSans_W_Th.woff2"
RG="$FONT_DIR/LINESeedSans_W_Rg.woff2"
BD="$FONT_DIR/LINESeedSans_W_Bd.woff2"
TH_TH="$FONT_DIR/LINESeedSansTH_Th.ttf"
RG_TH="$FONT_DIR/LINESeedSansTH_Rg.ttf"
BD_TH="$FONT_DIR/LINESeedSansTH_Bd.ttf"
TH_PKG="$WEB_DIR/node_modules/@fontpkg/line-seed-sans-th"

mkdir -p "$FONT_DIR"

copy_from_pkg() {
  local src="$1"
  local dest="$2"
  if [[ ! -f "$src" ]]; then
    echo "Missing fontsource file: $src"
    echo "Run: cd apps/web && npm install --legacy-peer-deps"
    exit 1
  fi
  cp "$src" "$dest"
}

if [[ ! -d "$FONT_PKG" ]]; then
  echo "Installing @fontsource/line-seed-jp..."
  (cd "$WEB_DIR" && npm install --save-dev @fontsource/line-seed-jp --legacy-peer-deps)
fi

copy_from_pkg "$FONT_PKG/line-seed-jp-latin-100-normal.woff2" "$TH"
copy_from_pkg "$FONT_PKG/line-seed-jp-latin-400-normal.woff2" "$RG"
copy_from_pkg "$FONT_PKG/line-seed-jp-latin-700-normal.woff2" "$BD"

if [[ ! -d "$TH_PKG" ]]; then
  echo "Installing @fontpkg/line-seed-sans-th..."
  (cd "$WEB_DIR" && npm install --save-dev @fontpkg/line-seed-sans-th --legacy-peer-deps)
fi

copy_from_pkg "$TH_PKG/LINESeedSansTH_Th.ttf" "$TH_TH"
copy_from_pkg "$TH_PKG/LINESeedSansTH_Rg.ttf" "$RG_TH"
copy_from_pkg "$TH_PKG/LINESeedSansTH_Bd.ttf" "$BD_TH"

echo "LINE Seed Sans fonts installed:"
echo "  $TH"
echo "  $RG"
echo "  $BD"
echo "  $TH_TH"
echo "  $RG_TH"
echo "  $BD_TH"
