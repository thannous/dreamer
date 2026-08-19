#!/usr/bin/env python3
"""
Generates the Noctalia Meditation brand assets.

There is no image tooling on the build machines, so the mark is rendered here
rather than shipped as opaque binaries: the shapes stay editable, and anyone can
regenerate every size from this one file.

    python3 scripts/generate-brand-assets.py

The mark is a champagne crescent inside a thin ring — the night of the Noctalia
brand, and the breath this app is about. Coverage is computed analytically per
scanline, so edges are anti-aliased without supersampling the whole canvas.
"""

import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'assets' / 'images'

INK = (0x03, 0x04, 0x0D)
CHAMPAGNE = (0xD4, 0xA5, 0x74)
# Readable champagne, for the mark on the paper background.
CHAMPAGNE_DEEP = (0x9A, 0x63, 0x32)
WHITE = (0xFF, 0xFF, 0xFF)

# Vertical sub-samples per pixel row. Horizontal coverage is exact, so this is
# the only place the rendering approximates anything.
SUBROWS = 4


def disc_span(cx, cy, r, y):
    """Horizontal span of a disc at scanline `y`, or None."""
    dy = y - cy
    if abs(dy) >= r:
        return None
    dx = math.sqrt(r * r - dy * dy)
    return (cx - dx, cx + dx)


def subtract(span, hole):
    """`span` minus `hole`, as up to two spans."""
    if span is None:
        return []
    if hole is None:
        return [span]

    a0, a1 = span
    b0, b1 = hole
    if b1 <= a0 or b0 >= a1:
        return [span]

    out = []
    if b0 > a0:
        out.append((a0, b0))
    if b1 < a1:
        out.append((b1, a1))
    return out


def add_span(row, span, width):
    """Accumulates coverage for one span, exact at both ends."""
    x0, x1 = span
    x0 = max(0.0, x0)
    x1 = min(float(width), x1)
    if x1 <= x0:
        return

    first, last = int(x0), min(int(x1), width - 1)
    if first == last:
        row[first] += (x1 - x0) / SUBROWS
        return

    row[first] += (first + 1 - x0) / SUBROWS
    for x in range(first + 1, last):
        row[x] += 1.0 / SUBROWS
    row[last] += (x1 - last) / SUBROWS


def render_mark(size, scale, with_ring=True):
    """Coverage map of the mark, 0 → 1 per pixel."""
    cx = cy = size / 2
    r = size * scale

    # The crescent: a disc with a second disc bitten out of it, offset up and
    # to the right so the opening faces the same way as the brand's light.
    hole_cx, hole_cy, hole_r = cx + 0.34 * r, cy - 0.12 * r, 0.86 * r

    ring_r = 1.30 * r
    ring_w = 0.055 * r

    coverage = [[0.0] * size for _ in range(size)]

    for py in range(size):
        row = coverage[py]
        for s in range(SUBROWS):
            y = py + (s + 0.5) / SUBROWS

            for span in subtract(disc_span(cx, cy, r, y), disc_span(hole_cx, hole_cy, hole_r, y)):
                add_span(row, span, size)

            if with_ring:
                outer = disc_span(cx, cy, ring_r, y)
                inner = disc_span(cx, cy, ring_r - ring_w, y)
                for span in subtract(outer, inner):
                    add_span(row, span, size)

    return coverage


def write_png(path, size, pixels):
    """`pixels` is a flat RGBA bytearray."""
    raw = b''.join(
        b'\x00' + bytes(pixels[y * size * 4 : (y + 1) * size * 4]) for y in range(size)
    )

    def chunk(tag, data):
        body = tag + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xFFFFFFFF)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    path.write_bytes(png)
    return len(png)


def compose(size, coverage, fg, bg=None):
    pixels = bytearray(size * size * 4)

    for y in range(size):
        row = coverage[y]
        for x in range(size):
            a = min(1.0, row[x])
            i = (y * size + x) * 4

            if bg is None:
                # Transparent plate: the mark carries its own alpha.
                pixels[i : i + 3] = bytes(fg)
                pixels[i + 3] = int(round(a * 255))
            else:
                pixels[i] = int(round(bg[0] + (fg[0] - bg[0]) * a))
                pixels[i + 1] = int(round(bg[1] + (fg[1] - bg[1]) * a))
                pixels[i + 2] = int(round(bg[2] + (fg[2] - bg[2]) * a))
                pixels[i + 3] = 255

    return pixels


def build(name, size, scale, fg, bg, with_ring=True):
    coverage = render_mark(size, scale, with_ring)
    written = write_png(OUT / name, size, compose(size, coverage, fg, bg))
    print(f'  {name:<32} {size}×{size}  {written / 1024:.0f} Ko')


def main():
    print('Marque Noctalia Meditation :')

    # Full-bleed square; the platforms round the corners themselves.
    build('icon.png', 1024, 0.28, CHAMPAGNE, INK)

    # Android adaptive: everything outside the central 66% can be cropped, so
    # the mark stays inside it — but filling ~90% of that circle, not floating
    # in the middle of it, or it reads as a small icon next to its neighbours.
    build('android-icon-foreground.png', 1024, 0.225, CHAMPAGNE, None)
    build('android-icon-background.png', 1024, 0.0, INK, INK, with_ring=False)
    # Themed icons are recoloured by the system from the alpha alone.
    build('android-icon-monochrome.png', 1024, 0.225, WHITE, None)

    # Splash, one mark per background. Champagne on paper measures 2.1:1 —
    # fine for a large shape, thin for the ring — so the light variant uses the
    # deeper amber, which reads at 4.1:1.
    build('splash-icon.png', 512, 0.28, CHAMPAGNE_DEEP, None)
    build('splash-icon-dark.png', 512, 0.28, CHAMPAGNE, None)

    # At 64px the ring collapses into a smudge — the crescent alone reads.
    build('favicon.png', 64, 0.30, CHAMPAGNE, INK, with_ring=False)


if __name__ == '__main__':
    main()
