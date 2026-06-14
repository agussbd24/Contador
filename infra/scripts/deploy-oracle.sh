#!/bin/bash
# ═══════════════════════════════════════════════════════════
# SOLANA QUANT PLATFORM - Oracle Cloud Deploy Script
# ═══════════════════════════════════════════════════════════

set -e

echo "============================================"
echo "  SOLANA QUANT PLATFORM - Cloud Deploy"
echo "============================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ─── STEP 1: Update system ───
echo -e "\n${YELLOW}[1/10] Updating system...${NC}"
sudo apt update && sudo apt upgrade -y

# ─── STEP 2: Install Python 3.11+ ───
echo -e "\n${YELLOW}[2/10] Installing Python...${NC}"
sudo apt install -y python3 python3-pip python3-venv

# ─── STEP 3: Install Docker ───
echo -e "\n${YELLOW}[3/10] Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi
sudo apt install -y docker-compose-plugin

# ─── STEP 4: Clone repository ───
echo -e "\n${YELLOW}[4/10] Cloning repository...${NC}"
if [ ! -d "/opt/solana-quant" ]; then
    sudo git clone https://github.com/agussbd24/Contador.git /opt/solana-quant
fi
cd /opt/solana-quant

# ─── STEP 5: Create .env ───
echo -e "\n${YELLOW}[5/10] Configuring environment...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${RED}>>> EDITA .env con tus datos:${NC}"
    echo -e "${RED}    nano /opt/solana-quant/.env${NC}"
fi

# ─── STEP 6: Setup Python venv ───
echo -e "\n${YELLOW}[6/10] Setting up Python environment...${NC}"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# ─── STEP 7: Setup PostgreSQL ───
echo -e "\n${YELLOW}[7/10] Installing PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
    sudo apt install -y postgresql postgresql-contrib
fi
sudo -u postgres psql -c "CREATE USER solana_quant WITH PASSWORD 'solana_quant';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE solana_quant OWNER solana_quant;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE solana_quant TO solana_quant;" 2>/dev/null || true

# Apply schema
PGPASSWORD=solana_quant psql -h localhost -U solana_quant -d solana_quant -f data/migrations/001_initial_schema.sql 2>/dev/null || true

# ─── STEP 8: Setup Redis ───
echo -e "\n${YELLOW}[8/10] Installing Redis...${NC}"
if ! command -v redis-cli &> /dev/null; then
    sudo apt install -y redis-server
    sudo systemctl enable redis-server
    sudo systemctl start redis-server
fi

# ─── STEP 9: Create systemd service ───
echo -e "\n${YELLOW}[9/10] Creating systemd service...${NC}"
sudo tee /etc/systemd/system/solana-quant.service > /dev/null <<EOF
[Unit]
Description=Solana Quant Platform
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/solana-quant
Environment=PATH=/opt/solana-quant/venv/bin
ExecStart=/opt/solana-quant/venv/bin/python -m backend.main
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable solana-quant
sudo systemctl start solana-quant

# ─── STEP 10: Open firewall ───
echo -e "\n${YELLOW}[10/10] Configuring firewall...${NC}"
sudo ufw allow 22/tcp 2>/dev/null || true
sudo ufw allow 8000/tcp 2>/dev/null || true
sudo ufw allow 3000/tcp 2>/dev/null || true
sudo ufw --force enable 2>/dev/null || true

echo -e "\n${GREEN}============================================"
echo -e "  DEPLOYMENT COMPLETE!"
echo -e "============================================${NC}"
echo -e ""
echo -e "Backend API: http://$(curl -s ifconfig.me):8000"
echo -e "Health:      http://$(curl -s ifconfig.me):8000/health"
echo -e "Signal:      http://$(curl -s ifconfig.me):8000/signal"
echo -e ""
echo -e "Service status: sudo systemctl status solana-quant"
echo -e "View logs:      sudo journalctl -u solana-quant -f"
echo -e "Restart:        sudo systemctl restart solana-quant"
echo -e ""
echo -e "${YELLOW}>>> IMPORTANTE: Edita /opt/solana-quant/.env${NC}"
echo -e "${YELLOW}    con tus tokens de Telegram y CoinGecko${NC}"
echo -e "${YELLOW}    Luego reinicia: sudo systemctl restart solana-quant${NC}"
