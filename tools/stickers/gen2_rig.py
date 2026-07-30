#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Truce sticker sample sheet #2 generator.

Pack A — "Rosie & Plum"      : two chubby heart characters (on-brand pack)
Pack B — "Clover & Biscuit"  : cream bunny + caramel cat

Same house style as the Momo & Pip sheet:
  * 120x120 viewBox, plum #3D2137 outlines at 4.2
  * limbs drawn with the double-stroke trick (dark wide stroke + fill stroke)
  * dot eyes with a big glint + a small secondary glint
  * blush ellipses, subtle looped animations, reduced-motion off-switch
"""

P = '#3D2137'          # house outline colour
CREAM = '#FFF7F2'
W = 4.2                # body outline weight


def n(v):
    return ('%.1f' % v).rstrip('0').rstrip('.') if isinstance(v, float) else str(v)


# ---------------------------------------------------------------------------
# primitives
# ---------------------------------------------------------------------------
def limb(d, fill, dark=15.0, inner=7.4):
    """Outlined stubby limb: wide dark stroke underneath, fill stroke on top."""
    return ('<path d="%s" stroke="%s" stroke-width="%s" stroke-linecap="round" fill="none"/>'
            '<path d="%s" stroke="%s" stroke-width="%s" stroke-linecap="round" fill="none"/>'
            % (d, P, n(dark), d, fill, n(inner)))


def hand(cx, cy, fill, rx=6.6, ry=5.7, rot=0, sw=3.4):
    return ('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s" stroke="%s" stroke-width="%s"'
            ' transform="rotate(%s %s %s)"/>' % (n(cx), n(cy), n(rx), n(ry), fill, P, n(sw), n(rot), n(cx), n(cy)))


def dot_eye(cx, cy, r=5.6, ry=None, glint=True):
    ry = ry if ry is not None else r * 1.14
    s = '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"/>' % (n(cx), n(cy), n(r), n(ry), P)
    if glint:
        s += '<circle cx="%s" cy="%s" r="%s" fill="#FFFFFF"/>' % (n(cx - r * .34), n(cy - ry * .34), n(r * .40))
        s += ('<circle cx="%s" cy="%s" r="%s" fill="#FFFFFF" opacity="0.9"/>'
              % (n(cx + r * .30), n(cy + ry * .32), n(r * .21)))
    return s


def arc_eye(cx, cy, w=9.0, d=6.4, up=True):
    """Happy ∩ eye (up=True) or sad ∪ eye."""
    return ('<path d="M%s %s q%s %s %s 0" stroke="%s" stroke-width="3.4" fill="none" stroke-linecap="round"/>'
            % (n(cx - w / 2), n(cy), n(w / 2), n(-d if up else d), n(w), P))


def squeeze_eye(cx, cy, w=9.0, d=5.4):
    """Scrunched-shut crying eye — a sharp ∧."""
    return ('<path d="M%s %s L%s %s L%s %s" stroke="%s" stroke-width="3.4" fill="none"'
            ' stroke-linecap="round" stroke-linejoin="round"/>'
            % (n(cx - w / 2), n(cy + d / 2), n(cx), n(cy - d / 2), n(cx + w / 2), n(cy + d / 2), P))


def flat_eye(cx, cy, w=9.0):
    return ('<path d="M%s %s h%s" stroke="%s" stroke-width="3.4" fill="none" stroke-linecap="round"/>'
            % (n(cx - w / 2), n(cy), n(w), P))


def brow(cx, cy, w=9.0, tilt=-4.0):
    return ('<path d="M%s %s L%s %s" stroke="%s" stroke-width="3.2" fill="none" stroke-linecap="round"/>'
            % (n(cx - w / 2), n(cy - tilt / 2), n(cx + w / 2), n(cy + tilt / 2), P))


def blush(cx, cy, rx=6.4, ry=4.4, c='#FF9FB0', op=.85):
    return ('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s" opacity="%s"/>'
            % (n(cx), n(cy), n(rx), n(ry), c, op))


def smile(cx, cy, w=8.0, d=5.0, sw=3.4):
    return ('<path d="M%s %s q%s %s %s 0" stroke="%s" stroke-width="%s" fill="none" stroke-linecap="round"/>'
            % (n(cx - w / 2), n(cy), n(w / 2), n(d), n(w), P, n(sw)))


def frown(cx, cy, w=8.0, d=5.0, sw=3.4):
    return ('<path d="M%s %s q%s %s %s 0" stroke="%s" stroke-width="%s" fill="none" stroke-linecap="round"/>'
            % (n(cx - w / 2), n(cy), n(w / 2), n(-d), n(w), P, n(sw)))


def wobble_mouth(cx, cy, w=11.0, sw=3.2):
    q = w / 4.0
    return ('<path d="M%s %s q%s -2.2 %s 0 q%s 2.2 %s 0 q%s -2.2 %s 0 q%s 2.2 %s 0"'
            ' stroke="%s" stroke-width="%s" fill="none" stroke-linecap="round"/>'
            % (n(cx - w / 2), n(cy), n(q / 2), n(q), n(q / 2), n(q), n(q / 2), n(q), n(q / 2), n(q), P, n(sw)))


def pout_mouth(cx, cy, w=13.0, sw=3.6):
    h = w / 2
    return ('<path d="M%s %s q%s -5.4 %s 0 q%s 5.4 %s 0" stroke="%s" stroke-width="%s"'
            ' fill="none" stroke-linecap="round"/>'
            % (n(cx - w / 2), n(cy), n(h / 2), n(h), n(h / 2), n(h), P, n(sw)))


def open_mouth(cx, cy, rx=5.0, ry=6.2, c='#7A2E44'):
    return ('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s" stroke="%s" stroke-width="3"/>'
            % (n(cx), n(cy), n(rx), n(ry), c, P))


def kiss_mouth(cx, cy, rx=3.6, ry=4.4, c='#7A2E44'):
    return ('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s" stroke="%s" stroke-width="3"/>'
            % (n(cx), n(cy), n(rx), n(ry), c, P))


def heart_glyph(cx, cy, s=1.0, fill='#E85D75', sw=3.2):
    """Small floating heart, drawn around (cx,cy)."""
    return ('<path d="M%s %sc%s %s %s %s %s %sc%s %s %s %s %s %sc%s %s %s %s %s %sZ"'
            ' fill="%s" stroke="%s" stroke-width="%s" stroke-linejoin="round"/>'
            % (n(cx), n(cy + 5.0 * s),
               n(-4.4 * s), n(-3.0 * s), n(-5.9 * s), n(-5.9 * s), n(-4.0 * s), n(-7.6 * s),
               n(-1.5 * s), n(-1.3 * s), n(-3.1 * s), n(-0.4 * s), n(-4.0 * s), n(0.9 * s),
               n(-0.9 * s), n(-1.3 * s), n(-2.5 * s), n(-2.2 * s), n(-4.0 * s), n(-0.9 * s),
               fill, P, n(sw))).replace('c-', 'c -').replace(' -', ' -')


def heart_sym(cx, cy, s=1.0, fill='#E85D75', sw=3.2):
    """Symmetric small heart (cleaner than heart_glyph for tips/decor)."""
    w, h = 11.0 * s, 10.0 * s
    return ('<path d="%s" fill="%s" stroke="%s" stroke-width="%s" stroke-linejoin="round"/>'
            % (heart_path(cx, cy, w, h), fill, P, n(sw)))


def sparkle(cx, cy, r=4.0, c='#F2B880', op=1.0):
    return ('<path d="M%s %s q%s %s %s %s q%s %s %s %s q%s %s %s %s q%s %s %s %sZ"'
            ' fill="%s" opacity="%s"/>'
            % (n(cx), n(cy - r),
               n(r * .18), n(r * .62), n(r), n(r), n(-r * .62), n(r * .18), n(-r), n(r),
               n(-r * .18), n(-r * .62), n(-r), n(-r), n(r * .62), n(-r * .18), n(r), n(-r),
               c, n(op)))


def teardrop(cx, cy, s=1.0, c='#BFD6F5'):
    return ('<path d="M%s %s c%s %s %s %s %s %s c0 %s %s %s %s %s c%s %s %s %s %s %sZ"'
            ' fill="%s" stroke="%s" stroke-width="2.6" stroke-linejoin="round"/>'
            % (n(cx), n(cy - 6 * s),
               n(2.6 * s), n(3.4 * s), n(4.4 * s), n(5.4 * s), n(4.4 * s), n(7.6 * s),
               n(2.6 * s), n(-2.0 * s), n(4.4 * s), n(-4.4 * s), n(4.4 * s),
               n(-2.6 * s), n(0), n(-4.4 * s), n(-2.2 * s), n(-4.4 * s), n(-4.4 * s),
               c, P))


def stream(x, y, h=22.0, w=6.0, c='#BFD6F5'):
    """Waterfall tear stream."""
    return ('<path d="M%s %s v%s" stroke="%s" stroke-width="%s" stroke-linecap="round" opacity=".95"/>'
            % (n(x), n(y), n(h), c, n(w)))


def cloud(cx, cy, s=1.0, c='#D5CDE6'):
    return ('<path d="M%s %sa%s %s 0 0 1 %s %s %s %s 0 0 1 %s %s %s %s 0 0 1 %s %sH%s a%s %s 0 0 1 %s %sZ"'
            ' fill="%s" stroke="%s" stroke-width="4.2" stroke-linejoin="round"/>'
            % (n(cx - 13 * s), n(cy),
               n(10 * s), n(10 * s), n(17 * s), n(-5 * s),
               n(9.5 * s), n(9.5 * s), n(15 * s), n(4 * s),
               n(8.5 * s), n(8.5 * s), n(-2 * s), n(16 * s),
               n(cx - 9 * s), n(9 * s), n(9 * s), n(-4 * s), n(-15 * s),
               c, P))


def rain(x, y, h=8.0):
    return '<path d="M%s %s v%s" stroke="#BFD6F5" stroke-width="4.6" stroke-linecap="round"/>' % (n(x), n(y), n(h))


def steam(d, sw=5.4):
    return ('<path d="%s" stroke="#D5CDE6" stroke-width="%s" stroke-linecap="round" fill="none"/>'
            % (d, n(sw)))



def paw(cx, cy, fill, inner, rot=-26, rx=10.5, ry=6.6):
    """Flat pat-paw with toe beans — reads far better than a round hand on a head."""
    return ('<g transform="rotate(%s %s %s)">'
            '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s" stroke="%s" stroke-width="4.2"/>'
            '<circle cx="%s" cy="%s" r="1.9" fill="%s"/>'
            '<circle cx="%s" cy="%s" r="1.9" fill="%s"/>'
            '<circle cx="%s" cy="%s" r="1.9" fill="%s"/></g>'
            % (n(rot), n(cx), n(cy), n(cx), n(cy), n(rx), n(ry), fill, P,
               n(cx - rx * .57), n(cy + ry * .45), inner,
               n(cx), n(cy + ry * .58), inner,
               n(cx + rx * .57), n(cy + ry * .45), inner))


def open_smile(cx, cy, w=12.0, d=8.0):
    """Big happy open mouth (the made-up / cheering mouth)."""
    return ('<path d="M%s %s q%s -2.6 %s 0 q%s %s %s %s q%s 0 %s %sZ"'
            ' fill="#7A2E44" stroke="%s" stroke-width="3.2" stroke-linejoin="round"/>'
            % (n(cx - w / 2), n(cy), n(w / 2), n(w),
               n(-w * .10), n(d), n(-w / 2), n(d),
               n(-w * .40), n(-w / 2), n(-d), P))


def g(cls, inner, tf=None):
    t = ' transform="%s"' % tf if tf else ''
    c = ' class="%s"' % cls if cls else ''
    return '<g%s%s>%s</g>' % (c, t, inner)


# ---------------------------------------------------------------------------
# heart character rig  (Rosie & Plum)
# ---------------------------------------------------------------------------
def heart_path(cx, cy, w, h):
    """Classic heart, centred on (cx,cy); bottom tip at cy + 0.52h."""
    X = lambda t: cx + w * t
    Y = lambda t: cy + h * t
    return ('M%s %s C%s %s %s %s %s %s C%s %s %s %s %s %s C%s %s %s %s %s %s '
            'C%s %s %s %s %s %s C%s %s %s %s %s %s C%s %s %s %s %s %s Z'
            % (n(X(0)), n(Y(.52)),
               n(X(-.30)), n(Y(.22)), n(X(-.53)), n(Y(-.02)), n(X(-.53)), n(Y(-.22)),
               n(X(-.53)), n(Y(-.46)), n(X(-.26)), n(Y(-.57)), n(X(-.13)), n(Y(-.38)),
               n(X(-.07)), n(Y(-.30)), n(X(-.03)), n(Y(-.26)), n(X(0)), n(Y(-.23)),
               n(X(.03)), n(Y(-.26)), n(X(.07)), n(Y(-.30)), n(X(.13)), n(Y(-.38)),
               n(X(.26)), n(Y(-.57)), n(X(.53)), n(Y(-.46)), n(X(.53)), n(Y(-.22)),
               n(X(.53)), n(Y(-.02)), n(X(.30)), n(Y(.22)), n(X(0)), n(Y(.52))))


class Heart:
    """A chubby heart character. All face parts are placed off the body box."""

    def __init__(self, cx, cy, s, fill, panel, limbf, blushc):
        self.cx, self.cy = cx, cy
        self.w, self.h = 46.0 * s, 44.0 * s
        self.s = s
        self.fill, self.panel, self.limbf, self.blushc = fill, panel, limbf, blushc

    # -- anchors ---------------------------------------------------------
    @property
    def eye_y(self):
        return self.cy - .115 * self.h

    @property
    def eye_dx(self):
        return .145 * self.w

    @property
    def mouth_y(self):
        return self.cy + .055 * self.h

    @property
    def tip_y(self):
        return self.cy + .52 * self.h

    def shoulder(self, side):
        # deliberately low: on a heart the widest point is at the top, so arms
        # attached up there read as ears. Hang them off the tapering flank.
        return (self.cx + side * .40 * self.w, self.cy + .12 * self.h)

    def lobe(self, side):
        """Upper lobe centre — the heart's 'cheek'."""
        return (self.cx + side * .27 * self.w, self.cy - .30 * self.h)

    # -- parts -----------------------------------------------------------
    def feet(self):
        fy = self.cy + .50 * self.h
        return ''.join(
            '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s" stroke="%s" stroke-width="%s"/>'
            % (n(self.cx + sd * .25 * self.w), n(fy), n(.17 * self.w), n(.11 * self.h),
               self.limbf, P, n(W))
            for sd in (-1, 1))

    def body(self):
        s = '<path d="%s" fill="%s" stroke="%s" stroke-width="%s" stroke-linejoin="round"/>' % (
            heart_path(self.cx, self.cy, self.w, self.h), self.fill, P, n(W))
        # lighter inner face panel so eyes + blush read on the dark fills
        s += '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"/>' % (
            n(self.cx), n(self.cy - .085 * self.h), n(.325 * self.w), n(.275 * self.h), self.panel)
        return s

    def face(self, eyes='dot', mouth='smile', brows=None, blush_on=True, extra=''):
        lx, rx, ey = self.cx - self.eye_dx, self.cx + self.eye_dx, self.eye_y
        er = .108 * self.w
        out = ''
        if brows:
            by = ey - er * 1.9
            out += brow(lx, by, er * 1.9, brows) + brow(rx, by, er * 1.9, -brows)
        if eyes == 'dot':
            out += dot_eye(lx, ey, er) + dot_eye(rx, ey, er)
        elif eyes == 'sparkle':
            out += dot_eye(lx, ey, er * 1.22) + dot_eye(rx, ey, er * 1.22)
        elif eyes == 'wide':
            out += dot_eye(lx, ey, er * 1.34) + dot_eye(rx, ey, er * 1.34)
        elif eyes == 'happy':
            out += arc_eye(lx, ey, er * 2.0, er * 1.4, True) + arc_eye(rx, ey, er * 2.0, er * 1.4, True)
        elif eyes == 'sad':
            out += arc_eye(lx, ey + er * .5, er * 2.0, er * 1.3, False) + \
                   arc_eye(rx, ey + er * .5, er * 2.0, er * 1.3, False)
        elif eyes == 'squeeze':
            out += squeeze_eye(lx, ey, er * 2.1, er * 1.3) + squeeze_eye(rx, ey, er * 2.1, er * 1.3)
        elif eyes == 'flat':
            out += flat_eye(lx, ey, er * 1.9) + flat_eye(rx, ey, er * 1.9)
        elif eyes == 'side':
            out += dot_eye(lx + er * .5, ey, er) + dot_eye(rx + er * .5, ey, er)

        my = self.mouth_y
        if mouth == 'smile':
            out += smile(self.cx, my, .19 * self.w, .11 * self.h)
        elif mouth == 'grin':
            out += open_smile(self.cx, my - .03 * self.h, .26 * self.w, .17 * self.h)
        elif mouth == 'wobble':
            out += wobble_mouth(self.cx, my, .26 * self.w)
        elif mouth == 'pout':
            out += pout_mouth(self.cx, my, .29 * self.w)
        elif mouth == 'cry':
            out += open_mouth(self.cx, my + .02 * self.h, .11 * self.w, .14 * self.h)
        elif mouth == 'kiss':
            out += kiss_mouth(self.cx, my, .085 * self.w, .10 * self.h)
        elif mouth == 'flat':
            out += flat_eye(self.cx, my, .17 * self.w)
        elif mouth == 'frown':
            out += frown(self.cx, my + .03 * self.h, .19 * self.w, .10 * self.h)

        if blush_on:
            out += blush(self.cx - .255 * self.w, self.cy + .005 * self.h,
                         .088 * self.w, .062 * self.h, self.blushc)
            out += blush(self.cx + .255 * self.w, self.cy + .005 * self.h,
                         .088 * self.w, .062 * self.h, self.blushc)
        return out + extra

    def whole(self, **kw):
        return self.feet() + self.body() + self.face(**kw)


