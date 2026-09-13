# HSC RunPod worker

This is the private queue worker for The Edit. It runs the pinned Voicebox
source locally, accepts only the configured HSC profile IDs, and exposes two
RunPod job actions:

- `generate` — dry English Qwen 1.7B generation (maximum `HSC_MAX_TEXT_LENGTH`)
- `sexy_synthetic` — approved WORLD -10 semitone transform of a 48 kHz WAV
- `import_profile` — one-time import from the private mounted ZIP archive

Required endpoint environment variables:

- `HSC_BOOTSTRAP_TOKEN`: random one-time import token, removed after bootstrap
- `HSC_ALLOWED_PROFILE_IDS`: Felix2 profile UUID after it has been imported
- `VOICEBOX_DATA_DIR`: `/runpod-volume/voicebox-data`
- `VOICEBOX_MODELS_DIR`: `/runpod-volume/model-cache`
- `HSC_PROFILE_ARCHIVE`: `/runpod-volume/felix2/felix2-profile.zip`

The worker returns audio as base64 only inside the authenticated RunPod job
result. It never exposes Voicebox's port, profiles, or generated-audio routes.

Before creating an endpoint, test this image with one real `generate` job and
verify that the returned WAV is Felix2. Keep `min workers` at `0` and `max
workers` at `1` for the initial endpoint.
