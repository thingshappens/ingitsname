"""WORLD -10 semitone transform (same as handler.sexy_synthetic), stdin WAV → stdout WAV.

Used by edit-render/cli.js so the Sexy Synthetic cut runs locally on the GPU box
instead of calling the RunPod API from inside a RunPod job.
"""
import io
import math
import sys

import numpy as np
import pyworld as pw
import soundfile as sf

source = sys.stdin.buffer.read()
audio, sample_rate = sf.read(io.BytesIO(source), dtype="float64", always_2d=True)
if sample_rate != 48000 or audio.shape[0] > sample_rate * 25:
    sys.stderr.write("Voice transformation source is invalid")
    sys.exit(1)
mono = np.mean(audio, axis=1)
f0, times = pw.dio(mono, sample_rate, f0_floor=45.0, f0_ceil=300.0, frame_period=5.0)
f0 = pw.stonemask(mono, f0, times, sample_rate)
spectral = pw.cheaptrick(mono, f0, times, sample_rate)
aperiodicity = pw.d4c(mono, f0, times, sample_rate)
shifted = pw.synthesize(f0 * math.pow(2.0, -10.0 / 12.0), spectral, aperiodicity, sample_rate, frame_period=5.0)
output = io.BytesIO()
sf.write(output, np.clip(shifted, -1.0, 1.0), sample_rate, format="WAV", subtype="FLOAT")
sys.stdout.buffer.write(output.getvalue())
