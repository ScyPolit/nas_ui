#!/usr/bin/env sh
set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$PROJECT_ROOT/web"
npm ci
npm test
npm run build

cd "$PROJECT_ROOT"
cargo fmt --all -- --check
cargo build --locked --release
echo "构建完成：$PROJECT_ROOT/target/release/dufs"
