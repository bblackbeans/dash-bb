#!/bin/sh
set -eu

mkdir -p /data/uploads
if [ ! -L /app/public/uploads ]; then
  rm -rf /app/public/uploads
  ln -s /data/uploads /app/public/uploads
fi

cd /app
npx prisma db push --skip-generate
node prisma/ensure-admin.mjs
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
