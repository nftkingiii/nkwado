# Offline narration with Kokoro (kokoro-onnx, Apache-2.0 model, no key, no cost).
# Usage (on the VM): ../kokoro/venv/bin/python audio/tts.py [voice] [speed]
# Writes audio/vo/<shot>.wav per line and audio/vo/timings.json with each line's duration.
import json
import os
import sys

import soundfile as sf
from kokoro_onnx import Kokoro

voice = sys.argv[1] if len(sys.argv) > 1 else "af_heart"
speed = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
here = os.path.dirname(os.path.abspath(__file__))
kdir = os.path.expanduser("~/nkwado/kokoro")
k = Kokoro(os.path.join(kdir, "kokoro-v1.0.onnx"), os.path.join(kdir, "voices-v1.0.bin"))

lines = json.load(open(os.path.join(here, "narration.json"), encoding="utf-8"))
out = os.path.join(here, "vo")
os.makedirs(out, exist_ok=True)
timings = []
for line in lines:
    samples, sr = k.create(line["text"], voice=voice, speed=speed, lang="en-us")
    path = os.path.join(out, f"{line['shot']}.wav")
    sf.write(path, samples, sr)
    timings.append({"shot": line["shot"], "dur": round(len(samples) / sr, 3), "file": f"vo/{line['shot']}.wav"})
    print(f"{line['shot']}: {len(samples) / sr:.2f}s")
json.dump({"voice": voice, "speed": speed, "sr": sr, "lines": timings}, open(os.path.join(out, "timings.json"), "w"), indent=1)
print("total", round(sum(t["dur"] for t in timings), 2), "s")
