#!/bin/sh
# Git credential helper: логин/пароль для GitHub из GITHUB_TOKEN или файла .github_token в корне репо
# Использование: export GITHUB_TOKEN=ghp_xxx  ИЛИ  положите токен в .github_token
[ "$1" = "get" ] || exit 0
while read -r line; do :; done
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN_FILE="$REPO_ROOT/.github_token"
echo "username=tradelk"
if [ -n "$GITHUB_TOKEN" ]; then
  echo "password=$GITHUB_TOKEN"
elif [ -f "$TOKEN_FILE" ]; then
  echo "password=$(cat "$TOKEN_FILE")"
fi
