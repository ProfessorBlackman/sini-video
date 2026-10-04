#!/bin/sh
# Run sini as the owner of the mounted /work folder, so files it writes belong to you
# and it can write into folders you created. Override with `docker run --user`.
set -e
if [ "$(id -u)" = "0" ] && [ -d /work ]; then
  uid="$(stat -c %u /work)"
  gid="$(stat -c %g /work)"
  if [ "$uid" != "0" ]; then
    exec setpriv --reuid="$uid" --regid="$gid" --clear-groups env HOME=/tmp sini "$@"
  fi
fi
exec sini "$@"
