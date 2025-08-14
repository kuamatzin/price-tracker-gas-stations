#!/bin/sh
set -e

echo "Starting FuelIntel Scraper..."

if [ "$1" = "scrape" ]; then
  exec npm run scrape
elif [ "$1" = "dev" ]; then
  exec npm run dev
elif [ "$1" = "sh" ]; then
  exec sh
else
  exec npm run scrape
fi