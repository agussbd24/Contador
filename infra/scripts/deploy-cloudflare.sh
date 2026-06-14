#!/bin/bash
# ═══════════════════════════════════════════════════════════
# CLOUDFLARE DEPLOY - Solana Quant Platform (Worker + Pages)
# ═══════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cd "$(dirname "$0")/../.."

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Cloudflare Deploy - Solana Quant v2.0${NC}"
echo -e "${GREEN}============================================${NC}"

# ─── STEP 1: Install wrangler ───
echo -e "\n${YELLOW}[1/7] Installing Wrangler CLI...${NC}"
if ! command -v wrangler &> /dev/null; then
  npm install -g wrangler
fi
echo "Wrangler: $(wrangler --version)"

# ─── STEP 2: Login to Cloudflare ───
echo -e "\n${YELLOW}[2/7] Login to Cloudflare...${NC}"
wrangler login

# ─── STEP 3: Create D1 Database ───
echo -e "\n${YELLOW}[3/7] Creating D1 Database...${NC}"
cd cf-worker
D1_OUTPUT=$(wrangler d1 create solana-quant-db 2>&1 || true)
echo "$D1_OUTPUT"

DB_ID=$(echo "$D1_OUTPUT" | grep -oP 'database_id = "\K[^"]+' || echo "")
if [ -n "$DB_ID" ]; then
  sed -i.bak "s/YOUR_D1_DATABASE_ID/$DB_ID/" wrangler.toml
  rm -f wrangler.toml.bak
  echo -e "${GREEN}D1 Database created: $DB_ID${NC}"
else
  echo -e "${YELLOW}Using existing D1 Database from wrangler.toml${NC}"
fi

# ─── STEP 4: Create KV Namespace ───
echo -e "\n${YELLOW}[4/7] Creating KV Namespace...${NC}"
KV_OUTPUT=$(wrangler kv namespace create KV 2>&1 || true)
echo "$KV_OUTPUT"

KV_ID=$(echo "$KV_OUTPUT" | grep -oP 'id = "\K[^"]+' || echo "")
if [ -n "$KV_ID" ]; then
  sed -i.bak "s/YOUR_KV_NAMESPACE_ID/$KV_ID/" wrangler.toml
  rm -f wrangler.toml.bak
  echo -e "${GREEN}KV Namespace created: $KV_ID${NC}"
fi

# ─── STEP 5: Initialize Database ───
echo -e "\n${YELLOW}[5/7] Initializing D1 Schema...${NC}"
wrangler d1 execute solana-quant-db --file=../data/migrations/001_cf_schema.sql

# ─── STEP 6: Set Secrets ───
echo -e "\n${YELLOW}[6/7] Setting Secrets...${NC}"
echo "Telegram Bot Token (Enter to skip):"
read -r TG_TOKEN
if [ -n "$TG_TOKEN" ]; then
  echo "$TG_TOKEN" | wrangler secret put TELEGRAM_BOT_TOKEN
fi

echo "Telegram Chat ID (Enter to skip):"
read -r TG_CHAT
if [ -n "$TG_CHAT" ]; then
  echo "$TG_CHAT" | wrangler secret put TELEGRAM_CHAT_ID
fi

# ─── STEP 7: Deploy Worker ───
echo -e "\n${YELLOW}[7/7] Deploying Worker...${NC}"
wrangler deploy

# ─── Deploy Frontend to Pages ───
echo -e "\n${YELLOW}[BONUS] Building & Deploying Frontend to Cloudflare Pages...${NC}"
cd frontend
npm install
npm run build
cd ..
cd ..
cd cf-worker/frontend
wrangler pages deploy dist --project-name=solana-quant-web
cd ../..

echo -e "\n${GREEN}============================================${NC}"
echo -e "${GREEN}  DEPLOYMENT COMPLETE!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${BLUE}Backend (Worker):${NC}"
echo "  https://solana-quant.YOUR_SUBDOMAIN.workers.dev"
echo ""
echo -e "${BLUE}Frontend (Pages):${NC}"
echo "  https://solana-quant-web.pages.dev"
echo ""
echo -e "${BLUE}Endpoints:${NC}"
echo "  /          Status"
echo "  /health    Health check"
echo "  /price     Current SOL price"
echo "  /signal    Full analysis signal"
echo "  /market    Market data"
echo "  /klines/4h Candle data"
echo ""
echo -e "${YELLOW}Cron: Every 5 minutes (auto-analysis)${NC}"
echo -e "${YELLOW}Logs: wrangler tail${NC}"
