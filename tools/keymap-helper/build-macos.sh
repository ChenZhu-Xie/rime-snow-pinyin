#!/usr/bin/env bash
set -euo pipefail

repository=$(cd -- "$(dirname -- "$0")/../.." && pwd)
helper="$repository/tools/keymap-helper"
rustup target add x86_64-apple-darwin aarch64-apple-darwin
for target in x86_64-apple-darwin aarch64-apple-darwin; do
  cargo build --release --locked --manifest-path "$helper/Cargo.toml" --target "$target"
done
mkdir -p "$helper/target/universal"
binary="$helper/target/universal/snow-keymap"
lipo -create \
  "$helper/target/x86_64-apple-darwin/release/snow-keymap" \
  "$helper/target/aarch64-apple-darwin/release/snow-keymap" \
  -output "$binary"
codesign --force --sign - "$binary"
lipo "$binary" -verify_arch x86_64 arm64
codesign --verify --strict "$binary"
