#!/usr/bin/env bash

# AWS 生产机运维脚本。
#
# 使用前请确认：
#   1. 源码目录是 /home/ubuntu/code/seo-video-highlight-cut-web
#   2. 部署目录是 /srv/seo-video-highlight-cut-web
#   3. systemd 服务名是 clip-api、web、nginx
#
# 常用命令：
#   ./deploy/aws-ops.sh start       启动并设置开机自启
#   ./deploy/aws-ops.sh restart     重启 AWS 服务
#   ./deploy/aws-ops.sh build       构建并发布前端，只重启 web
#   ./deploy/aws-ops.sh update      拉取代码、构建并发布前端
#   ./deploy/aws-ops.sh status      查看服务状态
#   ./deploy/aws-ops.sh logs-api    查看 clip-api 实时日志
#   ./deploy/aws-ops.sh logs-web    查看 web 实时日志
#   ./deploy/aws-ops.sh logs-nginx  查看 nginx 实时日志
#   ./deploy/aws-ops.sh logs-all    同时查看所有 AWS 服务日志
#   ./deploy/aws-ops.sh relay       查看任务中继文件
#   ./deploy/aws-ops.sh worker-test 测试 Worker 拉取接口
#   ./deploy/aws-ops.sh health      测试网站 HTTPS
#   ./deploy/aws-ops.sh help        查看帮助

set -Eeuo pipefail

# 源码目录和实际运行目录可以通过环境变量覆盖。
SOURCE_DIR="${SOURCE_DIR:-/home/ubuntu/code/seo-video-highlight-cut-web}"
DEPLOY_DIR="${DEPLOY_DIR:-/srv/seo-video-highlight-cut-web}"
ENV_FILE="${ENV_FILE:-/etc/seo-video-highlight/web.env}"
PUBLIC_URL="${PUBLIC_URL:-https://video-highlight.com}"

die() {
  echo "错误：$*" >&2
  exit 1
}

need_command() {
  command -v "$1" >/dev/null 2>&1 || die "找不到命令：$1"
}

check_source_dir() {
  [[ -d "$SOURCE_DIR" ]] || die "源码目录不存在：$SOURCE_DIR"
  [[ -f "$SOURCE_DIR/package.json" ]] || die "不是前端项目目录：$SOURCE_DIR"
}

check_deploy_dir() {
  [[ -d "$DEPLOY_DIR" ]] || die "部署目录不存在：$DEPLOY_DIR"
}

start_services() {
  echo "启动 clip-api、web、nginx，并设置开机自启..."
  sudo systemctl daemon-reload
  sudo systemctl enable --now clip-api web nginx
}

stop_services() {
  echo "停止 clip-api、web、nginx..."
  sudo systemctl stop clip-api web nginx
}

restart_services() {
  echo "重启 clip-api、web、nginx..."
  sudo systemctl daemon-reload
  sudo systemctl restart clip-api web nginx
}

build_frontend() {
  need_command npm
  need_command rsync
  check_source_dir
  check_deploy_dir

  echo "开始构建前端：$SOURCE_DIR"
  cd "$SOURCE_DIR"
  npm run build

  [[ -d "$SOURCE_DIR/dist" ]] || die "构建完成但没有找到 dist 目录"

  echo "发布 dist 到：$DEPLOY_DIR/dist"
  sudo mkdir -p "$DEPLOY_DIR/dist"
  sudo rsync -a "$SOURCE_DIR/dist/" "$DEPLOY_DIR/dist/"

  # 只改前端时不需要重启 clip-api，web 重新加载 dist 即可。
  echo "重启 web 服务，使新的前端文件生效..."
  sudo systemctl restart web
}

update_frontend() {
  need_command git
  check_source_dir

  echo "拉取最新代码..."
  git -C "$SOURCE_DIR" pull --ff-only
  build_frontend
}

show_status() {
  sudo systemctl status clip-api web nginx --no-pager
}

follow_api_logs() {
  sudo journalctl -u clip-api -f -o cat
}

follow_web_logs() {
  sudo journalctl -u web -f -o cat
}

follow_nginx_logs() {
  sudo journalctl -u nginx -f -o cat
}

follow_all_logs() {
  sudo journalctl -u clip-api -u web -u nginx -f -o cat
}

show_relay() {
  need_command jq
  check_deploy_dir
  local relay_file="$DEPLOY_DIR/data/worker-relay.json"
  [[ -f "$relay_file" ]] || die "任务中继文件不存在：$relay_file"

  echo "任务中继文件：$relay_file"
  sudo jq '.' "$relay_file"
}

test_worker() {
  need_command curl
  need_command awk
  [[ -f "$ENV_FILE" ]] || die "环境变量文件不存在：$ENV_FILE"

  # 只在内存中读取令牌，不把令牌打印到终端。
  local worker_token
  worker_token="$(sudo awk -F= '$1=="WORKER_TOKEN" {print substr($0,index($0,"=")+1)}' "$ENV_FILE")"
  [[ -n "$worker_token" ]] || die "$ENV_FILE 中没有配置 WORKER_TOKEN"

  echo "测试 Worker 拉取接口（没有任务时应返回 job:null）..."
  curl -i --connect-timeout 5 --max-time 10 \
    -H "Authorization: Bearer ${worker_token}" \
    "$PUBLIC_URL/api/worker/jobs/next?wait=1"
}

test_health() {
  need_command curl
  echo "测试网站：$PUBLIC_URL"
  curl -I --connect-timeout 5 --max-time 10 "$PUBLIC_URL"
}

show_help() {
  sed -n '2,35p' "$0" | sed -n 's/^# \{0,1\}//p'
  echo
  echo "用法：$0 <命令>"
}

main() {
  local action="${1:-help}"

  case "$action" in
    start)       start_services ;;
    stop)        stop_services ;;
    restart)     restart_services ;;
    build)       build_frontend ;;
    update)      update_frontend ;;
    status)      show_status ;;
    logs-api)    follow_api_logs ;;
    logs-web)    follow_web_logs ;;
    logs-nginx)  follow_nginx_logs ;;
    logs-all)    follow_all_logs ;;
    relay)       show_relay ;;
    worker-test) test_worker ;;
    health)      test_health ;;
    help|-h|--help) show_help ;;
    *)
      echo "未知命令：$action" >&2
      show_help
      exit 2
      ;;
  esac
}

main "$@"
