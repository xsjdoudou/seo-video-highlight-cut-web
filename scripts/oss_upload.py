#!/usr/bin/env python3
"""把本地文件传到 OSS，返回一个公网能下的 URL。

seo_server.py 那边要自己去下载 video_url，所以不管用户是贴链接还是传文件，
最后都得给它一个公网地址——这个脚本就是干这个的。

凭证按两条路找，环境变量优先：

1. 环境变量齐了就直接用，不碰 Nacos，也不需要 OSS_UTILS_REPO 那个仓库。
   跨境部署必须走这条——见下面那段说明。
2. 环境变量不全，退回去借 A-jogg-video-understanding 的 Nacos 配置
   （Nacos: dev-ap-comfyui-opensource-worker）。本机联调什么都不用配。

> 为什么要有第 1 条：借用的 utils/oss_config.py 在 **import 时**就调 load_nacos()，
> 而那个 Nacos 端点（mse-80cec970-nacos-ans.mse.aliyuncs.com）解析出来是 VPC 内网地址，
> 海外机器连不上，load_nacos 失败又直接抛异常。上传是每个任务的必经步骤，
> 所以在国内以外的机器上，第 2 条必然走不通。

用法：

    python3 scripts/oss_upload.py --file a.mp4 --out url.txt [--prefix dir/]

URL 写进 --out 而不是 stdout：Nacos / titan 的日志会往 stdout 上打。

环境变量：
  OSS_AK           AccessKey ID
  OSS_SK           AccessKey Secret
  OSS_ENDPOINT     OSS 接入点，例如 https://oss-cn-beijing.aliyuncs.com（兼容 ENDPOINT）
  OSS_BUCKET       桶名（兼容 BUKET_NAME 这个历史拼写）
  OSS_URL_MODE     URL 模式：signed（默认）或 cdn
  OSS_CDN_URL      cdn 模式下拼 URL 用的 CDN 域名（兼容 AI_CENTER_CDN_URL / OSS_URL_HEAD）
  OSS_SIGNED_URL_EXPIRES  signed 模式的有效期，默认 21600 秒
  OSS_TMP_DIR      默认对象前缀，不设就用下面的 DEFAULT_TMP_DIR
  OSS_PREFIX       对象名前缀，优先级高于 OSS_TMP_DIR
  OSS_UTILS_REPO   只在走第 2 条时才用：提供 utils/oss_config.py 的仓库
                   默认 /datadisk1/xieshiji/code/A-jogg-video-understanding/jogg-video-understanding
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

DEFAULT_REPO = "/datadisk1/xieshiji/code/A-jogg-video-understanding/jogg-video-understanding"
DEFAULT_TMP_DIR = "algo-dev/comfyui-data/comfyui-opensource/ComfyUI-Data/temp"

# 超过这个大小走分片续传，小文件一把梭更快。
RESUMABLE_THRESHOLD = 64 * 1024 * 1024

# 缺哪个都传不了。值是「这一项可以从哪些环境变量读」，第一个是推荐写法，
# 后面几个是为了兼容仓库里早就在用的拼写（含 BUKET_NAME 这个历史笔误）。
CREDENTIAL_ENV = {
    "ak": ("OSS_AK",),
    "sk": ("OSS_SK",),
    "endpoint": ("OSS_ENDPOINT", "ENDPOINT"),
    "bucket": ("OSS_BUCKET", "BUKET_NAME"),
    "cdn": ("OSS_CDN_URL", "AI_CENTER_CDN_URL", "OSS_URL_HEAD"),
}

DEFAULT_URL_MODE = "signed"
DEFAULT_SIGNED_URL_EXPIRES = 6 * 60 * 60


def _from_env(names: tuple[str, ...]) -> str:
    for name in names:
        value = os.environ.get(name, "").strip()
        if value:
            return value
    return ""


def requested_url_mode() -> str:
    mode = os.environ.get("OSS_URL_MODE", DEFAULT_URL_MODE).strip().lower()
    if mode not in {"signed", "cdn"}:
        raise SystemExit("OSS_URL_MODE 只能是 signed 或 cdn")
    return mode


def config_from_env() -> tuple[dict[str, str], list[str]]:
    """读环境变量，返回 (配置, 缺失项的推荐变量名)。"""
    config = {key: _from_env(names) for key, names in CREDENTIAL_ENV.items()}
    mode = requested_url_mode()
    required = ("ak", "sk", "endpoint", "bucket")
    missing = [CREDENTIAL_ENV[key][0] for key in required if not config[key]]
    if mode == "cdn" and not config["cdn"]:
        missing.append("OSS_CDN_URL")
    config["tmp_dir"] = _from_env(("OSS_TMP_DIR",)) or DEFAULT_TMP_DIR
    config["url_mode"] = mode
    config["signed_url_expires"] = int(
        os.environ.get("OSS_SIGNED_URL_EXPIRES", str(DEFAULT_SIGNED_URL_EXPIRES))
    )
    return config, missing


def config_from_borrowed_repo() -> dict[str, str]:
    """只借凭证，不借上传函数。

    那边的 oss_utils.oss_up_bytes 要求先把整个文件读进内存，几百 MB 的
    原片这么搞不合适，所以凭证用它的，传输自己用 oss2 走流式。

    失败一律抛 RuntimeError 而不是 SystemExit：调用方要把"仓库没有"和
    "环境变量没设"合并成一句话报出去，直接 SystemExit 会只说前半边。
    """
    repo = Path(os.environ.get("OSS_UTILS_REPO", DEFAULT_REPO)).resolve()
    src = repo / "src"
    if not src.is_dir():
        raise RuntimeError(f"找不到 OSS 配置仓库 {src}")
    if str(src) not in sys.path:
        sys.path.insert(0, str(src))

    # 这个 import 会触发 load_nacos()，连不上 Nacos 就会在这里抛。
    from utils.oss_config import (  # noqa: E402  (路径得先设好才能 import)
        AI_CENTER_CDN_URL,
        BUKET_NAME,
        ENDPOINT,
        OSS_AK,
        OSS_SK,
        OSS_TMP_DIR,
    )

    config = {
        "ak": OSS_AK,
        "sk": OSS_SK,
        "endpoint": ENDPOINT,
        "bucket": BUKET_NAME,
        "cdn": AI_CENTER_CDN_URL,
        "tmp_dir": OSS_TMP_DIR or DEFAULT_TMP_DIR,
        "url_mode": requested_url_mode(),
        "signed_url_expires": int(
            os.environ.get("OSS_SIGNED_URL_EXPIRES", str(DEFAULT_SIGNED_URL_EXPIRES))
        ),
    }
    missing = [key for key in ("ak", "sk", "endpoint", "bucket") if not config[key]]
    if config["url_mode"] == "cdn" and not config["cdn"]:
        missing.append("cdn")
    if missing:
        raise RuntimeError(f"Nacos 里的 OSS 配置不全，缺：{', '.join(missing)}")
    return config


def load_oss_config() -> dict[str, str]:
    config, missing = config_from_env()
    if not missing:
        return config

    try:
        return config_from_borrowed_repo()
    except Exception as exc:
        # 兜底这条路断了，大概率就是在国内以外的机器上跑。直接把该设的变量名列出来，
        # 省得对着一句 Nacos 连接超时或者"仓库找不到"猜半天。
        raise SystemExit(
            f"读不到 OSS 配置。\n"
            f"  环境变量缺：{', '.join(missing)}\n"
            f"  退回 Nacos 也失败了：{type(exc).__name__}: {exc}\n"
            f"这台机器如果连不上内网 Nacos（跨境部署就是这种情况），"
            f"请直接设好这些环境变量："
            f"{', '.join(names[0] for names in CREDENTIAL_ENV.values())}"
        ) from exc


PUBLIC_ENDPOINT_MARK = "-internal.aliyuncs.com"

# 能直接裸写进 .env / systemd EnvironmentFile 的字符。AK/SK/域名都在这个集合里。
_PLAIN_VALUE = re.compile(r"^[A-Za-z0-9_@%+=:,./-]*$")


def to_public_endpoint(endpoint: str) -> tuple[str, bool]:
    """把 -internal 的内网接入点换成公网的，返回 (endpoint, 换过没有)。

    Nacos 里存的是 oss-cn-*-internal.aliyuncs.com，只在阿里云 VPC 内部可达。
    海外机器照抄过去的话每次上传都卡到超时，而且报错看不出是接入点的问题。
    """
    if PUBLIC_ENDPOINT_MARK in endpoint:
        return endpoint.replace(PUBLIC_ENDPOINT_MARK, ".aliyuncs.com"), True
    return endpoint, False


def with_scheme(endpoint: str) -> tuple[str, bool]:
    """补上 https://，返回 (endpoint, 补过没有)。

    Nacos 里存的是裸域名。oss2 看到没有协议头会自己补 http://，于是凭证和
    视频就明文上传了——不报错，也不会有任何提示，所以这里必须显式补成 https。
    """
    if "://" in endpoint:
        return endpoint, False
    return "https://" + endpoint, True


def env_line(key: str, value: str) -> str:
    if _PLAIN_VALUE.match(value):
        return f"{key}={value}"
    if "'" in value:
        # 单引号得转义，而 .env、systemd EnvironmentFile、with-env.mjs 三家的
        # 转义规则不一样，写出来多半有一家读错。与其猜，不如直说。
        raise SystemExit(f"{key} 的值里有单引号，没法安全导出，请手动设置这一项")
    return f"{key}='{value}'"


def object_name(prefix: str, source: Path) -> str:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    suffix = source.suffix.lower() or ".mp4"
    return f"{prefix.strip('/')}/seo_web_{stamp}{suffix}"


def log_safe_url(url: str) -> str:
    """Do not write OSS signature parameters into service logs."""
    parsed = urlsplit(url)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))


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

    if config["url_mode"] == "signed":
        # 源视频不需要长期公开；签名 URL 只给阿里云后端在任务期间下载。
        return bucket.sign_url("GET", key, config["signed_url_expires"])

    # CDN 模式和原来的行为一致：CDN 域名 + 对象名。
    return config["cdn"].rstrip("/") + "/" + key.lstrip("/")


def main() -> None:
    parser = argparse.ArgumentParser(description="上传文件到 OSS，输出公网 URL")
    parser.add_argument("--file", help="要上传的本地文件")
    parser.add_argument("--out", help="URL 写到这个文件里")
    parser.add_argument("--prefix", default=os.environ.get("OSS_PREFIX", ""), help="对象名前缀")
    parser.add_argument(
        "--check",
        action="store_true",
        help="只检查凭证读不读得到就退出，部署新机器时先跑这个",
    )
    parser.add_argument(
        "--export-env",
        action="store_true",
        help="把解析出来的凭证按 KEY=value 打到 stdout，用来灌给连不上 Nacos 的机器",
    )
    args = parser.parse_args()

    if args.export_env:
        config = load_oss_config()
        endpoint, swapped = to_public_endpoint(config["endpoint"])
        endpoint, schemed = with_scheme(endpoint)

        # 提示都走 stderr，stdout 保持干净，可以直接 >> .env 或者管道过去。
        if swapped:
            print(
                f"[oss_upload] endpoint 换成公网接入点：{config['endpoint']} → {endpoint}",
                file=sys.stderr,
            )
        if schemed:
            print(
                "[oss_upload] endpoint 补上 https://（裸域名会让 oss2 回落到 http，明文上传）",
                file=sys.stderr,
            )
        print(
            "[oss_upload] stdout 里是明文凭证。别贴进聊天 / issue / 日志，"
            "落盘后 chmod 600。",
            file=sys.stderr,
        )

        print(
            "\n".join(
                [
                    "# 由 scripts/oss_upload.py --export-env 生成",
                    env_line("OSS_AK", config["ak"]),
                    env_line("OSS_SK", config["sk"]),
                    env_line("OSS_ENDPOINT", endpoint),
                    env_line("OSS_BUCKET", config["bucket"]),
                    env_line("OSS_URL_MODE", config["url_mode"]),
                    env_line("OSS_SIGNED_URL_EXPIRES", str(config["signed_url_expires"])),
                    env_line("OSS_TMP_DIR", config["tmp_dir"]),
                ]
                + ([env_line("OSS_CDN_URL", config["cdn"])] if config["url_mode"] == "cdn" else [])
            )
        )
        return

    if args.check:
        config = load_oss_config()
        _, missing = config_from_env()
        source = "环境变量" if not missing else "Nacos（借 OSS_UTILS_REPO 那个仓库）"
        print(f"[oss_upload] 凭证来源：{source}", file=sys.stderr)
        print(f"[oss_upload] endpoint={config['endpoint']} bucket={config['bucket']}", file=sys.stderr)
        print(
            f"[oss_upload] url_mode={config['url_mode']} "
            f"cdn={config['cdn'] or '(not required)'} "
            f"prefix={args.prefix or config['tmp_dir']}",
            file=sys.stderr,
        )
        return

    if not args.file or not args.out:
        raise SystemExit("--file 和 --out 是必填的（只想检查配置就用 --check）")

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
    print(f"[oss_upload] {source.name} → {log_safe_url(url)}", file=sys.stderr)


if __name__ == "__main__":
    main()
