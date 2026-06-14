#!/bin/bash
# ═══════════════════════════════════════════════════════════
# QUICK SETUP - Copiar y pegar en la terminal de Oracle Cloud
# ═══════════════════════════════════════════════════════════

# 1. Actualizar sistema
sudo apt update && sudo apt upgrade -y

# 2. Instalar dependencias
sudo apt install -y python3 python3-pip python3-venv postgresql postgresql-contrib redis-server git curl

# 3. Clonar proyecto
sudo git clone https://github.com/agussbd24/Contador.git /opt/solana-quant
sudo chown -R $USER:$USER /opt/solana-quant
cd /opt/solana-quant

# 4. Crear entorno Python
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 5. Configurar PostgreSQL
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo -u postgres psql -c "CREATE USER solana_quant WITH PASSWORD 'solana_quant';"
sudo -u postgres psql -c "CREATE DATABASE solana_quant OWNER solana_quant;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE solana_quant TO solana_quant;"
PGPASSWORD=solana_quant psql -h localhost -U solana_quant -d solana_quant -f data/migrations/001_initial_schema.sql

# 6. Configurar Redis
sudo systemctl enable redis-server
sudo systemctl start redis-server

# 7. Crear .env
cp .env.example .env

# 8. Crear servicio systemd
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

# 9. Abrir puertos
sudo ufw allow 22/tcp
sudo ufw allow 8000/tcp
sudo ufw --force enable

# 10. Mostrar estado
echo ""
echo "============================================"
echo "  INSTALADO! Verificando..."
echo "============================================"
echo ""
sudo systemctl status solana-quant --no-pager
echo ""
IP=$(curl -s ifconfig.me)
echo "API: http://$IP:8000"
echo "Health: http://$IP:8000/health"
echo ""
echo "Para ver logs: sudo journalctl -u solana-quant -f"
echo "Para reiniciar: sudo systemctl restart solana-quant"
