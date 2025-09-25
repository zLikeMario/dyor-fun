#!/bin/zsh
# 启动 Express+WS 服务，自动重启，后台运行，日志输出到 dyorfun.log

LOGFILE="$(dirname "$0")/dyorfun.log"
APP="server.js"

while true; do
  echo "$(date '+%Y-%m-%d %H:%M:%S') 启动服务..." >> "$LOGFILE"
  nohup node "$APP" >> "$LOGFILE" 2>&1 &
  PID=$!
  wait $PID
  echo "$(date '+%Y-%m-%d %H:%M:%S') 服务异常退出，3秒后重启..." >> "$LOGFILE"
  sleep 3
  # 防止僵尸进程
  kill -0 $PID 2>/dev/null && kill $PID
  sleep 1
  # 可加退出条件
  # break
  # 否则无限重启
  # ...
done
