#!/usr/bin/env bash

# AWS 生产机常用命令脚本。
# 用法：./deploy/aws-ops.sh 命令

set -euo pipefail

SOURCE_DIR="/home/ubuntu/code/seo-video-highlight-cut-web"
DEPLOY_DIR="/srv/seo-video-highlight-cut-web"

case "${1:-help}" in
  # 启动 web
  start-web)
    sudo systemctl enable --now web
    ;;

  # 启动 clip-api
  start-api)
    sudo systemctl enable --now clip-api
    ;;

  # 启动全部 AWS 服务
  start-all)
    sudo systemctl daemon-reload
    sudo systemctl enable --now clip-api web nginx
    ;;

  # 重启 web
  restart-web)
    sudo systemctl restart web
    ;;

  # 重启 clip-api
  restart-api)
    sudo systemctl restart clip-api
    ;;

  # 重启全部 AWS 服务
  restart-all)
    sudo systemctl daemon-reload
    sudo systemctl restart clip-api web nginx
    ;;

  # 查看 web 日志
  logs-web)
    sudo journalctl -u web -f -o cat
    ;;

  # 查看 clip-api 日志
  logs-api)
    sudo journalctl -u clip-api -f -o cat
    ;;

  # 查看全部 AWS 日志
  logs-all)
    sudo journalctl -u clip-api -u web -u nginx -f -o cat
    ;;

  # 查看服务状态
  status)
    sudo systemctl status clip-api web nginx --no-pager
    ;;

  # 更新前端并重启 web
  update-web)
    cd "$SOURCE_DIR"
    git pull --ff-only
    npm run build
    sudo rsync -a dist/ "$DEPLOY_DIR/dist/"
    sudo systemctl restart web
    ;;

  # 只构建本地前端并发布，不拉取 Git 代码
  build-web)
    cd "$SOURCE_DIR"
    npm run build
    sudo rsync -a dist/ "$DEPLOY_DIR/dist/"
    sudo systemctl restart web
    ;;

  # 查看帮助
  help|-h|--help)
    cat <<'EOF'
### 启动 web
./deploy/aws-ops.sh start-web

### 启动 clip-api
./deploy/aws-ops.sh start-api

### 启动全部 AWS 服务
./deploy/aws-ops.sh start-all

### 重启 web
./deploy/aws-ops.sh restart-web

### 重启 clip-api
./deploy/aws-ops.sh restart-api

### 重启全部 AWS 服务
./deploy/aws-ops.sh restart-all

### 查看 web 日志
./deploy/aws-ops.sh logs-web

### 查看 clip-api 日志
./deploy/aws-ops.sh logs-api

### 查看全部 AWS 日志
./deploy/aws-ops.sh logs-all

### 查看服务状态
./deploy/aws-ops.sh status

### 更新前端并重启 web
./deploy/aws-ops.sh update-web

### 只构建并发布前端
./deploy/aws-ops.sh build-web
EOF
    ;;

  *)
    echo "未知命令：$1"
    echo "执行 ./deploy/aws-ops.sh help 查看命令"
    exit 1
    ;;
esac