def rosie(cx, cy, s=1.0):
    return Heart(cx, cy, s, '#E85D75', '#FFDFE6', '#F1798D', '#FF8FA6')


def plum(cx, cy, s=1.12):
    return Heart(cx, cy, s, '#6B3A5F', '#F0DDEB', '#B98BB0', '#D98CBE')


# ---------------------------------------------------------------------------
# bunny + cat rig  (Clover & Biscuit)
# ---------------------------------------------------------------------------
CLOVER_F, CLOVER_IN = '#FFF1E2', '#F6D9BE'
BISCUIT_F, BISCUIT_IN, BISCUIT_MUZZLE = '#E8A854', '#F0B9A6', '#F7D3A8'


class Clover:
    """Cream bunny. Pip's rig, softened: rounder cheeks + one folded ear tip."""

    def __init__(self, cx, cy, r=21.0):
        self.cx, self.cy, self.r = cx, cy, r
        self.fill, self.inner = CLOVER_F, CLOVER_IN

    def ears(self, spread=1.0, droop=0.0):
        r = self.r
        out = ''
        for sd in (-1, 1):
            bx = self.cx + sd * r * .64
            by = self.cy - r * .74
            tipx = self.cx + sd * (r * 1.05 + spread * 8) + sd * droop * 6
            tipy = self.cy - r * 1.95 + droop * 16
            midx = self.cx + sd * (r * .40)
            midy = self.cy - r * 2.05 + droop * 10
            d = 'M%s %sC%s %s %s %s %s %s' % (n(bx), n(by), n(bx + sd * r * .05), n(by - r * .70),
                                              n(midx + sd * r * .55), n(midy), n(tipx), n(tipy))
            out += limb(d, self.fill, 17.8, 9.4)
            # inner ear
            out += ('<path d="M%s %sL%s %s" stroke="%s" stroke-width="4" stroke-linecap="round" fill="none"/>'
                    % (n(bx), n(by - r * .04), n(bx + sd * r * .12), n(by - r * .62), self.inner))
            if sd == 1:      # Clover's signature: the right ear tip flops over
                out += ('<path d="M%s %s c%s %s %s %s %s %s" stroke="%s" stroke-width="17.8"'
                        ' stroke-linecap="round" fill="none"/>'
                        % (n(tipx), n(tipy), n(-3.0), n(-3.0), n(-7.5), n(-1.5), n(-7.5), n(3.5), P))
                out += ('<path d="M%s %s c%s %s %s %s %s %s" stroke="%s" stroke-width="9.4"'
                        ' stroke-linecap="round" fill="none"/>'
                        % (n(tipx), n(tipy), n(-3.0), n(-3.0), n(-7.5), n(-1.5), n(-7.5), n(3.5), self.fill))
        return out

    def head(self):
        s = '<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (
            n(self.cx), n(self.cy), n(self.r), self.fill, P, n(W))
        # rounder cheeks
        for sd in (-1, 1):
            s += ('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s" stroke="%s" stroke-width="%s"/>'
                  % (n(self.cx + sd * self.r * .86), n(self.cy + self.r * .30),
                     n(self.r * .34), n(self.r * .31), self.fill, P, n(W)))
        return s

    def face(self, eyes='dot', mouth='smile', blush_on=True, brows=None, extra=''):
        r = self.r
        lx, rx, ey = self.cx - r * .40, self.cx + r * .40, self.cy + r * .02
        er = r * .26
        out = ''
        if brows:
            out += brow(lx, ey - er * 2.2, er * 2.0, brows) + brow(rx, ey - er * 2.2, er * 2.0, -brows)
        if eyes == 'dot':
            out += dot_eye(lx, ey, er) + dot_eye(rx, ey, er)
        elif eyes == 'wide':
            out += dot_eye(lx, ey, er * 1.25) + dot_eye(rx, ey, er * 1.25)
        elif eyes == 'happy':
            out += arc_eye(lx, ey, er * 2.0, er * 1.5) + arc_eye(rx, ey, er * 2.0, er * 1.5)
        elif eyes == 'squeeze':
            out += squeeze_eye(lx, ey, er * 2.2, er * 1.4) + squeeze_eye(rx, ey, er * 2.2, er * 1.4)
        elif eyes == 'sad':
            out += arc_eye(lx, ey + er * .4, er * 2.0, er * 1.3, False) + \
                   arc_eye(rx, ey + er * .4, er * 2.0, er * 1.3, False)
        elif eyes == 'flat':
            out += flat_eye(lx, ey, er * 1.9) + flat_eye(rx, ey, er * 1.9)

        my = self.cy + r * .44
        out += ('<path d="M%s %s q%s -2.4 %s 0 q%s 3.2 %s 3.2 q%s 0 %s -3.2Z" fill="#E85D75"/>'
                % (n(self.cx - r * .13), n(my - r * .22), n(r * .065), n(r * .26),
                   n(r * .065), n(r * .13), n(r * .065), n(r * .13)))
        if mouth == 'smile':
            out += ('<path d="M%s %sv1.8M%s %sq-2.8 2.6 -4.4 0M%s %sq2.8 2.6 4.4 0"'
                    ' stroke="%s" stroke-width="2.8" fill="none" stroke-linecap="round"/>'
                    % (n(self.cx), n(my + r * .07), n(self.cx), n(my + r * .16),
                       n(self.cx), n(my + r * .16), P))
        elif mouth == 'wobble':
            out += wobble_mouth(self.cx, my + r * .22, r * .52)
        elif mouth == 'cry':
            out += open_mouth(self.cx, my + r * .28, r * .22, r * .27)
        elif mouth == 'pout':
            out += pout_mouth(self.cx, my + r * .20, r * .58)
        elif mouth == 'kiss':
            out += kiss_mouth(self.cx, my + r * .22, r * .17, r * .21)
        elif mouth == 'flat':
            out += flat_eye(self.cx, my + r * .22, r * .34)
        elif mouth == 'grin':
            out += open_smile(self.cx, my - r * .02, r * .60, r * .40)

        if blush_on:
            out += blush(self.cx - r * .84, self.cy + r * .34, r * .30, r * .21)
            out += blush(self.cx + r * .84, self.cy + r * .34, r * .30, r * .21)
        return out + extra

    def whole(self, spread=1.0, droop=0.0, **kw):
        return self.ears(spread, droop) + self.head() + self.face(**kw)


