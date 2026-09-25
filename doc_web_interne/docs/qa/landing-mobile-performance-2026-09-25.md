# Landing mobile performance — 2026-09-25

## Report and diagnosis

Mobile visitors reported a black cutoff behind the flying cards and slow rendering.
The shared sky used a masked 6,233px ancestor around a sticky video at a 390×844
viewport (DPR 3). That large compositing surface is a plausible cause of mobile
rendering artifacts; the exact black frame was not reproduced on a physical iPhone.
The card animation also kept running while hidden behind analysis/constellation.

## Changes

- Keep one viewport-sized fixed sky (100lvh), with the existing film, synchronized
  intro dissolve, zoom and scroll parallax. Fade it only when leaving the journey.
- Pause hidden card rotation and offscreen video; resume on reverse scroll.
- Reuse scroll geometry; update only analysis words and progress states that change.
- Start loading the loop after the opening film starts, keeping a still poster.
- Remove an unused transparent pseudo-background and reserve mobile navigation
  dimensions before its script loads, eliminating a measured bootstrap shift.

## Evidence

Local Chromium, mobile 390×844/DPR 3, CPU throttled 4×. Same scripted scroll path,
3.5 seconds per phase plus settling; one run before and after, not a device benchmark.

| Phase | JS time before / after | Style recalculation before / after |
| --- | --- | --- |
| Analysis | 74 / 47 ms | 98 / 52 ms |
| Constellation | 70 / 49 ms | 169 / 107 ms |

Frame intervals remained similar (p95 about 27ms); no claim of measured iPhone FPS
improvement. The 6,237px painted sky layer disappeared, replaced by an 844px surface.
Chrome DevTools MCP with Slow 4G/CPU 4× measured CLS 0.13 during diagnosis and 0.00
after the navigation/pseudo-background fix; final LCP 2.819s, 46/46 HTTP 200,
no JavaScript/resource errors. Local server is uncompressed; not production CWV.

Behavior checks passed: visible cards rotate, hidden cards stop, reverse scroll
resumes them, analysis text appears, sky covers 390×844, 390×930 and 1440×900,
video pauses after the journey and resumes on return, no horizontal overflow.
Nine focused tests cover sky coverage/reversal/layout reads, intro, card drag and
native dream-dialog scrolling. No screenshots or automated visual approval.

Physical Safari/iOS and Android Chrome still need user confirmation of the original
black-frame symptom and perceived smoothness. No animation was removed.

## Intro loading follow-up

A production Chrome DevTools MCP trace (390×844/DPR 3, Slow 4G, CPU 4×)
found three intro buffering pauses totalling about 447ms. The MP4 transferred
485,680 bytes; first playback was at 4.610s. The loop competed for bandwidth
as soon as the intro began.

The landing head now warms the actual muted video element before styles and
animation modules finish loading; the experience layer adopts that element.
The existing 1280×720 VP9/WebM intro is preferred with MP4 as the next source.
Reduced motion, Save-Data and 2G still prevent automatic preloading. Unused
preloaded media is released if enhancement fails to initialize.

The background starts preparing only when the remaining intro is buffered,
including a timeupdate check because demuxing can update buffered ranges after
the last progress event. Its preparation timeout uses the remaining intro time.
The existing synchronized dissolve is retained.

Final local MCP trace with the same throttling: 236,974 bytes for the intro
(51% fewer), no intro buffering pauses, no errors, CLS 0. The loop's first frame
was ready 610ms before the intro ended; playback resumed 7ms after the end event.
Local first playback was 4.370s; the uncompressed local server differs from
production, so this is not a controlled production startup-time comparison.
Twenty-four focused tests cover preload preferences/cleanup, disjoint buffers,
skip/autoplay fallback and preparation deadlines. No screenshots were taken.
