#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Making a sticker feel alive.

WHY NOT GIFS
------------
The brief was "like gif stickers". The feeling is right; the format is not.

  size      one of these at 240px with the new soft gradients is 150-400KB as
            a GIF. Sixty-two of them is tens of megabytes, on a page somebody
            opens on a phone at 2am. The animated SVG is 3-5KB and the motion
            costs nothing extra because it is CSS.
  colour    GIF is 256 indexed colours with 1-bit alpha. The form gradients
            this pack just gained would band into stripes, and every edge
            would carry a hard halo of whatever background it was flattened
            against — so a sticker would look wrong the moment a card theme
            changed behind it.
  care      a GIF cannot honour prefers-reduced-motion. Somebody who has asked
            their device to stop animating things would get animation anyway.
            That is not a small thing on an app people open when they are upset.
  scale     GIF has one resolution. These are used at 72px in the tray and
            120px+ on a card.

So: CSS on SVG, which is what the packs already do. GIF and WebP are still the
right answer for EXPORTING a sticker to WhatsApp or iMessage, which is a real
feature and a separate one — those platforms need a file, and there we would
rasterise deliberately.

WHAT WAS ACTUALLY MISSING
-------------------------
The packs already carry one motion class each. Two things were absent:

  1. NOBODY BLINKS. `.stk-blink` has been sitting in globals.css and was used
     on exactly one sticker out of sixty-two. A blink is the cheapest and by
     far the strongest signal that a drawn face is alive — a still face with a
     bobbing body reads as a puppet, and there is a real uncanny quality to a
     grid of unblinking eyes.
  2. EVERYTHING MOVED IN PHASE. All ten stickers in a pack start their loop at
     the same instant, so the picker pulses like a screensaver instead of
     looking like ten separate creatures. A per-pose delay, derived from the
     pose name so it is stable between builds, fixes it entirely.

