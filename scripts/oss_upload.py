#!/usr/bin/env python3
"""把本地文件传到 OSS，返回一个公网能下的 URL。

seo_server.py 那边要自己去下载 video_url，所以不管用户是贴链接还是传文件，
最后都得给它一个公网地址——这个脚本就是干这个的。

TODO: 现在借用的是 A-jogg-video-understanding 的 OSS 配置
（Nacos: dev-ap-comfyui-opensource-worker，临时目录 OSS_TMP_DIR）。
后续要换成正式的 OSS 桶 / 路径时，改 OSS_UTILS_REPO 指到新仓库，
或者把下面 load_oss_config() 里的 import 换掉即可，Node 那边不用动。

用法：

    python3 scripts/oss_upload.py --file a.mp4 --out url.txt [--prefix dir/]

URL 写进 --out 而不是 stdout：Nacos / titan 的日志会往 stdout 上打。

环境变量：
  OSS_UTILS_REPO   提供 utils/oss_config.py 的仓库（它的 src 目录会进 sys.path）
                   默认 /datadisk1/xieshiji/code/A-jogg-video-understanding/jogg-video-understanding
  OSS_PREFIX       对象名前缀，默认用那边的 OSS_TMP_DIR
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

DEFAULT_REPO = "/datadisk1/xieshiji/code/A-jogg-video-understanding/jogg-video-understanding"

# 超过这个大小走分片续传，小文件一把梭更快。
RESUMABLE_THRESHOLD = 64 * 1024 * 1024


def load_oss_config():
    """只借凭证，不借上传函数。

    那边的 oss_utils.oss_up_bytes 要求先把整个文件读进内存，几百 MB 的
    原片这么搞不合适，所以凭证用它的，传输自己用 oss2 走流式。
    """
    repo = Path(os.environ.get("OSS_UTILS_REPO", DEFAULT_REPO)).resolve()
    src = repo / "src"
    if not src.is_dir():
        raise SystemExit(f"找不到 OSS 配置仓库：{src}（用 OSS_UTILS_REPO 指过去）")
    if str(src) not in sys.path:
        sys.path.insert(0, str(src))

    from utils.oss_config import (  # noqa: E402  (路径得先设好才能 import)
        AI_CENTER_CDN_URL,
        BUKET_NAME,
        ENDPOINT,
        OSS_AK,
        OSS_SK,
        OSS_TMP_DIR,
    )

    missing = [
        name
        for name, value in (
            ("OSS_AK", OSS_AK),
            ("OSS_SK", OSS_SK),
            ("ENDPOINT", ENDPOINT),
            ("BUKET_NAME", BUKET_NAME),
            ("AI_CENTER_CDN_URL", AI_CENTER_CDN_URL),
        )
        if not value
    ]
    if missing:
        raise SystemExit(f"OSS 配置不全，缺：{', '.join(missing)}")

    return {
        "ak": OSS_AK,
        "sk": OSS_SK,
        "endpoint": ENDPOINT,
        "bucket": BUKET_NAME,
        "cdn": AI_CENTER_CDN_URL,
        "tmp_dir": OSS_TMP_DIR,
    }


def object_name(prefix: str, source: Path) -> str:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    suffix = source.suffix.lower() or ".mp4"
    return f"{prefix.strip('/')}/seo_web_{stamp}{suffix}"


def upload(source: Path, prefix: str) -> str:
    import oss2

    config = load_oss_config()
    bucket = oss2.Bucket(
        oss2.Auth(config["ak"], config["sk"]),
        config["endpoint"],
        config["bucket"],
    )
    key = object_name(prefix or config["tmp_dir"], source)

    if source.stat().st_size > RESUMABLE_THRESHOLD:
        oss2.resumable_upload(bucket, key, str(source), num_threads=4)
    else:
        bucket.put_object_from_file(key, str(source))

    # URL 的拼法和 utils/oss_utils.py 保持一致：CDN 域名 + 对象名。
    return config["cdn"].rstrip("/") + "/" + key.lstrip("/")


def main() -> None:
    parser = argparse.ArgumentParser(description="上传文件到 OSS，输出公网 URL")
    parser.add_argument("--file", required=True, help="要上传的本地文件")
    parser.add_argument("--out", required=True, help="URL 写到这个文件里")
    parser.add_argument("--prefix", default=os.environ.get("OSS_PREFIX", ""), help="对象名前缀")
    args = parser.parse_args()

    source = Path(args.file)
    if not source.is_file():
        raise SystemExit(f"文件不存在：{source}")

    try:
        url = upload(source, args.prefix)
    except SystemExit:
        raise
    except Exception as exc:  # 堆栈对前端没用，给一句人话
        raise SystemExit(f"上传 OSS 失败：{exc}") from exc

    Path(args.out).write_text(url, encoding="utf-8")
    print(f"[oss_upload] {source.name} → {url}", file=sys.stderr)


if __name__ == "__main__":
    main()
