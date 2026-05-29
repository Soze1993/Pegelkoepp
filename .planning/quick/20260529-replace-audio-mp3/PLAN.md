---
slug: replace-audio-mp3
date: 2026-05-29
---

Replace synthesized Web Audio API tones with MP3 file playback.

## Changes

- public/index.html: remove _audioCtx / getAudioCtx / warmup listener / playKDATone (oscillators) / playBKTone (oscillators)
  Replace with new Audio('/sounds/kda-end.mp3') and new Audio('/sounds/bk-end.mp3')
- public/tv.js: remove _tvAudioCtx / getTVAudioCtx / warmup listener / playKDAToneTV (oscillators)
  Replace with new Audio('/sounds/kda-end.mp3')
- Create public/sounds/README.txt with drop-in instructions

Function names unchanged so call sites are unaffected.
