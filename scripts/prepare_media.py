#!/usr/bin/env python3
"""Prepare web-ready media for the landing page demo.

Walks every source listed in SOURCES, reads its highlight-pipeline output
(top10.json + concat_hightlights/*.mp4), picks the top-N clips by score and
writes one self-contained media folder per source:

  public/media/<key>/source-preview.mp4    muted loop of the original long video
  public/media/<key>/source-poster.jpg
  public/media/<key>/clips/<id>.mp4        full clip, re-encoded for the web
  public/media/<key>/clips/<id>-preview.mp4  short muted loop for the card
  public/media/<key>/clips/<id>.jpg        poster
  src/data/clips.generated.json            metadata for every source

The frontend picks one source at random per page load, so each source needs a
complete set of assets. Pass --only to rebuild a single source while iterating.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PIPELINE = Path("/datadisk1/xieshiji/code/A-jogg-video-understanding/jogg-video-understanding")
VIDEOS = PIPELINE / "dataset/podcast_youtube_testset/videos"

# (key, source video stem, spoken language). The run is resolved automatically:
# newest timestamped run that actually produced highlight clips.
SOURCES: list[tuple[str, str, str]] = [
    ("yt_test_2", "yt_test_2", "en"),
    ("bili_test_4", "bili_test_4", "zh"),
    ("bili_test_3", "bili_test_3", "zh"),
    ("bili_test_2", "bili_test_2", "zh"),
    ("fenglun", "fenglun", "zh"),
    ("shangban", "shangban", "zh"),
    ("jogg_1", "jogg_1", "zh"),
    ("tk_test_12", "tk_test_12", "zh"),
]


def latest_run(stem: str) -> Path:
    """Newest run for `stem` that has both top10.json and concat clips.

    The newest run is not always usable -- a run can finish with
    highlight_status=dropped and emit no clips at all, so fall back to the
    newest one that did produce them.
    """
    runs = sorted((PIPELINE / "runs" / stem).iterdir(), reverse=True)
    for d in runs:
        hl = d / "06_highlights"
        if (hl / "top10.json").exists() and any((hl / "concat_hightlights").glob("*.mp4")):
            return hl
    raise SystemExit(f"no run with highlight clips for {stem}")


def run(cmd: list[str]) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", *cmd], check=True)


def probe_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(out.stdout.strip())


def prepare_source(source: Path, out_dir: Path, start: float, length: float) -> float:
    run([
        "-ss", str(start), "-t", str(length), "-i", str(source),
        "-an", "-vf", "scale=854:-2", "-c:v", "libx264", "-preset", "medium", "-crf", "27",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out_dir / "source-preview.mp4"),
    ])
    run(["-ss", str(start), "-i", str(source), "-frames:v", "1", "-vf", "scale=854:-2",
         "-q:v", "3", str(out_dir / "source-poster.jpg")])
    return probe_duration(source)


def prepare_clip(src: Path, clip_id: str, out_dir: Path, preview_start: float, preview_len: float) -> None:
    # Full clip: re-encoded rather than remuxed, since 48 clips at source bitrate
    # would put ~700MB into public/ (and another copy into dist/ on build).
    run([
        "-i", str(src), "-vf", "scale=540:-2", "-c:v", "libx264", "-preset", "fast", "-crf", "29",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart",
        str(out_dir / f"{clip_id}.mp4"),
    ])
    run([
        "-ss", str(preview_start), "-t", str(preview_len), "-i", str(src),
        "-an", "-vf", "scale=360:-2", "-c:v", "libx264", "-preset", "medium", "-crf", "28",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out_dir / f"{clip_id}-preview.mp4"),
    ])
    run(["-ss", str(preview_start), "-i", str(src), "-frames:v", "1", "-vf", "scale=360:-2",
         "-q:v", "3", str(out_dir / f"{clip_id}.jpg")])


def build_source(key: str, stem: str, lang: str, args: argparse.Namespace) -> dict:
    source_video = VIDEOS / f"{stem}.mp4"
    if not source_video.exists():
        raise SystemExit(f"missing source video: {source_video}")
    hl_dir = latest_run(stem)
    print(f"[{key}] run <- {hl_dir.parent.name}")

    media_dir = ROOT / "public" / "media" / key
    clips_dir = media_dir / "clips"
    clips_dir.mkdir(parents=True, exist_ok=True)

    top = json.loads((hl_dir / "top10.json").read_text())
    candidates = [s for s in top["selected"] if s.get("highlight_clip")]
    candidates.sort(key=lambda s: s["final_score"], reverse=True)
    picked = candidates[: args.top]
    if not picked:
        raise SystemExit(f"no highlight clips for {key}")

    # Preview the stretch of the original that produced the best clip, so the
    # long-video player shows something worth clipping rather than a cold open.
    src_start = max(0.0, picked[0]["start"] + 2.0)
    print(f"[{key}] source <- {source_video.name} @ {src_start:.0f}s")
    source_duration = prepare_source(source_video, media_dir, src_start, args.source_length)

    clips = []
    for item in picked:
        src = hl_dir / "concat_hightlights" / Path(item["highlight_clip"]).name
        clip_id = src.stem.split("_")[0]  # h01_shot_0011 -> h01
        print(f"[{key}] clip {clip_id} ({item['final_score']:.1f}) <- {src.name}")
        prepare_clip(src, clip_id, clips_dir, args.preview_start, args.preview_length)
        clips.append({
            "id": clip_id,
            "score": round(item["final_score"]),
            "scores": item["scores"],
            # Older runs predate type_en; fall back so every card has a label.
            "type": item.get("type_en") or "Highlight",
            "sourceStart": item["start"],
            "sourceEnd": item["end"],
            "duration": round(probe_duration(src), 2),
            "video": f"/media/{key}/clips/{clip_id}.mp4",
            "preview": f"/media/{key}/clips/{clip_id}-preview.mp4",
            "poster": f"/media/{key}/clips/{clip_id}.jpg",
        })

    return {
        "key": key,
        "lang": lang,
        "duration": round(source_duration, 2),
        "preview": f"/media/{key}/source-preview.mp4",
        "poster": f"/media/{key}/source-poster.jpg",
        "clips": clips,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--top", type=int, default=6, help="clips per source")
    parser.add_argument("--only", action="append", help="rebuild just these source keys")
    parser.add_argument("--source-length", type=float, default=11.0, help="long-video preview length (s)")
    parser.add_argument("--preview-start", type=float, default=2.0)
    parser.add_argument("--preview-length", type=float, default=8.0)
    args = parser.parse_args()

    selected = [s for s in SOURCES if not args.only or s[0] in args.only]
    if not selected:
        raise SystemExit(f"--only matched nothing; known keys: {[s[0] for s in SOURCES]}")

    out = ROOT / "src" / "data" / "clips.generated.json"
    # Rebuilding a subset must not drop the sources we are not touching.
    existing = {}
    if args.only and out.exists():
        existing = {s["key"]: s for s in json.loads(out.read_text()).get("sources", [])}

    for key, stem, lang in selected:
        existing[key] = build_source(key, stem, lang, args)

    ordered = [existing[s[0]] for s in SOURCES if s[0] in existing]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"sources": ordered}, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {out.relative_to(ROOT)} ({len(ordered)} sources)")


if __name__ == "__main__":
    main()
