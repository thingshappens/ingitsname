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
VOICEBOX_LOG = "/tmp/voicebox.log"
MAX_AUDIO_BYTES = 16 * 1024 * 1024
STORE_CHUNK = 192 * 1024  # must match CHUNK in lib/edit/store.js
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
    # Voicebox's own output goes to a log file so a failed start can say why.
    log = open(VOICEBOX_LOG, "ab")
    VOICEBOX_PROCESS = subprocess.Popen(
        [sys.executable, "-m", "backend.main", "--host", "127.0.0.1", "--port", "17493", "--data-dir", str(data_dir)],
        cwd="/opt/voicebox",
        stdout=log,
        stderr=subprocess.STDOUT,
    )
    # Cold starts load the model from the network volume; allow up to 5 minutes.
    deadline = time.monotonic() + int(os.environ.get("HSC_VOICEBOX_START_TIMEOUT", "300"))
    while time.monotonic() < deadline:
        if VOICEBOX_PROCESS.poll() is not None:
            break
        try:
            if httpx.get(f"{VOICEBOX_URL}/health", timeout=3).is_success:
                return
        except httpx.HTTPError:
            pass
        time.sleep(1)
    raise RuntimeError(f"Voicebox did not become ready: {voicebox_log_tail()}")


def voicebox_log_tail(limit: int = 1500) -> str:
    try:
        data = Path(VOICEBOX_LOG).read_bytes()[-limit:]
        return data.decode("utf-8", "replace")
    except OSError:
        return "(no Voicebox log)"


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
                return fail(f"Voice rendering failed: {str(record.get('error') or '')[:300]}")
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


def render(payload: dict[str, Any]) -> dict[str, Any]:
    """Runs the exact production render.js (ffmpeg DSP chain) unchanged.

    Cloudflare Workers cannot execute ffmpeg, so the Worker's render() call
    is forwarded here (THE_EDIT_REMOTE_RENDER=1) and shells out to Node,
    which runs the same code path Vercel used to run in-process.
    """
    pcm_b64 = payload.get("pcm_base64")
    cut = payload.get("cut")
    order = payload.get("order")
    if not isinstance(pcm_b64, str) or not isinstance(cut, dict) or not isinstance(order, dict):
        return fail("Render request is invalid")
    if len(pcm_b64) > 24 * 1024 * 1024:
        return fail("Render request is invalid")
    import json as _json
    try:
        proc = subprocess.run(
            ["node", "/app/edit-render/cli.js"],
            input=_json.dumps({"pcmBase64": pcm_b64, "cut": cut, "order": order}).encode("utf-8"),
            capture_output=True,
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        return fail("Render timed out")
    if proc.returncode != 0:
        return fail(f"Render failed: {proc.stderr.decode('utf-8', 'replace')[:500]}")
    try:
        result = _json.loads(proc.stdout.decode("utf-8"))
    except ValueError:
        return fail("Render returned invalid output")
    if not isinstance(result.get("audioBase64"), str) or not isinstance(result.get("metrics"), dict):
        return fail("Render returned invalid output")
    return {"audio_base64": result["audioBase64"], "metrics": result["metrics"]}


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


def list_profiles(_payload: dict[str, Any]) -> dict[str, Any]:
    """Names and IDs of the Voicebox profiles on the volume (no audio, no references)."""
    ensure_voicebox()
    with httpx.Client(timeout=30) as client:
        profiles = client.get(f"{VOICEBOX_URL}/profiles").json()
    items = profiles if isinstance(profiles, list) else profiles.get("profiles", []) if isinstance(profiles, dict) else []
    allowed = configured_profiles()
    return {"profiles": [{"id": p.get("id"), "name": p.get("name"), "allowed": p.get("id") in allowed} for p in items if isinstance(p, dict)]}


def upstash_put(store: dict[str, Any], prefix: str, audio: bytes) -> dict[str, Any]:
    """Stores audio in the site's Redis in the exact chunk format lib/edit/store.js reads."""
    url, token, ttl = store["url"].rstrip("/"), store["token"], int(store["ttl"])
    count = 0
    with httpx.Client(timeout=30, headers={"authorization": f"Bearer {token}"}) as client:
        for start in range(0, len(audio), STORE_CHUNK):
            chunk = base64.b64encode(audio[start:start + STORE_CHUNK]).decode("ascii")
            response = client.post(url, json=["SET", f"{prefix}:{count}", chunk, "EX", str(ttl)])
            if not response.is_success or response.json().get("result") != "OK":
                raise RuntimeError("Audio storage failed")
            count += 1
    return {"prefix": prefix, "count": count, "bytes": len(audio)}


def to_pcm48(wav: bytes) -> bytes:
    """Same conversion lib/edit/render.js generate() did with ffmpeg: 48 kHz mono s16le."""
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-ar", "48000", "-ac", "1", "-f", "s16le", "pipe:1"],
        input=wav, capture_output=True, timeout=60,
    )
    if proc.returncode != 0 or len(proc.stdout) < 4800:
        raise RuntimeError("Source conversion failed")
    return proc.stdout


def fulfil(payload: dict[str, Any]) -> dict[str, Any]:
    """Whole paid order on the GPU box: Felix voice → four cuts → stored for download.

    The Worker only submits this job and later reads the small result, so no
    audio passes through Cloudflare's CPU-limited request path.
    """
    order = payload.get("order")
    cuts = payload.get("cuts")
    store = payload.get("store")
    prefixes = (store or {}).get("prefixes")
    if not isinstance(order, dict) or not isinstance(cuts, list) or not 1 <= len(cuts) <= 8 or not isinstance(store, dict) or not isinstance(prefixes, dict):
        return fail("Fulfil request is invalid")
    if not all(isinstance(c, dict) and isinstance(c.get("id"), str) and isinstance(prefixes.get(c["id"]), str) for c in cuts):
        return fail("Fulfil request is invalid")
    generated = generate({"profile_id": order.get("voiceboxProfileId"), "text": order.get("phrase")})
    if "error" in generated:
        return generated
    try:
        pcm = to_pcm48(base64.b64decode(generated["audio_base64"]))
    except (RuntimeError, ValueError, subprocess.TimeoutExpired) as error:
        return fail(str(error))
    pcm_b64 = base64.b64encode(pcm).decode("ascii")
    results = []
    for cut in cuts:
        rendered = render({"pcm_base64": pcm_b64, "cut": cut, "order": order})
        if "error" in rendered:
            return fail(f"Cut {cut.get('slot')}: {rendered['error']}")
        try:
            ref = upstash_put(store, prefixes[cut["id"]], base64.b64decode(rendered["audio_base64"]))
        except (RuntimeError, httpx.HTTPError, ValueError) as error:
            return fail(f"Cut {cut.get('slot')}: {error}")
        results.append({"id": cut["id"], **ref, "metrics": rendered["metrics"]})
    return {"generation": generated["generation"], "cuts": results}


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
    if action == "render":
        return render(payload)
    if action == "fulfil":
        return fulfil(payload)
    if action == "list_profiles":
        return list_profiles(payload)
    return fail("Action is invalid")


runpod.serverless.start({"handler": handler})
