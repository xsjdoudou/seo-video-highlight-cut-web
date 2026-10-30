#!/usr/bin/env bash

# 这是 AWS 命令清单。
# 请复制需要的单条命令，不要直接执行整个文件。

# 启动 web
sudo systemctl enable --now web

# 启动 clip-api
sudo systemctl enable --now clip-api

# 启动全部 AWS 服务
sudo systemctl daemon-reload
sudo systemctl enable --now clip-api web nginx

# 重启 web
sudo systemctl restart web

# 重启 clip-api
sudo systemctl restart clip-api

# 重启全部 AWS 服务
sudo systemctl daemon-reload
sudo systemctl restart clip-api web nginx

# 查看 web 日志
sudo journalctl -u web -f -o cat

# 查看 clip-api 日志
sudo journalctl -u clip-api -f -o cat

# 查看 nginx 日志
sudo journalctl -u nginx -f -o cat

# 查看全部 AWS 日志
sudo journalctl -u clip-api -u web -u nginx -f -o cat

# 查看服务状态
sudo systemctl status clip-api web nginx --no-pager

# 拉取最新代码
cd /home/ubuntu/code/seo-video-highlight-cut-web
git pull --ff-only

# 构建前端
npm run build

# 发布前端文件
sudo rsync -a dist/ /srv/seo-video-highlight-cut-web/dist/

# 发布前端后重启 web
sudo systemctl restart web

# 测试网站
curl -I --connect-timeout 5 --max-time 10 https://video-highlight.com

# 测试 Worker 接口
WORKER_TOKEN_VALUE=$(sudo awk -F= '$1=="WORKER_TOKEN"{print substr($0,index($0,"=")+1)}' /etc/seo-video-highlight/web.env)
curl -i --connect-timeout 5 --max-time 10 -H "Authorization: Bearer ${WORKER_TOKEN_VALUE}" "https://video-highlight.com/api/worker/jobs/next?wait=1"
unset WORKER_TOKEN_VALUE
