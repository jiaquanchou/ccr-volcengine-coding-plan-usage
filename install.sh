#!/bin/sh
# 将本目录的 CCR 插件同步到本机扩展目录；不会修改 CCR 的账户或供应商配置。
set -eu

plugin_id=volcengine-coding-plan-usage
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
target_dir="$HOME/.claude-code-router/extensions/$plugin_id"
dry_run=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target)
      [ "$#" -ge 2 ] || { printf '缺少 --target 路径\n' >&2; exit 2; }
      target_dir=$2
      shift 2
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    *)
      printf '用法：%s [--target 插件目录绝对路径] [--dry-run]\n' "$0" >&2
      exit 2
      ;;
  esac
done

case "$target_dir" in
  /*) ;;
  *) printf '目标目录必须是绝对路径：%s\n' "$target_dir" >&2; exit 2 ;;
esac

if [ -L "$target_dir" ] || { [ -e "$target_dir" ] && [ ! -d "$target_dir" ]; }; then
  printf '目标目录不是普通目录：%s\n' "$target_dir" >&2
  exit 1
fi

for name in plugin.json index.cjs; do
  if [ ! -f "$source_dir/$name" ] || [ -L "$target_dir/$name" ]; then
    printf '源文件缺失或目标是符号链接：%s\n' "$name" >&2
    exit 1
  fi
done

if command -v node >/dev/null 2>&1; then
  node --check "$source_dir/index.cjs"
fi

printf '插件源码：%s\n运行目录：%s\n' "$source_dir" "$target_dir"
if [ "$dry_run" -eq 1 ]; then
  for name in plugin.json index.cjs; do
    if [ -f "$target_dir/$name" ] && cmp -s "$source_dir/$name" "$target_dir/$name"; then
      printf '无需更新：%s\n' "$name"
    else
      printf '将同步：%s\n' "$name"
    fi
  done
  printf '预演完成；未写入文件。\n'
  exit 0
fi

umask 077
mkdir -p "$target_dir"
backup_suffix=$(date '+%Y%m%d%H%M%S').$$

for name in plugin.json index.cjs; do
  source_file="$source_dir/$name"
  target_file="$target_dir/$name"
  if [ -f "$target_file" ] && cmp -s "$source_file" "$target_file"; then
    printf '已是最新：%s\n' "$name"
    continue
  fi
  if [ -e "$target_file" ]; then
    cp -p "$target_file" "$target_file.bak.$backup_suffix"
  fi
  temporary_file=$(mktemp "$target_dir/.$name.XXXXXX")
  cp "$source_file" "$temporary_file"
  mv "$temporary_file" "$target_file"
  printf '已同步：%s\n' "$name"
done

printf '请在 CCR 扩展页确认插件已启用，并完整退出、重新打开 CCR 以加载新版本。\n'