class Biscuit:
    """Caramel cat. Triangle ears, tiny fang, and a tail that acts."""

    def __init__(self, cx, cy, r=21.0):
        self.cx, self.cy, self.r = cx, cy, r
        self.fill, self.inner = BISCUIT_F, BISCUIT_IN

    def ears(self, back=0.0):
        r, out = self.r, ''
        for sd in (-1, 1):
            bx1 = self.cx + sd * r * .34
            bx2 = self.cx + sd * r * .96
            by = self.cy - r * .80
            tipx = self.cx + sd * (r * .78 + back * r * .55)
            tipy = self.cy - r * (1.72 - back * .42)
            out += ('<path d="M%s %s L%s %s L%s %s Z" fill="%s" stroke="%s" stroke-width="%s"'
                    ' stroke-linejoin="round"/>'
                    % (n(bx1), n(by), n(tipx), n(tipy), n(bx2), n(by - r * .12), self.fill, P, n(W)))
            out += ('<path d="M%s %s L%s %s L%s %s Z" fill="%s"/>'
                    % (n(bx1 + sd * r * .12), n(by - r * .06), n(tipx), n(tipy + r * .30),
                       n(bx2 - sd * r * .10), n(by - r * .14), self.inner))
        return out

    def head(self):
        return '<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (
            n(self.cx), n(self.cy), n(self.r), self.fill, P, n(W))

    def face(self, eyes='dot', mouth='smile', blush_on=True, brows=None, whisk=True, extra=''):
        r = self.r
        lx, rx, ey = self.cx - r * .40, self.cx + r * .40, self.cy - r * .04
        er = r * .26
        out = ''
        # muzzle patch keeps the nose/mouth readable on caramel
        out += '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"/>' % (
            n(self.cx), n(self.cy + r * .46), n(r * .52), n(r * .36), BISCUIT_MUZZLE)
        if brows:
            out += brow(lx, ey - er * 2.2, er * 2.0, brows) + brow(rx, ey - er * 2.2, er * 2.0, -brows)
        if eyes == 'dot':
            out += dot_eye(lx, ey, er) + dot_eye(rx, ey, er)
        elif eyes == 'wide':
            out += dot_eye(lx, ey, er * 1.25) + dot_eye(rx, ey, er * 1.25)
        elif eyes == 'happy':
            out += arc_eye(lx, ey, er * 2.0, er * 1.5) + arc_eye(rx, ey, er * 2.0, er * 1.5)
        elif eyes == 'squeeze':
            out += squeeze_eye(lx, ey, er * 2.2, er * 1.4) + squeeze_eye(rx, ey, er * 2.2, er * 1.4)
        elif eyes == 'sad':
            out += arc_eye(lx, ey + er * .4, er * 2.0, er * 1.3, False) + \
                   arc_eye(rx, ey + er * .4, er * 2.0, er * 1.3, False)
        elif eyes == 'flat':
            out += flat_eye(lx, ey, er * 1.9) + flat_eye(rx, ey, er * 1.9)

        ny = self.cy + r * .30
        out += ('<path d="M%s %s q%s -2.6 %s 0 q%s 3.4 %s 3.4 q%s 0 %s -3.4Z" fill="#E85D75"/>'
                % (n(self.cx - r * .14), n(ny), n(r * .07), n(r * .28), n(r * .07), n(r * .14),
                   n(r * .07), n(r * .14)))
        my = ny + r * .20
        if mouth == 'grin':
            out += open_smile(self.cx, my - r * .06, r * .60, r * .40)
        elif mouth == 'smile':
            out += ('<path d="M%s %sq-3.0 3.0 -5.0 0M%s %sq3.0 3.0 5.0 0"'
                    ' stroke="%s" stroke-width="2.8" fill="none" stroke-linecap="round"/>'
                    % (n(self.cx), n(my), n(self.cx), n(my), P))
            # the tiny fang
            out += ('<path d="M%s %s l2.6 0 l-1.3 3.4 Z" fill="#FFFFFF" stroke="%s"'
                    ' stroke-width="1.2" stroke-linejoin="round"/>'
                    % (n(self.cx + r * .10), n(my + .4), P))
        elif mouth == 'wobble':
            out += wobble_mouth(self.cx, my + r * .10, r * .52)
        elif mouth == 'cry':
            out += open_mouth(self.cx, my + r * .18, r * .22, r * .27)
        elif mouth == 'pout':
            out += pout_mouth(self.cx, my + r * .06, r * .58)
        elif mouth == 'kiss':
            out += kiss_mouth(self.cx, my + r * .10, r * .17, r * .21)
        elif mouth == 'flat':
            out += flat_eye(self.cx, my + r * .10, r * .34)

        if whisk:
            for sd in (-1, 1):
                x0 = self.cx + sd * r * .52
                for i, dy in enumerate((-3.2, 0.4, 4.0)):
                    out += ('<path d="M%s %s L%s %s" stroke="%s" stroke-width="1.8"'
                            ' stroke-linecap="round" opacity=".5"/>'
                            % (n(x0), n(self.cy + r * .34 + dy * .55),
                               n(x0 + sd * r * .62), n(self.cy + r * .34 + dy), P))
        if blush_on:
            out += blush(self.cx - r * .74, self.cy + r * .30, r * .30, r * .21, '#F2748C', .75)
            out += blush(self.cx + r * .74, self.cy + r * .30, r * .30, r * .21, '#F2748C', .75)
        return out + extra

    def whole(self, back=0.0, **kw):
        return self.ears(back) + self.head() + self.face(**kw)


