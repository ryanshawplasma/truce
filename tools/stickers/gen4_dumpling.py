#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pack F — "Dumpling" 🥟. One character, ten real feelings.

WHY A SIXTH PACK, AND WHY ONLY ONE CHARACTER
--------------------------------------------
The five couple packs are all pitched at the same emotional temperature:
begging, waterfall tears, pouty, sulk-and-rain, made-up. They are charming and
they are all *comic*. Truce is an app people open after they have hurt
somebody, and there was nothing in sixty-two drawings for the quiet end of
that — no plain "I am sorry" without a gag, nothing that could sit under a
message somebody had to work up to sending.

So this pack is the quiet end. Two characters cuddling is a joke about a
feeling; one character having the feeling IS the feeling, and a single face
also gives every pixel of a 72px sticker to the expression instead of splitting
it between two heads.

WHERE THE EXPRESSION LIVES
--------------------------
In this style almost nothing is available to act with — no eyebrows worth the
name, no shoulders, no hands to speak of. So the whole emotional range comes
out of five dials, and each one earns its place:

  eye height     a squashed eye reads as looking down or away, an open one as
                 hope. This alone separates shame from wanting.
  lower lid      a curve across the BOTTOM of the eye is the single most
                 useful mark here. It is what makes a face look like it is
                 holding something back rather than simply sad.
  brow           small, thin, floating clear of the eye. Inner ends UP is
                 worry; inner ends DOWN is anger, and getting that backwards
                 makes an apology sticker look furious — which it did, on the
                 first pass.
  head tilt      down-and-away for shame, up for hope. Five degrees is plenty.
  arms           the thing the earlier prototype was missing. Hands held
                 together, one reaching, arms wrapped around itself.

