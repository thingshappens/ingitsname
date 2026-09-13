"""Private HSC RunPod queue worker.

The public contract deliberately has only two actions.  The Vercel service
submits authenticated RunPod jobs; no Voicebox port is exposed publicly.
"""

from __future__ import annotations

import base64
import hmac
import io
import math
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import httpx
import numpy as np
import pyworld as pw
import runpod
import soundfile as sf


VOICEBOX_URL = "http://127.0.0.1:17493"
MAX_AUDIO_BYTES = 16 * 1024 * 1024
VOICEBOX_PROCESS: subprocess.Popen[bytes] | None = None


def configured_profiles() -> set[str]:
    return {value.strip() for value in os.environ.get("HSC_ALLOWED_PROFILE_IDS", "").split(",") if value.strip()}


def max_text_length() -> int:
    return int(os.environ.get("HSC_MAX_TEXT_LENGTH", "220"))


def fail(message: str) -> dict[str, str]:
    return {"error": message}


def ensure_voicebox() -> None:
    global VOICEBOX_PROCESS
    if VOICEBOX_PROCESS and VOICEBOX_PROCESS.poll() is None:
        return
    data_dir = Path(os.environ["VOICEBOX_DATA_DIR"])
    data_dir.mkdir(parents=True, exist_ok=True)
    VOICEBOX_PROCESS = subprocess.Popen(
        [sys.executable, "-m", "backend.main", "--host", "127.0.0.1", "--port", "17493", "--data-dir", str(data_dir)],
        cwd="/opt/voicebox",
    )
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        try:
            if httpx.get(f"{VOICEBOX_URL}/health", timeout=3).is_success:
                return
        except httpx.HTTPError:
            pass
        time.sleep(1)
    raise RuntimeError("Voicebox did not become ready")


def generate(payload: dict[str, Any]) -> dict[str, Any]:
    profile_id = payload.get("profile_id")
    text = payload.get("text")
    if profile_id not in configured_profiles() or not isinstance(text, str):
        return fail("Generation request is invalid")
    text = text.strip()
    if not text or len(text) > max_text_length() or any(ord(char) < 32 and char not in "\n\t" for char in text):
        return fail("Generation request is invalid")

    ensure_voicebox()
    request = {
        "profile_id": profile_id,
        "text": text,
        "language": "en",
        "engine": "qwen",
        "model_size": "1.7B",
        "normalize": True,
        "personality": False,
        "effects_chain": [],
    }
    with httpx.Client(timeout=30) as client:
        queued = client.post(f"{VOICEBOX_URL}/generate", json=request).json()
        generation_id = queued.get("id")
        if not isinstance(generation_id, str):
            return fail("Voice rendering failed")
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            record = client.get(f"{VOICEBOX_URL}/history/{generation_id}").json()
            if record.get("status") == "completed":
                audio = client.get(f"{VOICEBOX_URL}/audio/{generation_id}").content
                if not 44 <= len(audio) <= MAX_AUDIO_BYTES:
                    return fail("Generated audio is invalid")
                return {
                    "generation": {
                        "id": generation_id,
                        "profile_id": profile_id,
                        "engine": record.get("engine", "qwen"),
                        "model_size": record.get("model_size", "1.7B"),
                        "sample_rate": record.get("sample_rate"),
                    },
                    "audio_base64": base64.b64encode(audio).decode("ascii"),
                }
            if record.get("status") == "failed":
                return fail("Voice rendering failed")
            time.sleep(0.5)
    return fail("Voice rendering timed out")


def import_profile(payload: dict[str, Any]) -> dict[str, Any]:
    """One-time bootstrap from a ZIP already stored on the private volume."""
    expected_token = os.environ.get("HSC_BOOTSTRAP_TOKEN")
    supplied_token = payload.get("bootstrap_token")
    if not expected_token or not isinstance(supplied_token, str) or not hmac.compare_digest(supplied_token, expected_token):
        return fail("Bootstrap is unauthorized")
    archive = Path(os.environ["HSC_PROFILE_ARCHIVE"])
    if not archive.is_file() or archive.stat().st_size > 100 * 1024 * 1024:
        return fail("Felix profile archive is unavailable")
    ensure_voicebox()
    with archive.open("rb") as source, httpx.Client(timeout=60) as client:
        response = client.post(
            f"{VOICEBOX_URL}/profiles/import",
            files={"file": (archive.name, source, "application/zip")},
        )
    if not response.is_success:
        return fail("Felix profile import failed")
    profile = response.json()
    profile_id = profile.get("id")
    if not isinstance(profile_id, str):
        return fail("Felix profile import failed")
    return {"profile_id": profile_id, "name": profile.get("name")}


def sexy_synthetic(payload: dict[str, Any]) -> dict[str, str]:
    encoded = payload.get("audio_base64")
    if not isinstance(encoded, str):
        return fail("Voice transformation source is invalid")
    try:
        source = base64.b64decode(encoded, validate=True)
    except ValueError:
        return fail("Voice transformation source is invalid")
    if not 44 <= len(source) <= MAX_AUDIO_BYTES:
        return fail("Voice transformation source is invalid")
    try:
        audio, sample_rate = sf.read(io.BytesIO(source), dtype="float64", always_2d=True)
        if sample_rate != 48000 or audio.shape[0] > sample_rate * 25:
            return fail("Voice transformation source is invalid")
        mono = np.mean(audio, axis=1)
        f0, times = pw.dio(mono, sample_rate, f0_floor=45.0, f0_ceil=300.0, frame_period=5.0)
        f0 = pw.stonemask(mono, f0, times, sample_rate)
        spectral = pw.cheaptrick(mono, f0, times, sample_rate)
        aperiodicity = pw.d4c(mono, f0, times, sample_rate)
        shifted = pw.synthesize(f0 * math.pow(2.0, -10.0 / 12.0), spectral, aperiodicity, sample_rate, frame_period=5.0)
        output = io.BytesIO()
        sf.write(output, np.clip(shifted, -1.0, 1.0), sample_rate, format="WAV", subtype="FLOAT")
        return {"audio_base64": base64.b64encode(output.getvalue()).decode("ascii")}
    except (RuntimeError, ValueError, sf.LibsndfileError):
        return fail("Voice transformation failed")


def handler(event: dict[str, Any]) -> dict[str, Any]:
    payload = event.get("input")
    if not isinstance(payload, dict):
        return fail("Input is invalid")
    action = payload.get("action")
    if action == "generate":
        return generate(payload)
    if action == "import_profile":
        return import_profile(payload)
    if action == "sexy_synthetic":
        return sexy_synthetic(payload)
    return fail("Action is invalid")


runpod.serverless.start({"handler": handler})
