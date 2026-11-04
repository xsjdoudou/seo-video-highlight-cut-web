#!/usr/bin/env python3
"""把一段视频转成 /v1/seo 要的 asr.segments，走 jogg 那套 ASR。

jogg-video-highlight-cut 里的 "jogg" ASR 后端是腾讯 MPS SmartSubtitles
（底层 ElevenLabs scribe_v1），拿到的是词级时间戳。那边的代码已经把
「上传 OSS → 建任务 → 轮询 → 取 rawResponse」串好了，凭证也挂在 Nacos 上，
所以这里不重写，直接 import 过来用，只补两件事：

  1. 先用 ffmpeg 抽 16k 单声道 wav——MPS 要的是一个能下载的音频地址，
     而且几十 MB 的 wav 比几百 MB 的原片上传快得多；
  2. 把词级结果合成句子级 segments（见 group_words）。

用法：

    python3 scripts/jogg_asr.py --video <url 或本地路径> --out segments.json

结果写进 --out 而不是 stdout：Nacos / titan 的日志会往 stdout 和 stderr 上打，
混在一起没法解析。

环境变量：
  JOGG_REPO            jogg-video-highlight-cut 的路径
                       默认 /datadisk1/xieshiji/code/jogg-video-highlight-cut
  TENCENT_SECRET_ID    腾讯云凭证，MPS 必需（Nacos 里没有，得自己导）
  TENCENT_SECRET_KEY
  ASR_GAP_SECONDS      切句的停顿阈值，默认 0.6
  ASR_RETRY_ATTEMPTS   MPS 拉不动音频时重试几次，默认 3
  ASR_RETRY_SLEEP      两次重试之间等几秒，默认 5
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

DEFAULT_REPO = "/datadisk1/xieshiji/code/jogg-video-highlight-cut"

# 句末标点。中英文都列上，英文的句号后面通常还跟一个 spacing 词。
SENTENCE_END = set("。！？!?…")

# 停顿超过这个秒数就断句。0.6 是拿 tests/jogg_1 那条音频对出来的：
# 配合句末标点能逐字复现仓库里的 jogg_1.asr.json。
DEFAULT_GAP = float(os.environ.get("ASR_GAP_SECONDS", "0.6"))

# 腾讯 MPS 隔一阵就会拉不动我们传上去的那个 OSS 地址——任务回 ErrCode 60000
# （"Server returned 5XX"），MetaData.Size 是 0，说明它压根没下到音频。同一个文件
# 重试一次通常就过了，因为每次都会重新传一份、换一个新地址。实测三次里中过一次。
RETRY_ATTEMPTS = int(os.environ.get("ASR_RETRY_ATTEMPTS", "3"))
RETRY_SLEEP_SECONDS = float(os.environ.get("ASR_RETRY_SLEEP", "5"))


ERROR_MARKER = "[jogg_asr:error]"


def fail(message: str) -> SystemExit:
    """带标记退出。

    Nacos / titan 会往 stderr 上打一堆 INFO，Node 那边抓的是整个 stderr 的尾巴，
    不做标记的话这句人话会被日志淹掉。clip-api.mjs 按这个前缀把它捞出来。
    """
    return SystemExit(f"{ERROR_MARKER} {message}")


def setup_path(repo: Path) -> None:
    """jogg 仓库自己的 import 约定：仓库根 + vendor 的 src 都要在 sys.path 上。"""
    if not repo.is_dir():
        raise fail(f"找不到 jogg 仓库：{repo}（用 JOGG_REPO 指过去）")
    for entry in (repo, repo / "vendor" / "video_understanding" / "src"):
        path = str(entry)
        if path not in sys.path:
            sys.path.insert(0, path)


def extract_audio(source: str, target: Path) -> None:
    """抽音轨。source 可以是本地路径，也可以是 http(s) 地址，ffmpeg 都能读。"""
    command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        source,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-f",
        "wav",
        str(target),
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise fail(f"ffmpeg 抽音频失败：{result.stderr.strip()[-400:]}")
    if not target.is_file() or target.stat().st_size == 0:
        raise fail("ffmpeg 抽出来的音频是空的，这个视频可能没有音轨")


def group_words(words: list[dict], gap: float = DEFAULT_GAP) -> list[dict]:
    """词级 → 句级。遇到句末标点、超过 gap 的停顿、或者换人说话就断一句。

    ElevenLabs 的 words 里混着 type=spacing 的空白词，只留 type=word 的。
    """
    real = [
        w
        for w in words
        if isinstance(w, dict) and w.get("type") == "word" and str(w.get("text") or "").strip()
    ]
    segments: list[dict] = []
    current: list[dict] = []

    for index, word in enumerate(real):
        current.append(word)
        nxt = real[index + 1] if index + 1 < len(real) else None
        end_of_sentence = str(word.get("text") or "") in SENTENCE_END
        long_pause = nxt is not None and float(nxt.get("start", 0)) - float(word.get("end", 0)) >= gap
        speaker_change = nxt is not None and nxt.get("speaker_id") != word.get("speaker_id")

        if nxt is None or end_of_sentence or long_pause or speaker_change:
            start = round(float(current[0].get("start", 0)), 3)
            end = round(float(current[-1].get("end", 0)), 3)
            text = "".join(str(w.get("text") or "") for w in current).strip()
            # 下游会丢掉 end <= start 的片段，这里顺手把零时长的尾巴也扔掉。
            if text and end > start:
                segments.append(
                    {
                        "start": start,
                        "end": end,
                        "text": text,
                        "speaker_id": str(current[0].get("speaker_id") or "SPEAKER_00"),
                    }
                )
            current = []

    return segments


def transcribe(audio: Path, language: str) -> dict:
    from pipeline.clients.tencent_mps_asr import transcribe_audio

    result = transcribe_audio(
        audio,
        source_language=language or "auto",
        shot_id="seo-web",
    )
    stt = (result.get("result") or {}).get("stt") or {}
    return {
        "provider": result.get("provider", "tencent_mps_smart_subtitles"),
        "task_id": result.get("task_id", ""),
        "text": str(result.get("text") or stt.get("text") or ""),
        "language": str(stt.get("language_code") or ""),
        "duration": float(stt.get("audio_duration_secs") or 0),
        "words": stt.get("words") or [],
    }


def is_no_speech(message: str) -> bool:
    """MPS 的任务成功了却没给出 rawResponse，就是这段音频里没人说话。"""
    return "rawResponse" in message


def is_transient(message: str) -> bool:
    """只认下载不到音频这一类：任务本身失败（ErrCode 60000 / 5XX）才值得重试。

    放得很窄是故意的——每次重试都要再等两三分钟、再花一次 MPS 的量，
    确定性的失败（没人声、参数不对）重试多少次都是一样的结果。
    """
    if is_no_speech(message):
        return False
    return "'ErrCode': 60000" in message or "5XX" in message


def describe_failure(message: str) -> str:
    """把腾讯 MPS 那几千字的响应压成一句人话。

    原样抛出去的话，前端弹窗里是一坨被截断的 Python dict，既看不出哪一步断了，
    也不知道该怎么办——这个坑我们自己就踩过一次。
    """
    if is_no_speech(message):
        return "这段视频里没识别到人声，换一段有人说话的素材再试。"
    code = re.search(r"'ErrCode': (\d+)", message)
    detail = re.search(r"'Message': '([^']*)'", message)
    if code and code.group(1) == "60000":
        return (
            f"腾讯 MPS 拉不动我们传上去的音频（ErrCode 60000"
            f"{'：' + detail.group(1) if detail else ''}），重试 {RETRY_ATTEMPTS} 次都没成功，等会儿再试。"
        )
    if code:
        return f"腾讯 MPS ASR 失败：ErrCode {code.group(1)}{'，' + detail.group(1) if detail else ''}"
    # 不认识的形态就别硬压了，留个头部还能看出是哪一步。
    return f"腾讯 MPS ASR 失败：{message[:300]}"


def transcribe_with_retry(audio: Path, language: str) -> dict:
    last = ""
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            return transcribe(audio, language)
        except SystemExit:
            raise
        except Exception as exc:  # 调用链很深，堆栈对前端没用，给一句人话
            last = str(exc)
            if not is_transient(last) or attempt == RETRY_ATTEMPTS:
                raise fail(describe_failure(last)) from exc
            print(
                f"[jogg_asr] 第 {attempt}/{RETRY_ATTEMPTS} 次识别失败（MPS 没下到音频），"
                f"{RETRY_SLEEP_SECONDS:g}s 后换个地址重试",
                file=sys.stderr,
            )
            time.sleep(RETRY_SLEEP_SECONDS)
    raise fail(describe_failure(last))


def main() -> None:
    parser = argparse.ArgumentParser(description="jogg ASR → asr.segments")
    parser.add_argument("--video", required=True, help="视频地址或本地路径")
    parser.add_argument("--out", required=True, help="结果 JSON 写到这里")
    parser.add_argument("--language", default="auto", help="源语言，默认 auto")
    parser.add_argument("--gap", type=float, default=DEFAULT_GAP, help="断句停顿阈值（秒）")
    args = parser.parse_args()

    setup_path(Path(os.environ.get("JOGG_REPO", DEFAULT_REPO)).resolve())

    # 先查凭证再干活：不然白抽一遍音轨、白传一次 OSS 才发现没法调。
    if not os.environ.get("TENCENT_SECRET_ID") or not os.environ.get("TENCENT_SECRET_KEY"):
        raise fail("缺 TENCENT_SECRET_ID / TENCENT_SECRET_KEY，jogg ASR 用的腾讯 MPS 需要这两个环境变量")

    with tempfile.TemporaryDirectory(prefix="jogg-asr-") as work:
        audio = Path(work) / "audio.wav"
        extract_audio(args.video, audio)
        result = transcribe_with_retry(audio, args.language)

    segments = group_words(result.pop("words"), gap=args.gap)
    if not segments:
        raise fail("这段视频里没识别到人声，换一段有人说话的素材再试。")

    result["segments"] = segments
    Path(args.out).write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    # 这行走 stderr，省得和 --out 的内容混起来；Node 那边只在出错时看它。
    print(f"[jogg_asr] {len(segments)} 个片段 → {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
