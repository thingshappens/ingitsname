# HSC's scale-to-zero RunPod worker.  The worker exposes a queue handler, not
# an internet-facing Voicebox server: RunPod authenticates calls to the job API.
FROM pytorch/pytorch:2.7.1-cuda12.8-cudnn9-runtime

ARG VOICEBOX_REF=51f49dea198384b4eb6087b72c17057c6eb1c1cd
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg git libsndfile1 build-essential \
  && rm -rf /var/lib/apt/lists/*

# Pin Voicebox so a later upstream change cannot silently change Felix's
# production renderer.  Qwen is the only HSC pilot engine installed here.
RUN git clone https://github.com/jamiepine/voicebox.git /opt/voicebox \
  && cd /opt/voicebox \
  && git checkout "$VOICEBOX_REF" \
  && pip install --no-cache-dir -r backend/requirements.txt \
  && pip install --no-cache-dir --no-deps chatterbox-tts hume-tada

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY handler.py ./

ENV PYTHONPATH=/opt/voicebox \
    PYTHONUNBUFFERED=1 \
    HSC_MAX_TEXT_LENGTH=220 \
    VOICEBOX_DATA_DIR=/runpod-volume/voicebox-data \
    VOICEBOX_MODELS_DIR=/runpod-volume/model-cache \
    HSC_PROFILE_ARCHIVE=/runpod-volume/felix2/felix2-profile.zip

CMD ["python", "-u", "/app/handler.py"]