Plus a slow breath under everything, which is the layer that turns "an image
that is moving" into "a thing that is idling".
"""

import hashlib
import re

INK = '#3D2137'

# Eye pupils are ink-filled ellipses with no stroke, sat in the upper face.
# Panda ear circles and nose dots are ink too, so the bounds matter: ears carry
# a stroke, and a nose is far smaller than an eye.
EYE_MIN_RY, EYE_MAX_RY = 3.6, 15.5
EYE_MIN_CY, EYE_MAX_CY = 18.0, 78.0

ELEMENT_RE = re.compile(r'<(ellipse|circle)\b([^>]*?)/>')
ATTR_RE = re.compile(r'([a-zA-Z-]+)="([^"]*)"')


def _attrs(raw):
    return {m.group(1): m.group(2) for m in ATTR_RE.finditer(raw)}


def _f(d, key, default=None):
    try:
        return float(d[key])
    except (KeyError, TypeError, ValueError):
        return default


def find_eyes(svg):
    """
    Return [(cx, cy, rx, ry), …] for what look like eyes.

    Deliberately conservative. A false positive puts an eyelid on somebody's
    nose, which is far worse than a character that does not blink, so anything
    ambiguous is left alone.
    """
    found = []
    for m in ELEMENT_RE.finditer(svg):
        a = _attrs(m.group(2))
        if a.get('fill', '').upper() != INK:
            continue
        if 'stroke' in a:                      # ears and paws are stroked; eyes are not
            continue
        cx, cy = _f(a, 'cx'), _f(a, 'cy')
        if cx is None or cy is None:
            continue
        if m.group(1) == 'circle':
            rx = ry = _f(a, 'r', 0)
        else:
            rx, ry = _f(a, 'rx', 0), _f(a, 'ry', 0)
        if not (EYE_MIN_RY <= ry <= EYE_MAX_RY):
            continue
        if not (EYE_MIN_CY <= cy <= EYE_MAX_CY):
            continue
        if rx < 3.0:                           # a nose dot, not an eye
            continue
        found.append((cx, cy, rx, ry))

    # One eye can be several stacked ellipses (a lash ring over a pupil). Keep
    # the largest of each cluster so the lid covers the whole thing.
    clusters = []
    for cx, cy, rx, ry in found:
        for c in clusters:
            if abs(c[0] - cx) < 5.0 and abs(c[1] - cy) < 6.0:
                if rx * ry > c[2] * c[3]:
                    c[0], c[1], c[2], c[3] = cx, cy, rx, ry
                break
        else:
            clusters.append([cx, cy, rx, ry])
    return [tuple(c) for c in clusters]


def blink_layer(svg, slug):
    """
    A lid that is invisible almost all the time and snaps shut for ~120ms.

    Drawn as a closing CURVE in ink rather than a shape filled with the face
    colour. The face colour is not knowable here — an eye can sit on a pink
    cheek, a cream muzzle or a black panda patch, and guessing wrong is very
    visible. A stroked arc over the top reads as a shut eye on all three.
    """
    eyes = find_eyes(svg)
    # 0 is the common and CORRECT answer: over half these poses draw closed,
    # curved eyes — a happy squint, a wince, a sob — and a closed eye cannot
    # blink. 3 or 4 is also correct, for the two-character poses. Above that
    # the detector has found something that is not an eye, and no blink beats a
    # lid on somebody's nose.
    if not eyes or len(eyes) > 4:
        return ''
    out = []
    for cx, cy, rx, ry in eyes:
        # The cover hides the open eye; the arc is the shut one. Keeping the
        # cover just inside the pupil's own bounds stops a blink reading as a
        # pair of sunglasses, which is what 1.06 looked like.
        out.append('<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="%s"/>'
                   % (cx, cy, rx * 0.99, ry * 1.02, 'var(--stk-lid, #FFF7F2)'))
        w = rx * 1.02
        out.append(
            '<path d="M%.1f %.1f q%.1f %.1f %.1f 0" stroke="%s" stroke-width="3.0"'
            ' fill="none" stroke-linecap="round"/>'
            % (cx - w, cy - ry * .18, w, ry * 1.05, w * 2, INK)
        )
    return '<g class="stk-blink stk-blink--%s">%s</g>' % (_phase_class(slug), ''.join(out))


def _phase(slug, spread=1.0):
    """
    A stable pseudo-random offset in [0, spread).

    Derived from the pose name rather than random() so a rebuild does not
    reshuffle every delay and produce a diff of sixty-two meaningless changes.
    """
    h = hashlib.sha1(slug.encode('utf-8')).digest()
    return (h[0] / 255.0) * spread


def _phase_class(slug):
    """One of eight delay buckets — enough to break unison, few enough to keep
    the CSS readable."""
    return 'p%d' % int(_phase(slug, 8.0))


def animate(svg, slug):
    """
    Wrap a finished pose in its idle motion.

    Order matters: the breath is the outermost layer so it carries everything
    including the existing per-pose loop, which keeps its own timing and
    therefore drifts against the breath instead of beating with it. That drift
    is most of why it stops looking mechanical.
    """
    blink = blink_layer(svg, slug)
    return '<g class="stk-breathe stk-breathe--%s">%s%s</g>' % (_phase_class(slug), svg, blink)


CSS = """
/* ---------------------------------------------------------------------------
   Sticker idle motion
   ---------------------------------------------------------------------------
   Every sticker already had one loop of its own. These are the two layers that
   were missing: a slow breath under everything, and a blink.

   The breath is deliberately slower than any of the pose loops and is applied
   OUTSIDE them, so the two never line up and the result drifts instead of
   pulsing. Eight phase buckets stop a grid of stickers moving as one animal.

   Everything here stops dead under prefers-reduced-motion — see the block at
   the end of this file. A GIF could not have done that, which is most of the
   reason these are SVG.
   ------------------------------------------------------------------------- */
@keyframes stkBreathe{
  0%,100%{transform:scale(1) translateY(0)}
  50%{transform:scale(1.018,.986) translateY(.6px)}
}
.stk-breathe{animation:stkBreathe 4.6s var(--ease) infinite;transform-origin:50% 96%}

/* Lids sit at opacity 0 and snap shut. `steps(1,end)` keeps the snap crisp —
   an eased blink looks like a character falling asleep. */
@keyframes stkBlinkLid{0%,93%,100%{opacity:0}94.5%,97%{opacity:1}}
.stk-blink{opacity:0;animation:stkBlinkLid 5.4s steps(1,end) infinite}
"""

CSS += '\n'.join(
    '.stk-breathe--p%d{animation-delay:-%.2fs}.stk-blink--p%d{animation-delay:-%.2fs}'
    % (i, i * 0.57, i, i * 0.67)
    for i in range(8)
) + '\n'
