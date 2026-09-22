#!/usr/bin/env python3
"""
Benchmark expansion pipeline — download YouTube exercise videos,
extract MediaPipe pose landmarks at 10fps, and merge into the
landmark cache for offline replay benchmarking.

Usage:
  # Add a single video with known rep count:
  python3 benchmark/expand-benchmark.py add <youtube_url> <exercise> <reps> [--start S] [--end E]

  # Search YouTube for exercise videos and show candidates:
  python3 benchmark/expand-benchmark.py search <exercise> [--count N]

  # Extract landmarks from a local video file:
  python3 benchmark/expand-benchmark.py extract <video_path> <exercise> <reps>

  # Merge new entries into the main benchmark cache:
  python3 benchmark/expand-benchmark.py merge

Examples:
  python3 benchmark/expand-benchmark.py search lateral_raise --count 5
  python3 benchmark/expand-benchmark.py add "https://youtube.com/watch?v=XYZ" lateral_raise 10 --start 5 --end 35
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

# MediaPipe imports (deferred to allow --help without install)
PoseLandmarker = None
PoseLandmarkerOptions = None
BaseOptions = None
mp_Image = None

BENCHMARK_DIR = Path(__file__).parent
CACHE_DIR = BENCHMARK_DIR / 'landmark-cache'
STAGING_DIR = BENCHMARK_DIR / 'staging'
MANIFEST_PATH = BENCHMARK_DIR / 'manifest.json'
TARGET_FPS = 10


def init_mediapipe():
    global PoseLandmarker, PoseLandmarkerOptions, BaseOptions, mp_Image
    from mediapipe.tasks.python.vision import PoseLandmarker as _PL, PoseLandmarkerOptions as _PLO
    from mediapipe.tasks.python import BaseOptions as _BO
    import mediapipe as _mp
    PoseLandmarker = _PL
    PoseLandmarkerOptions = _PLO
    BaseOptions = _BO
    mp_Image = _mp.Image


def get_latest_cache():
    """Find the latest landmark cache file."""
    if not CACHE_DIR.exists():
        return None
    json_files = sorted(CACHE_DIR.glob('*.json'), reverse=True)
    json_files = [f for f in json_files if not str(f).endswith('.gz')]
    return json_files[0] if json_files else None


def download_video(url, output_path, start=None, end=None):
    """Download a YouTube video clip using yt-dlp."""
    cmd = [
        'yt-dlp',
        '-f', 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best',
        '--merge-output-format', 'mp4',
        '-o', str(output_path),
        '--no-playlist',
    ]

    # Use yt-dlp's download sections for time trimming
    if start is not None or end is not None:
        section = '*'
        if start is not None:
            section += f'{start}'
        section += '-'
        if end is not None:
            section += f'{end}'
        cmd.extend(['--download-sections', section])
        cmd.extend(['--force-keyframes-at-cuts'])

    cmd.append(url)

    print(f'  Downloading: {url}')
    if start is not None or end is not None:
        print(f'  Time range: {start or 0}s - {end or "end"}s')

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f'  ERROR: yt-dlp failed:\n{result.stderr[-500:]}')
        return False
    return True


def extract_video_id(url):
    """Extract YouTube video ID from URL."""
    import re
    patterns = [
        r'(?:v=|/)([0-9A-Za-z_-]{11})(?:[&?/]|$)',
        r'(?:youtu\.be/)([0-9A-Za-z_-]{11})',
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None


def extract_landmarks(video_path, target_fps=TARGET_FPS):
    """Extract MediaPipe pose landmarks from video at target FPS."""
    import cv2
    import numpy as np

    init_mediapipe()

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f'  ERROR: Cannot open video: {video_path}')
        return None

    src_fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / src_fps if src_fps > 0 else 0
    frame_interval = max(1, round(src_fps / target_fps))

    print(f'  Video: {src_fps:.1f} fps, {total_frames} frames, {duration:.1f}s')
    print(f'  Sampling every {frame_interval} frames -> ~{target_fps} fps output')

    # Use MediaPipe Tasks API (v1.0+)
    # Use lite model (heavy crashes on macOS Metal GPU)
    model_path = os.path.expanduser('~/.mediapipe/pose_landmarker_lite.task')
    if not os.path.exists(model_path):
        print(f'  ERROR: Model not found at {model_path}')
        print(f'  Download: curl -L -o ~/.mediapipe/pose_landmarker_lite.task "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"')
        return None

    options = PoseLandmarkerOptions(
        base_options=BaseOptions(
            model_asset_path=model_path,
            delegate=BaseOptions.Delegate.CPU,
        ),
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    landmarks_list = []
    frame_idx = 0

    with PoseLandmarker.create_from_options(options) as landmarker:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % frame_interval == 0:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp_Image(
                    image_format=__import__('mediapipe').ImageFormat.SRGB,
                    data=np.ascontiguousarray(rgb),
                )
                results = landmarker.detect(mp_image)

                if results.pose_landmarks and len(results.pose_landmarks) > 0:
                    frame_lms = []
                    for lm in results.pose_landmarks[0]:
                        frame_lms.append({
                            'x': lm.x,
                            'y': lm.y,
                            'z': lm.z,
                            'visibility': lm.visibility,
                        })
                    landmarks_list.append(frame_lms)
                else:
                    landmarks_list.append(None)

            frame_idx += 1

    cap.release()
    print(f'  Extracted {len(landmarks_list)} landmark frames ({len([l for l in landmarks_list if l])} with pose)')
    return landmarks_list


def search_videos(exercise, count=5):
    """Search YouTube for exercise videos using yt-dlp."""
    query = f'{exercise.replace("_", " ")} exercise reps'
    cmd = [
        'yt-dlp',
        f'ytsearch{count}:{query}',
        '--print', '%(id)s|%(title)s|%(duration)s|%(view_count)s',
        '--no-download',
    ]

    print(f'  Searching YouTube for: "{query}"')
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        print(f'  Search failed: {result.stderr[-200:]}')
        return []

    videos = []
    for line in result.stdout.strip().split('\n'):
        if not line or '|' not in line:
            continue
        parts = line.split('|')
        if len(parts) >= 4:
            vid_id, title, duration, views = parts[0], parts[1], parts[2], parts[3]
            try:
                dur = int(duration) if duration != 'NA' else 0
                v = int(views) if views != 'NA' else 0
            except ValueError:
                dur, v = 0, 0
            videos.append({
                'id': vid_id,
                'title': title,
                'duration': dur,
                'views': v,
                'url': f'https://www.youtube.com/watch?v={vid_id}',
            })

    return videos


def add_video(url, exercise, reps, start=None, end=None):
    """Download video, extract landmarks, save to staging."""
    STAGING_DIR.mkdir(parents=True, exist_ok=True)

    video_id = extract_video_id(url)
    if not video_id:
        print(f'  ERROR: Cannot extract video ID from {url}')
        return False

    filename = f'{exercise}_{video_id}_{reps}reps'
    video_path = STAGING_DIR / f'{filename}.mp4'
    cache_path = STAGING_DIR / f'{filename}.json'

    if cache_path.exists():
        print(f'  Already staged: {cache_path.name}')
        return True

    # Download
    if not video_path.exists():
        if not download_video(url, video_path, start, end):
            return False

    # Extract landmarks
    landmarks = extract_landmarks(video_path, TARGET_FPS)
    if not landmarks:
        return False

    # Filter out None frames for count check
    valid = [l for l in landmarks if l is not None]
    min_frames = reps * 3  # At least 3 frames per rep
    if len(valid) < min_frames:
        print(f'  WARNING: Only {len(valid)} valid frames for {reps} reps (need >= {min_frames})')

    # Save cache entry
    entry = {
        'video': f'{filename}.mp4',
        'exercise': exercise,
        'expected': reps,
        'fps': TARGET_FPS,
        'landmarks': landmarks,
    }

    with open(cache_path, 'w') as f:
        json.dump(entry, f)

    # Also save manifest entry
    manifest_entry = {
        'file': f'{filename}.mp4',
        'exercise': exercise,
        'reps': reps,
        'source': 'youtube',
        'video_id': video_id,
    }
    if start is not None:
        manifest_entry['rep_start_offset'] = start
    if end is not None:
        manifest_entry['rep_end_offset'] = end

    manifest_path = STAGING_DIR / f'{filename}_manifest.json'
    with open(manifest_path, 'w') as f:
        json.dump(manifest_entry, f, indent=2)

    print(f'  Saved: {cache_path.name} ({len(landmarks)} frames)')
    return True


def merge_staging():
    """Merge staged landmark entries into the main cache."""
    if not STAGING_DIR.exists():
        print('  No staging directory found.')
        return

    staged_files = sorted(STAGING_DIR.glob('*.json'))
    staged_caches = [f for f in staged_files if '_manifest' not in f.name]

    if not staged_caches:
        print('  No staged entries to merge.')
        return

    # Load existing cache
    cache_path = get_latest_cache()
    existing = []
    if cache_path:
        with open(cache_path) as f:
            existing = json.load(f)
        print(f'  Loaded existing cache: {len(existing)} videos')

    existing_videos = {e['video'] for e in existing}

    # Merge new entries
    added = 0
    for sc in staged_caches:
        with open(sc) as f:
            entry = json.load(f)
        if entry['video'] not in existing_videos:
            existing.append(entry)
            existing_videos.add(entry['video'])
            added += 1
            print(f'  + {entry["video"]} ({entry["exercise"]}, {entry["expected"]} reps)')

    if added == 0:
        print('  No new entries to add.')
        return

    # Save merged cache with new timestamp
    from datetime import datetime
    ts = datetime.now().strftime('%Y-%m-%dT%H%M')
    new_cache_path = CACHE_DIR / f'landmark-cache-{ts}.json'
    with open(new_cache_path, 'w') as f:
        json.dump(existing, f)

    print(f'\n  Merged cache saved: {new_cache_path.name}')
    print(f'  Total videos: {len(existing)} ({added} new)')

    # Update manifest
    if MANIFEST_PATH.exists():
        with open(MANIFEST_PATH) as f:
            manifest = json.load(f)

        for sc in staged_caches:
            mf = sc.parent / f'{sc.stem}_manifest.json'
            if mf.exists():
                with open(mf) as f:
                    me = json.load(f)
                # Add exercise to list if new
                if me['exercise'] not in manifest['exercises']:
                    manifest['exercises'].append(me['exercise'])
                # Add video entry if not present
                if not any(v['file'] == me['file'] for v in manifest['videos']):
                    manifest['videos'].append(me)

        manifest['total'] = len(existing)
        with open(MANIFEST_PATH, 'w') as f:
            json.dump(manifest, f, indent=2)
        print(f'  Updated manifest.json')


def main():
    parser = argparse.ArgumentParser(description='Expand WorkoutVision benchmark with YouTube videos')
    sub = parser.add_subparsers(dest='command')

    # search
    sp_search = sub.add_parser('search', help='Search YouTube for exercise videos')
    sp_search.add_argument('exercise', help='Exercise name (e.g., lateral_raise)')
    sp_search.add_argument('--count', type=int, default=5, help='Number of results')

    # add
    sp_add = sub.add_parser('add', help='Add a video to the benchmark')
    sp_add.add_argument('url', help='YouTube URL')
    sp_add.add_argument('exercise', help='Exercise name')
    sp_add.add_argument('reps', type=int, help='Expected rep count')
    sp_add.add_argument('--start', type=float, default=None, help='Start time in seconds')
    sp_add.add_argument('--end', type=float, default=None, help='End time in seconds')

    # extract
    sp_extract = sub.add_parser('extract', help='Extract landmarks from a local video')
    sp_extract.add_argument('video_path', help='Path to video file')
    sp_extract.add_argument('exercise', help='Exercise name')
    sp_extract.add_argument('reps', type=int, help='Expected rep count')

    # merge
    sub.add_parser('merge', help='Merge staged entries into main cache')

    args = parser.parse_args()

    if args.command == 'search':
        videos = search_videos(args.exercise, args.count)
        if videos:
            print(f'\n  Found {len(videos)} videos:\n')
            for v in videos:
                dur_str = f'{v["duration"]//60}:{v["duration"]%60:02d}' if v['duration'] else '?'
                views_str = f'{v["views"]:,}' if v['views'] else '?'
                print(f'  [{v["id"]}] {v["title"][:70]}')
                print(f'    Duration: {dur_str} | Views: {views_str}')
                print(f'    URL: {v["url"]}')
                print()

    elif args.command == 'add':
        add_video(args.url, args.exercise, args.reps, args.start, args.end)

    elif args.command == 'extract':
        STAGING_DIR.mkdir(parents=True, exist_ok=True)
        video_path = Path(args.video_path)
        filename = f'{args.exercise}_{video_path.stem}_{args.reps}reps'
        landmarks = extract_landmarks(video_path, TARGET_FPS)
        if landmarks:
            entry = {
                'video': f'{filename}.mp4',
                'exercise': args.exercise,
                'expected': args.reps,
                'fps': TARGET_FPS,
                'landmarks': landmarks,
            }
            cache_path = STAGING_DIR / f'{filename}.json'
            with open(cache_path, 'w') as f:
                json.dump(entry, f)
            print(f'  Saved: {cache_path.name}')

    elif args.command == 'merge':
        merge_staging()

    else:
        parser.print_help()


if __name__ == '__main__':
    main()