The pack deliberately contains no speech bubbles. A drawing that needs a word
printed on it has not done its job, and the two existing "forgive me?" stickers
are the weakest in the set.
"""

import colorsys

P = '#3D2137'                     # house plum ink
BODY = '#F6C6A8'                  # warm dough
CHEEK = '#FF8FA3'
TEAR = '#CFE0F7'
SIL, INT = 4.6, 2.5


def n(v):
    return ('%.2f' % v).rstrip('0').rstrip('.')


def _hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def _shift(c, dl, ds=0.0, dh=0.0):
    r, g, b = _hex_to_rgb(c)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    r, g, b = colorsys.hls_to_rgb((h + dh) % 1.0,
                                  max(0, min(1, l + dl)),
                                  max(0, min(1, s + ds)))
    return '#%02X%02X%02X' % tuple(round(x * 255) for x in (r, g, b))


def defs(slug):
    lite, shade = _shift(BODY, +0.085), _shift(BODY, -0.150, +0.05, -0.008)
    return (
        '<defs>'
        '<radialGradient id="d-%s" cx="36%%" cy="24%%" r="86%%">'
        '<stop offset="0%%" stop-color="%s"/>'
        '<stop offset="58%%" stop-color="%s"/>'
        '<stop offset="100%%" stop-color="%s"/>'
        '</radialGradient>'
        '<radialGradient id="s-%s" cx="50%%" cy="50%%" r="50%%">'
        '<stop offset="0%%" stop-color="#FFFFFF" stop-opacity=".30"/>'
        '<stop offset="60%%" stop-color="#FFFFFF" stop-opacity=".10"/>'
        '<stop offset="100%%" stop-color="#FFFFFF" stop-opacity="0"/>'
        '</radialGradient>'
        '</defs>' % (slug, lite, BODY, shade, slug)
    )


def shadow(cx=60, w=25, op=.11):
    return ('<ellipse cx="%s" cy="112.5" rx="%s" ry="4.6" fill="#3D2137" opacity="%s"/>'
            % (n(cx), n(w), op))


ARM_FILL = None          # filled in below, once _shift exists


def arm(d, slug=None, w_dark=14.0, w_fill=7.4):
    """
    Double-stroke limb: ink underneath, dough on top.

    The fill is FLAT and a shade darker than the body, not the body gradient.
    Using the gradient lit every limb brighter than the torso it grew out of,
    so ten stickers looked like they were holding orange sausages.
    """
    return ('<path d="%s" stroke="%s" stroke-width="%s" fill="none" stroke-linecap="round"/>'
            '<path d="%s" stroke="%s" stroke-width="%s" fill="none" stroke-linecap="round"/>'
            % (d, P, n(w_dark), d, ARM_FILL, n(w_fill)))


ARM_FILL = _shift(BODY, -0.045)


def eye(cx, cy, ry, lid=0.0, slug='x', rx=8.2):
    """One eye. `lid` is how far a curve creeps up from the bottom, 0 to ~.6."""
    o = '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"/>' % (n(cx), n(cy), n(rx), n(ry), P)
    o += '<circle cx="%s" cy="%s" r="%s" fill="#FFFFFF"/>' % (n(cx - rx * .35), n(cy - ry * .42), n(rx * .46))
    o += ('<circle cx="%s" cy="%s" r="%s" fill="#FFFFFF" opacity=".9"/>'
          % (n(cx + rx * .36), n(cy + ry * .36), n(rx * .23)))
    if lid > 0:
        y = cy + ry * (1 - lid)
        o += ('<path d="M%s %s q%s %s %s 0 L%s %s L%s %s Z" fill="url(#d-%s)"/>'
              % (n(cx - rx - .4), n(y), n(rx + .4), n(ry * lid * 1.5), n(rx * 2 + .8),
                 n(cx + rx + .4), n(cy + ry + 1.2), n(cx - rx - .4), n(cy + ry + 1.2), slug))
        o += ('<path d="M%s %s q%s %s %s 0" stroke="%s" stroke-width="%s" fill="none"'
              ' stroke-linecap="round"/>'
              % (n(cx - rx), n(y), n(rx), n(ry * lid * 1.5), n(rx * 2), P, n(INT)))
    return o


def closed_eye(cx, cy, w=8.4, d=8.0, up=True):
    """A happy or a peaceful closed eye, depending which way it bends."""
    return ('<path d="M%s %s q%s %s %s 0" stroke="%s" stroke-width="3.2" fill="none"'
            ' stroke-linecap="round"/>'
            % (n(cx - w), n(cy), n(w), n(-d if up else d), n(w * 2), P))


def brow(cx, y, inner, kind='worry', w=11.0, tilt=5.0):
    """
    Inner end UP is worry. Inner end DOWN is anger. This is the whole difference
    between "I'm sorry" and "how dare you", and it is one sign.
    """
    if kind == 'worry':
        y1, y2 = tilt * 1.5, -tilt * 1.5
    elif kind == 'raise':
        y1, y2 = 1.5, -1.5
    elif kind == 'flat':
        y1, y2 = 0.0, 0.0
    else:                                  # 'down' — used once, for hurt
        y1, y2 = -tilt * .5, tilt * .5
    x1, x2 = cx - w / 2 * inner, cx + w / 2 * inner
    # A shallow arch. Anything deeper reads as raised-in-surprise no matter what
    # the tilt is doing, which is how the first pass ended up with ten stickers
    # wearing the same startled face.
    arch = 0.9 if kind != 'raise' else 2.0
    return ('<path d="M%s %s Q%s %s %s %s" stroke="%s" stroke-width="2.5" fill="none"'
            ' stroke-linecap="round" opacity=".95"/>'
            % (n(x1), n(y + y1), n(cx), n(y + (y1 + y2) / 2 - arch), n(x2), n(y + y2), P))


def cheeks(cy=62, spread=21):
    o = ''
    for cx in (60 - spread, 60 + spread):
        o += '<ellipse cx="%s" cy="%s" rx="7.6" ry="4.6" fill="%s" opacity=".42"/>' % (n(cx), n(cy), CHEEK)
        o += '<ellipse cx="%s" cy="%s" rx="5.0" ry="2.9" fill="#FF7E96" opacity=".34"/>' % (n(cx), n(cy))
    return o


MOUTHS = {
    'wobble': 'M54 65 q3 3.2 6 0 q3 -3.2 6 0',
    'flat':   'M55.5 65 h9',
    'small':  'M56 64 q4 4 8 0',
    'press':  'M55 65.5 q5 -2.2 10 0',
    'soft':   'M55 64 q5 5 10 0',
    'open':   None,
}


def mouth(kind):
    if kind == 'open':
        return ('<ellipse cx="60" cy="65.5" rx="4.2" ry="5.0" fill="#7A2E44"/>'
                '<ellipse cx="60" cy="68.2" rx="2.6" ry="1.8" fill="#E8607E"/>')
    return ('<path d="%s" stroke="%s" stroke-width="3.3" fill="none" stroke-linecap="round"/>'
            % (MOUTHS[kind], P))


def tear(cx, cy, s=1.0):
    return ('<path d="M%s %s q%s %s 0 %s q%s %s 0 %s z" fill="%s" stroke="%s"'
            ' stroke-width="1.6" stroke-linejoin="round"/>'
            % (n(cx), n(cy), n(-3.4 * s), n(5.4 * s), n(8.4 * s),
               n(3.4 * s), n(-2.8 * s), n(-8.4 * s), TEAR, P))


def body(slug, tilt=0.0, arms='', extras_back='', extras_front='', ground=60):
    """Head-and-body bean with the head doing the tilting."""
    o = defs(slug) + shadow(ground) + extras_back
    o += ('<ellipse cx="60" cy="93" rx="24" ry="19" fill="url(#d-%s)" stroke="%s" stroke-width="%s"/>'
          % (slug, P, n(SIL)))
    o += arms
    o += '<g transform="rotate(%s 60 54)">' % n(tilt)
    for cx in (35, 85):
        o += ('<circle cx="%s" cy="30" r="10.4" fill="url(#d-%s)" stroke="%s" stroke-width="%s"/>'
              % (n(cx), slug, P, n(SIL)))
        o += '<circle cx="%s" cy="31.4" r="4.6" fill="%s" opacity=".55"/>' % (n(cx), _shift(BODY, -0.13))
    o += ('<circle cx="60" cy="51" r="30" fill="url(#d-%s)" stroke="%s" stroke-width="%s"/>'
          % (slug, P, n(SIL)))
    o += '<ellipse cx="53" cy="40" rx="20" ry="14" fill="url(#s-%s)"/>' % slug
    return o, '</g>'


# --------------------------------------------------------------------------- #
# the ten
# --------------------------------------------------------------------------- #

def sorry_quiet():
    """Not a gag. Head down, one tear, hands together."""
    s = 'sorry-quiet'
    a = arm('M43 92 q-3 -7 3 -10') + arm('M77 92 q3 -7 -3 -10')
    head, close = body(s, tilt=-4, arms=a)
    o = head
    for cx, inner in ((47, 1), (73, -1)):
        o += eye(cx, 53, 9.6, lid=.50, slug=s)
        o += brow(cx, 53 - 9.6 - 5.4, inner, 'worry', tilt=5.2)
    o += cheeks()
    o += mouth('wobble')
    o += tear(41, 57)
    return o + close


def looking_away():
    """Shame. Cannot meet your eye, and the head has turned with it."""
    s = 'looking-away'
    a = arm('M42 93 q-4 -6 -1 -9') + arm('M78 93 q4 -6 1 -9')
    head, close = body(s, tilt=9, arms=a)
    o = head
    for cx, inner in ((44, 1), (70, -1)):
        o += eye(cx, 54, 5.2, lid=0, slug=s)
        o += brow(cx, 54 - 5.2 - 5.4, inner, 'worry', tilt=4.0)
    o += cheeks(cy=63)
    o += mouth('flat')
    return o + close


def waiting():
    """Hesitant hope — hands held together, eyes up, mouth unsure."""
    s = 'waiting'
    a = arm('M45 93 q7 -5 14 -2') + arm('M75 93 q-7 -5 -14 -2')
    head, close = body(s, tilt=-2, arms=a)
    o = head
    for cx, inner in ((47, 1), (73, -1)):
        o += eye(cx, 52, 10.4, lid=.34, slug=s)
        o += brow(cx, 52 - 10.4 - 5.4, inner, 'worry', tilt=4.4)
    o += cheeks()
    o += mouth('press')
    return o + close


def hurt():
    """Actually hurt, not sulking. Arms wrapped around itself."""
    s = 'hurt'
    a = arm('M41 87 q6 9 18 7') + arm('M79 87 q-6 9 -18 7')
    head, close = body(s, tilt=4, arms=a)
    o = head
    for cx, inner in ((48, 1), (74, -1)):
        o += eye(cx, 53, 8.0, lid=.52, slug=s)
        o += brow(cx, 53 - 8.0 - 5.4, inner, 'worry', tilt=3.0)
    o += cheeks()
    o += mouth('press')
    return o + close


def hoping():
    """Looking up, eyes wide, the smallest possible smile."""
    s = 'hoping'
    a = arm('M43 92 q-4 -7 2 -10') + arm('M77 92 q4 -7 -2 -10')
    head, close = body(s, tilt=-3, arms=a)
    o = head
    for cx, inner in ((47, 1), (73, -1)):
        o += eye(cx, 51, 11.2, lid=.16, slug=s)
        o += brow(cx, 51 - 11.2 - 5.4, inner, 'raise')
    o += cheeks(cy=63)
    o += mouth('small')
    o += ('<path d="M92 34 l1.6 4.2 4.2 1.6 -4.2 1.6 -1.6 4.2 -1.6 -4.2 -4.2 -1.6 4.2 -1.6 z"'
          ' fill="#F2B880"/>')
    return o + close


def relief():
    """The breath out. Eyes closed, shoulders down."""
    s = 'relief'
    a = arm('M42 94 q-5 -4 -3 -8') + arm('M78 94 q5 -4 3 -8')
    head, close = body(s, tilt=-2, arms=a)
    o = head
    for cx in (47, 73):
        o += closed_eye(cx, 54, up=True)
    o += cheeks(cy=62)
    o += mouth('soft')
    o += ('<path d="M90 44 q5 -4 2 -9 q-3 -5 2 -9" stroke="#C9BEDE" stroke-width="2.6"'
          ' fill="none" stroke-linecap="round" opacity=".85"/>')
    return o + close


def reaching():
    """One hand out, tentative. The offer, before you know the answer."""
    s = 'reaching'
    a = arm('M43 93 q-4 -6 -1 -9') + arm('M74 88 q11 2 18 -4')
    head, close = body(s, tilt=-3, arms=a)
    o = head
    for cx, inner in ((47, 1), (73, -1)):
        o += eye(cx, 52, 10.0, lid=.30, slug=s)
        o += brow(cx, 52 - 10.0 - 5.4, inner, 'worry', tilt=4.0)
    o += cheeks()
    o += mouth('small')
    o += ('<circle cx="95" cy="79" r="7.0" fill="url(#d-%s)" stroke="%s" stroke-width="%s"/>'
          % (s, P, n(SIL)))
    return o + close


def listening():
    """Present, attentive, not performing. The "I'm here" sticker."""
    s = 'listening'
    a = arm('M43 93 q-4 -6 0 -9') + arm('M77 93 q4 -6 0 -9')
    head, close = body(s, tilt=6, arms=a)
    o = head
    for cx, inner in ((47, 1), (73, -1)):
        o += eye(cx, 53, 9.0, lid=.38, slug=s)
        o += brow(cx, 53 - 9.0 - 5.4, inner, 'raise')
    o += cheeks()
    o += mouth('soft')
    return o + close


def thank_you():
    """A small bow. Gratitude without a caption."""
    s = 'thank-you'
    a = arm('M46 94 q6 -4 13 -2') + arm('M74 94 q-6 -4 -13 -2')
    head, close = body(s, tilt=14, arms=a)
    o = head
    for cx in (47, 73):
        o += closed_eye(cx, 54, up=True)
    o += cheeks(cy=62)
    o += mouth('small')
    return o + close


def curled():
    """Curled up small. For the message that only says "today was hard"."""
    s = 'curled'
    o = defs(s) + shadow(60, 26, .12)
    o += ('<ellipse cx="60" cy="88" rx="30" ry="22" fill="url(#d-%s)" stroke="%s" stroke-width="%s"/>'
          % (s, P, n(SIL)))
    o += '<g transform="rotate(-10 60 58)">'
    for cx in (39, 83):
        o += ('<circle cx="%s" cy="38" r="9.6" fill="url(#d-%s)" stroke="%s" stroke-width="%s"/>'
              % (n(cx), s, P, n(SIL)))
    o += ('<circle cx="61" cy="56" r="27" fill="url(#d-%s)" stroke="%s" stroke-width="%s"/>'
          % (s, P, n(SIL)))
    o += '<ellipse cx="54" cy="46" rx="17" ry="12" fill="url(#s-%s)"/>' % s
    for cx in (50, 74):
        o += closed_eye(cx, 58, w=7.4, d=6.4, up=False)
    for cx in (40, 84):
        o += '<ellipse cx="%s" cy="66" rx="6.8" ry="4.2" fill="%s" opacity=".40"/>' % (n(cx), CHEEK)
    o += ('<path d="M56 70 q5 3.6 10 0" stroke="%s" stroke-width="2.8" fill="none"'
          ' stroke-linecap="round"/>' % P)
    o += '</g>'
    return o


POSES = {
    'sorry-quiet': sorry_quiet,
    'looking-away': looking_away,
    'waiting': waiting,
    'hurt': hurt,
    'hoping': hoping,
    'relief': relief,
    'reaching': reaching,
    'listening': listening,
    'thank-you': thank_you,
    'curled': curled,
}

LABELS = {
    'sorry-quiet': 'Quietly sorry',
    'looking-away': 'Can’t look at you',
    'waiting': 'Waiting',
    'hurt': 'That hurt',
    'hoping': 'Hoping',
    'relief': 'Relief',
    'reaching': 'Reaching out',
    'listening': 'I’m listening',
    'thank-you': 'Thank you',
    'curled': 'Small today',
}