def cat_tail(x, y, kind='curl', fill=BISCUIT_F):
    """Tail that participates in the emotion. Anchored at the body's flank."""
    dark, inner = 13.6, 6.8
    if kind == 'curl':
        d = 'M%s %s c9 1 14 -5 12 -12 c-1.4 -5 -7.5 -5.6 -9 -1' % (n(x), n(y))
    elif kind == 'up':
        d = 'M%s %s c10 -2 13 -10 10 -17 c-1.6 -3.8 -6.6 -4 -8 0' % (n(x), n(y))
    elif kind == 'droop':
        d = 'M%s %s c9 3 12 8 10 14' % (n(x), n(y))
    elif kind == 'puff':
        d = 'M%s %s c11 -1 16 -7 14 -14' % (n(x), n(y))
    elif kind == 'heart':
        d = 'M%s %s c10 0 14 -5 13 -10' % (n(x), n(y))
    elif kind == 'hook':
        d = 'M%s %s c9 2 13 -3 11 -9' % (n(x), n(y))
    else:
        d = 'M%s %s c9 1 13 -4 11 -10' % (n(x), n(y))

    if kind == 'puff':
        out = limb(d, fill, dark + 7.0, inner + 7.0)
        # frazzled spikes
        out += ('<path d="M%s %s l4 -5 M%s %s l6 -1 M%s %s l3 6"'
                ' stroke="%s" stroke-width="3.2" stroke-linecap="round" fill="none"/>'
                % (n(x + 8), n(y - 12), n(x + 13), n(y - 6), n(x + 6), n(y - 15), P))
        return out
    out = limb(d, fill, dark, inner)
    if kind == 'heart':
        out += heart_sym(x + 15.5, y - 13.0, .82, '#E85D75')
    return out
