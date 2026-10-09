#!/bin/sh
# Copy missing files explicitly: directory-level no-clobber may skip an existing volume root.
set -eu
upload_source="${UPLOAD_SOURCE_DIR:-/source}"
upload_target="${UPLOAD_TARGET_DIR:-/uploads}"
upload_mail="${UPLOAD_MAIL_DIR:-/maildev}"
mkdir -p "$upload_target" "$upload_mail"
cd "$upload_source"
find . -type f -print0 | xargs -0 -r sh -ec '
  destination=$1
  shift
  for entry do
    target="$destination/$entry"
    if [ ! -e "$target" ] && [ ! -L "$target" ]; then
      mkdir -p "$(dirname "$target")"
      cp -p "$entry" "$target"
    fi
  done
' sh "$upload_target"
chown -R 1000:1000 "$upload_target" "$upload_mail"
printf 'Persistent upload files: '
find "$upload_target" -type f | wc -l
