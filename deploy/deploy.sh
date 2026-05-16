#!/bin/bash
# WePlan 一键部署脚本
# 使用: bash deploy.sh

set -e

SERVER="121.41.74.45"
USER="root"
PASS="Meituan666"
REMOTE_DIR="/opt/weplan"

echo "=== WePlan 部署开始 ==="

# 1. 打包项目
echo "[1/6] 打包项目..."
tar -czf /tmp/weplan.tar.gz -C "$(dirname "$0")/.." \
    backend frontend docs deploy requirements.txt .env

# 2. 上传到服务器
echo "[2/6] 上传到服务器..."
sshpass -p "$PASS" scp /tmp/weplan.tar.gz ${USER}@${SERVER}:/tmp/

# 3. 解压并安装
echo "[3/6] 解压并安装依赖..."
sshpass -p "$PASS" ssh ${USER}@${SERVER} << 'REMOTE'
    mkdir -p /opt/weplan
    tar -xzf /tmp/weplan.tar.gz -C /opt/weplan
    cd /opt/weplan

    # 安装Python依赖
    pip3 install -r requirements.txt

    # 复制nginx配置
    cp deploy/nginx.conf /etc/nginx/sites-available/weplan
    ln -sf /etc/nginx/sites-available/weplan /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default

    # 复制systemd服务
    cp deploy/systemd/weplan.service /etc/systemd/system/
    systemctl daemon-reload
REMOTE

# 4. 启动服务
echo "[4/6] 启动服务..."
sshpass -p "$PASS" ssh ${USER}@${SERVER} << 'REMOTE'
    systemctl restart weplan
    systemctl enable weplan
    nginx -t && systemctl restart nginx
REMOTE

# 5. 验证
echo "[5/6] 验证服务..."
sleep 3
curl -s http://${SERVER}/ | head -1
curl -s http://${SERVER}/api/cases | head -1

echo "[6/6] 部署完成！"
echo "  展示页: http://${SERVER}/"
echo "  Demo:   http://${SERVER}/demo"
echo "  API:    http://${SERVER}/api/cases"
