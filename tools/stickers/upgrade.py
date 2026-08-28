#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
The craft pass.

Every Truce sticker used to be flat fills inside one uniform 4.2 outline. That
reads as clip-art: correct, cheap, weightless. The characters this brief points
at read as soft objects, and almost all of that comes from three things that
have nothing to do with how well the pose is drawn:

  1. FORM. A body is not one colour. It is lighter where the light is and
     deeper at the far edge. One radial gradient per fill turns a pink circle
     into something you could squeeze.
  2. LINE HIERARCHY. A silhouette line carries more weight than an interior
     line. Uniform weight is the single loudest tell of a generated drawing;
     4.6 outside against the existing lighter interior strokes reads as drawn.
  3. WEIGHT. Nothing cast a shadow, so everything floated. A very soft ellipse
     under the feet puts the character on the page.

None of it redraws anything. The poses — which are genuinely well acted, with
real arms and props and two-character staging — are untouched. This runs over
the finished markup and lifts the material, so all sixty-two drawings improve
without anybody re-posing a single limb.

WHY THE IDS ARE NAMESPACED
--------------------------
Gradient ids are global to the DOM, not to the <svg> that declares them. Four
stickers on one card, or a whole pack in the picker, all declaring id="f0"
means every one of them silently renders with the FIRST definition — so a pig
would wear a panda's gradient and nothing would look broken enough to notice.
Every id here carries its pose slug.
"""

import colorsys
import re

INK = '#3D2137'
SILHOUETTE_SW = '4.2'      # what the rig emits today
UPGRADED_SW = '4.6'        # what a silhouette gets instead

# Fills that are never a body: ink, whites-of-eyes, glints, and the blues and
# greys of tears, rain and clouds. Giving these a form gradient makes them look
# grubby rather than round.
SKIP_FILLS = {
    '#3D2137', '#1F0F1C', '#FFFFFF', '#FFF7F2', '#FFFDFC', 'none',
    '#BFD6F5', '#CFE0F7', '#D5CDE6', '#7A2E44',
}


def _hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def _rgb_to_hex(r, g, b):
    return '#%02X%02X%02X' % tuple(max(0, min(255, round(c * 255))) for c in (r, g, b))


def _shift(hex_colour, dl, ds=0.0, dh=0.0):
    """Move a colour in HLS. Lightness first, because that is the whole trick."""
    r, g, b = _hex_to_rgb(hex_colour)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    l = max(0.0, min(1.0, l + dl))
    s = max(0.0, min(1.0, s + ds))
    h = (h + dh) % 1.0
    return _rgb_to_hex(*colorsys.hls_to_rgb(h, l, s))


def form_stops(base):
    """
    Highlight and shadow for one fill.

    The shadow warms slightly as it darkens (a small hue push towards red)
    because a neutral darkening reads as dirty on these pinks and creams. Very
    light fills get a shallower ramp — a cream panda with a strong gradient
    looks stained rather than round.
    """
    r, g, b = _hex_to_rgb(base)
    _, l, _ = colorsys.rgb_to_hls(r, g, b)
    if l > 0.90:                       # near-white: whisper only
        return _shift(base, +0.035), _shift(base, -0.085, +0.03, -0.005)
    if l > 0.75:                       # creams and pale pinks
        return _shift(base, +0.070), _shift(base, -0.135, +0.05, -0.007)
    return _shift(base, +0.095), _shift(base, -0.165, +0.06, -0.010)


FILL_RE = re.compile(r'fill="(#[0-9A-Fa-f]{6})"')


def _silhouette_fills(svg):
    """Fills that appear on a shape carrying the house silhouette weight."""
    found = []
    for tag in re.findall(r'<[^>]*stroke-width="%s"[^>]*>' % SILHOUETTE_SW, svg):
        m = FILL_RE.search(tag)
        if not m:
            continue
        c = m.group(1).upper()
        if c in SKIP_FILLS or c in found:
            continue
        found.append(c)
    return found


def upgrade_svg(inner, slug, ground=True):
    """
    Return the pose with form, line hierarchy and weight added.

    `slug` namespaces every generated id. `ground` adds the contact shadow —
    off for the few poses that are not standing on anything.
    """
    ns = re.sub(r'[^a-z0-9]+', '-', slug.lower()).strip('-')
    fills = _silhouette_fills(inner)
    if not fills:
        return inner

    defs = []
    for i, base in enumerate(fills):
        lite, shade = form_stops(base)
        gid = 'g-%s-%d' % (ns, i)
        defs.append(
            '<radialGradient id="%s" cx="36%%" cy="24%%" r="86%%">'
            '<stop offset="0%%" stop-color="%s"/>'
            '<stop offset="58%%" stop-color="%s"/>'
            '<stop offset="100%%" stop-color="%s"/>'
            '</radialGradient>' % (gid, lite, base, shade)
        )

    out = inner
    # Only rewrite the fill on shapes that actually carry the silhouette weight,
    # so an interior detail sharing a colour keeps its flat fill.
    def swap(tag_match):
        tag = tag_match.group(0)
        m = FILL_RE.search(tag)
        if not m:
            return tag
        c = m.group(1).upper()
        if c not in fills:
            return tag
        gid = 'g-%s-%d' % (ns, fills.index(c))
        tag = FILL_RE.sub('fill="url(#%s)"' % gid, tag, count=1)
        return tag.replace('stroke-width="%s"' % SILHOUETTE_SW,
                           'stroke-width="%s"' % UPGRADED_SW)

    out = re.sub(r'<[^>]*stroke-width="%s"[^>]*>' % SILHOUETTE_SW, swap, out)

    head = '<defs>%s</defs>' % ''.join(defs)
    if ground:
        # Sits under everything, wide and faint. Deliberately not centred on the
        # board: most poses lean, and a shadow that ignores the lean looks stuck
        # on. 58 is where the weight sits in practice across these packs.
        head += '<ellipse cx="58" cy="112.5" rx="27" ry="4.6" fill="#3D2137" opacity=".11"/>'
    return head + out


def soften_blush(inner):
    """
    Blush was a hard-edged pink oval at .85. Two stacked ovals at lower opacity
    give it a falloff, which is most of the difference between "painted on" and
    "warm". Cheap, and it survives being scaled to 72px.
    """
    def rep(m):
        cx, cy, rx, ry = m.group('cx'), m.group('cy'), float(m.group('rx')), float(m.group('ry'))
        return (
            '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="#FF8FA3" opacity=".42"/>'
            '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="#FF7E96" opacity=".34"/>'
            % (cx, cy, rx * 1.06, ry * 1.06, cx, cy, rx * 0.66, ry * 0.62)
        )

    return re.sub(
        r'<ellipse cx="(?P<cx>[\d.]+)" cy="(?P<cy>[\d.]+)" rx="(?P<rx>[\d.]+)" ry="(?P<ry>[\d.]+)"'
        r' fill="#FF9FB0" opacity="[\d.]+"\s*/>',
        rep, inner)


def upgrade(inner, slug, ground=True):
    """Everything, in the order the layers need to land."""
    return upgrade_svg(soften_blush(inner), slug, ground=ground)
