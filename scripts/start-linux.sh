#!/usr/bin/env sh
set -eu

if [ "$#" -lt 1 ]; then
  echo "用法：$0 /path/to/share [port] [bind]" >&2
  exit 2
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SHARE_PATH=$1
PORT=${2:-5000}
BIND=${3:-0.0.0.0}
echo "共享目录：$SHARE_PATH"
echo "监听地址：http://$BIND:$PORT"
echo "注意：匿名上传仅适合可信局域网，请勿直接暴露到公网。"
exec "$SCRIPT_DIR/../target/release/dufs" "$SHARE_PATH" --bind "$BIND" --port "$PORT"
