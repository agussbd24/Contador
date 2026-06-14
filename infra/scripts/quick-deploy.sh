#!/bin/bash
# Quick deploy: assumes wrangler.toml is already configured
set -e

cd "$(dirname "$0")/../.."

echo "Deploying Worker..."
cd cf-worker
wrangler deploy

echo "Building frontend..."
cd frontend
npm install
npm run build

echo "Deploying to Pages..."
cd ..
cd frontend
wrangler pages deploy dist --project-name=solana-quant-web
cd ../..

echo "Done!"
echo "Worker:  https://solana-quant.*.workers.dev"
echo "Frontend: https://solana-quant-web.pages.dev"
