#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Truce sticker sample sheet #3 — the CUTER rig.

Pack C — "Mochi & Bao"      : panda couple (original designs)
Pack D — "Poppy & Truffle"  : pig couple

Same house DNA as sheets 1-2 (plum #3D2137 ink, 120x120 viewBox, double-stroke
limbs, blush, subtle loops) but re-proportioned to the cuteness brief:

  * head is ~55-60% of the whole character height and WIDER than the body
  * body is a small pear/bean tucked under the head; limbs are tiny stubs
  * eyes are much larger, sat low and wide, always with a big + small glint
  * outline weight stays at the house 4.2, so it reads thinner on bigger shapes
  * generous blush, tiny mouths, more squash-and-stretch in every pose
"""

from gen2_rig import *        # noqa  — primitives, palette, limb/hand/blush/etc.

# ---------------------------------------------------------------------------
# palette
# ---------------------------------------------------------------------------
MOCHI_F, MOCHI_PATCH = '#FFFDFC', '#3D2137'      # white panda + plum-black patches
BAO_F, BAO_PATCH, BAO_EAR = '#FBEEDF', '#3D2137', '#FFC9D6'   # cream panda, rose inner ears
POPPY_F, POPPY_SNOUT = '#F5A8B8', '#FFCFD9'
TRUFFLE_F, TRUFFLE_SNOUT = '#D98CA0', '#F0B6C4'

SCLERA = '#FFF7F2'


# ---------------------------------------------------------------------------
# cuter eye + mouth primitives
# ---------------------------------------------------------------------------
def gloss_eye(cx, cy, er, on_dark=False):
    """Big glossy eye. On a dark panda patch it gets a cream sclera so the
    pupil and glints still read at 72px."""
    out = ''
    if on_dark:
        out += '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"/>' % (
            n(cx), n(cy), n(er * 1.02), n(er * 1.16), SCLERA)
        px, py, pr, pry = cx, cy + er * .06, er * .70, er * .80
    else:
        px, py, pr, pry = cx, cy, er, er * 1.14
    out += '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"/>' % (n(px), n(py), n(pr), n(pry), P)
    # double glint: a big one up-left, a small one down-right
    out += '<circle cx="%s" cy="%s" r="%s" fill="#FFFFFF"/>' % (
        n(px - pr * .34), n(py - pry * .36), n(pr * .46))
    out += '<circle cx="%s" cy="%s" r="%s" fill="#FFFFFF" opacity=".92"/>' % (
        n(px + pr * .34), n(py + pry * .30), n(pr * .24))
    return out


def arc_c(cx, cy, w=9.0, d=6.4, up=True, c=P, sw=3.6):
    return ('<path d="M%s %s q%s %s %s 0" stroke="%s" stroke-width="%s" fill="none" stroke-linecap="round"/>'
            % (n(cx - w / 2), n(cy), n(w / 2), n(-d if up else d), n(w), c, n(sw)))


def squeeze_c(cx, cy, w=9.0, d=5.4, c=P, sw=3.6):
    return ('<path d="M%s %s L%s %s L%s %s" stroke="%s" stroke-width="%s" fill="none"'
            ' stroke-linecap="round" stroke-linejoin="round"/>'
            % (n(cx - w / 2), n(cy + d / 2), n(cx), n(cy - d / 2), n(cx + w / 2), n(cy + d / 2), c, n(sw)))


def flat_c(cx, cy, w=9.0, c=P, sw=3.6):
    return ('<path d="M%s %s h%s" stroke="%s" stroke-width="%s" fill="none" stroke-linecap="round"/>'
            % (n(cx - w / 2), n(cy), n(w), c, n(sw)))


def tiny_smile(cx, cy, w, d, sw=3.2):
    return smile(cx, cy, w, d, sw)


def cat_nose(cx, cy, w, c='#E85D75'):
    """Small rounded nose used by the pandas."""
    return ('<path d="M%s %s q%s -2.4 %s 0 q%s %s %s %s q%s 0 %s %sZ" fill="%s"/>'
            % (n(cx - w / 2), n(cy), n(w / 2), n(w), n(-w * .10), n(w * .78), n(-w / 2), n(w * .78),
               n(-w * .40), n(-w / 2), n(-w * .78), c))


# ---------------------------------------------------------------------------
# shared cute base
# ---------------------------------------------------------------------------
class Cutie:
    """Chibi proportions: head wider than the body, everything derived from r."""

    fill = '#FFFFFF'
    blushc = '#FF9FB0'
    blush_op = .9
    limbf = '#FFFFFF'
    dark_eyes = False        # True when eyes sit on a dark patch
    eye_k = 1.0              # per-species eye scale

    def __init__(self, cx, cy, r=27.0):
        self.cx, self.cy, self.r = cx, cy, r

    # -- anchors ---------------------------------------------------------
    @property
    def er(self):
        return self.r * .30 * self.eye_k     # eye radius — deliberately huge

    @property
    def eye_y(self):
        return self.cy + self.r * .09   # low on the face = baby proportions

    @property
    def eye_dx(self):
        return self.r * .45             # and wide apart

    @property
    def mouth_y(self):
        return self.cy + self.r * .60

    def head_top(self):
        return self.cy - self.r

    def cheek(self, side):
        return (self.cx + side * self.r * .70, self.cy + self.r * .52)

    def body_box(self):
        """(cx, cy, rx, ry) of the little bean body."""
        return (self.cx, self.cy + self.r * 1.42, self.r * .80, self.r * .92)

    def shoulder(self, side):
        bx, by, brx, bry = self.body_box()
        return (bx + side * brx * .86, by - bry * .30)

    # -- parts -----------------------------------------------------------
    def body(self, tilt=0.0):
        bx, by, brx, bry = self.body_box()
        s = ('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s" stroke="%s" stroke-width="%s"/>'
             % (n(bx), n(by), n(brx), n(bry), self.fill, P, n(W)))
        if tilt:
            s = '<g transform="rotate(%s %s %s)">%s</g>' % (n(tilt), n(bx), n(by), s)
        return s

    def feet(self):
        bx, by, brx, bry = self.body_box()
        fy = by + bry * .86
        return ''.join(
            '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s" stroke="%s" stroke-width="%s"/>'
            % (n(bx + sd * brx * .50), n(fy), n(brx * .34), n(bry * .22), self.limbf, P, n(W))
            for sd in (-1, 1))

    def head(self):
        return '<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (
            n(self.cx), n(self.cy), n(self.r), self.fill, P, n(W))

    def eyes(self, kind='dot'):
        lx, rx = self.cx - self.eye_dx, self.cx + self.eye_dx
        ey, er = self.eye_y, self.er
        c = SCLERA if self.dark_eyes else P
        if kind in ('dot', 'wide', 'sparkle'):
            k = {'dot': 1.0, 'wide': 1.16, 'sparkle': 1.24}[kind]
            return gloss_eye(lx, ey, er * k, self.dark_eyes) + gloss_eye(rx, ey, er * k, self.dark_eyes)
        if kind == 'happy':
            return arc_c(lx, ey, er * 2.0, er * 1.5, True, c) + arc_c(rx, ey, er * 2.0, er * 1.5, True, c)
        if kind == 'sad':
            return arc_c(lx, ey + er * .35, er * 2.0, er * 1.3, False, c) + \
                   arc_c(rx, ey + er * .35, er * 2.0, er * 1.3, False, c)
        if kind == 'squeeze':
            return squeeze_c(lx, ey, er * 2.1, er * 1.4, c) + squeeze_c(rx, ey, er * 2.1, er * 1.4, c)
        if kind == 'flat':
            return flat_c(lx, ey, er * 1.8, c) + flat_c(rx, ey, er * 1.8, c)
        if kind == 'side':
            return gloss_eye(lx + er * .34, ey, er, self.dark_eyes) + \
                   gloss_eye(rx + er * .34, ey, er, self.dark_eyes)
        return ''

    def mouth(self, kind='smile', y=None):
        my = self.mouth_y if y is None else y
        r = self.r
        if kind == 'smile':
            return tiny_smile(self.cx, my, r * .30, r * .17)
        if kind == 'grin':
            return open_smile(self.cx, my - r * .05, r * .46, r * .30)
        if kind == 'wobble':
            return wobble_mouth(self.cx, my, r * .44, 3.0)
        if kind == 'pout':
            return pout_mouth(self.cx, my, r * .46, 3.4)
        if kind == 'cry':
            return open_mouth(self.cx, my + r * .05, r * .17, r * .21)
        if kind == 'kiss':
            return kiss_mouth(self.cx, my, r * .13, r * .16)
        if kind == 'flat':
            return flat_c(self.cx, my, r * .26)
        if kind == 'frown':
            return frown(self.cx, my + r * .05, r * .30, r * .16)
        return ''

    def blushes(self, big=1.0):
        out = ''
        for sd in (-1, 1):
            cx, cy = self.cheek(sd)
            out += blush(cx, cy, self.r * .21 * big, self.r * .155 * big, self.blushc, self.blush_op)
        return out

    def brows(self, tilt):
        lx, rx = self.cx - self.eye_dx, self.cx + self.eye_dx
        by = self.eye_y - self.er * 2.0
        c = SCLERA if self.dark_eyes else P
        return ('<path d="M%s %s L%s %s" stroke="%s" stroke-width="3.2" stroke-linecap="round"/>'
                '<path d="M%s %s L%s %s" stroke="%s" stroke-width="3.2" stroke-linecap="round"/>'
                % (n(lx - self.er), n(by + tilt / 2), n(lx + self.er), n(by - tilt / 2), c,
                   n(rx - self.er), n(by - tilt / 2), n(rx + self.er), n(by + tilt / 2), c))


# ---------------------------------------------------------------------------
# PACK C — pandas
# ---------------------------------------------------------------------------
class Panda(Cutie):
    fill = MOCHI_F
    limbf = MOCHI_PATCH
    blushc = '#FF9FB0'
    dark_eyes = True
    patch_rot = 24.0
    patch_rx, patch_ry = .34, .40
    ear_inner = None
    tuft = False

    def ears(self, perk=0.0):
        r, out = self.r, ''
        er_ = r * .36
        for sd in (-1, 1):
            ex = self.cx + sd * r * .76
            ey = self.cy - r * .74 - perk * r * .10
            out += '<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (
                n(ex), n(ey), n(er_), MOCHI_PATCH, P, n(W))
            if self.ear_inner:
                out += '<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (
                    n(ex), n(ey + er_ * .10), n(er_ * .46), self.ear_inner)
        return out

    def patches(self):
        """The eye patches. Drawn before the eyes so the eyes sit ON them."""
        out = ''
        for sd in (-1, 1):
            px = self.cx + sd * self.eye_dx
            py = self.eye_y + self.r * .02
            out += ('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"'
                    ' transform="rotate(%s %s %s)"/>'
                    % (n(px), n(py), n(self.r * self.patch_rx), n(self.r * self.patch_ry),
                       MOCHI_PATCH, n(sd * self.patch_rot), n(px), n(py)))
        return out

    def muzzle(self):
        r = self.r
        out = ''
        if self.fill != MOCHI_F:      # Bao gets a lighter muzzle to lift the cream
            out += '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="#FFF9F2"/>' % (
                n(self.cx), n(self.cy + r * .48), n(r * .34), n(r * .26))
        return out

    def head_extras(self):
        if not self.tuft:
            return ''
        r = self.r
        return ('<path d="M%s %s c%s %s %s %s %s %s" stroke="%s" stroke-width="4.6"'
                ' stroke-linecap="round" fill="none"/>'
                % (n(self.cx - r * .08), n(self.cy - r * .99), n(-1.2), n(-4.4),
                   n(3.4), n(-5.8), n(5.4), n(-2.8), MOCHI_PATCH))

    def face(self, eyes='dot', mouth='smile', blush_on=True, brows=None, extra=''):
        out = self.muzzle() + self.patches()
        if brows:
            out += self.brows(brows)
        out += self.eyes(eyes)
        out += cat_nose(self.cx, self.cy + self.r * .36, self.r * .16, P)
        out += self.mouth(mouth)
        if blush_on:
            out += self.blushes()
        return out + extra

    def whole(self, perk=0.0, **kw):
        return self.ears(perk) + self.head() + self.head_extras() + self.face(**kw)


class Mochi(Panda):
    """Classic white panda, tilted teardrop patches."""
    fill = MOCHI_F
    eye_k = .86
    patch_rot, patch_rx, patch_ry = 26.0, .35, .43


class Bao(Panda):
    """Warm cream panda: rounder patches, rose inner ears, a little bigger."""
    fill = BAO_F
    limbf = BAO_PATCH
    blushc = '#F2748C'
    eye_k = .86
    patch_rot, patch_rx, patch_ry = 6.0, .38, .38
    ear_inner = BAO_EAR
    tuft = True


def mochi(cx, cy, r=27.0):
    return Mochi(cx, cy, r)


def bao(cx, cy, r=29.0):
    return Bao(cx, cy, r)


# ---------------------------------------------------------------------------
# PACK D — pigs
# ---------------------------------------------------------------------------
class Pig(Cutie):
    fill = POPPY_F
    limbf = POPPY_F
    snoutf = POPPY_SNOUT
    blushc = '#F2748C'
    floppy = False

    def ears(self, perk=0.0):
        r, out = self.r, ''
        for sd in (-1, 1):
            bx = self.cx + sd * r * .60
            by = self.cy - r * .68
            if self.floppy:
                # folded-over ear: a soft leaf hanging outward and down
                out += ('<path d="M%s %s C%s %s %s %s %s %s C%s %s %s %s %s %s Z"'
                        ' fill="%s" stroke="%s" stroke-width="%s" stroke-linejoin="round"/>'
                        % (n(bx - sd * r * .12), n(by - r * .16),
                           n(bx + sd * r * .70), n(by - r * .56),
                           n(bx + sd * r * 1.06), n(by + r * .34),
                           n(bx + sd * r * .72), n(by + r * .76),
                           n(bx + sd * r * .44), n(by + r * .94),
                           n(bx + sd * r * .04), n(by + r * .52),
                           n(bx - sd * r * .12), n(by - r * .16),
                           self.fill, P, n(W)))
                out += ('<path d="M%s %s C%s %s %s %s %s %s" stroke="%s" stroke-width="3.4"'
                        ' fill="none" stroke-linecap="round" opacity=".75"/>'
                        % (n(bx + sd * r * .16), n(by - r * .02),
                           n(bx + sd * r * .58), n(by - r * .12),
                           n(bx + sd * r * .74), n(by + r * .30),
                           n(bx + sd * r * .52), n(by + r * .60), self.snoutf))
            else:
                # perky rounded triangle
                tipx = self.cx + sd * (r * .74 + perk * r * .10)
                tipy = self.cy - r * (1.28 + perk * .10)
                out += ('<path d="M%s %s C%s %s %s %s %s %s C%s %s %s %s %s %s Z"'
                        ' fill="%s" stroke="%s" stroke-width="%s" stroke-linejoin="round"/>'
                        % (n(bx - sd * r * .24), n(by + r * .06),
                           n(bx - sd * r * .20), n(by - r * .34), n(tipx - sd * r * .10), n(tipy + r * .16),
                           n(tipx), n(tipy),
                           n(tipx + sd * r * .16), n(tipy + r * .30), n(bx + sd * r * .38), n(by - r * .16),
                           n(bx + sd * r * .30), n(by + r * .16),
                           self.fill, P, n(W)))
                out += ('<path d="M%s %s C%s %s %s %s %s %s" stroke="%s" stroke-width="3.6"'
                        ' fill="none" stroke-linecap="round" opacity=".8"/>'
                        % (n(bx), n(by + r * .02), n(bx - sd * r * .02), n(by - r * .30),
                           n(tipx - sd * r * .08), n(tipy + r * .26), n(tipx - sd * r * .04), n(tipy + r * .14),
                           self.snoutf))
        return out

    def snout(self, scrunch=0.0, dx=0.0, dy=0.0, rot=0.0):
        """The signature. scrunch squashes it wider + shorter (pouty, crying)."""
        r = self.r
        cx = self.cx + dx
        cy = self.cy + r * .40 + dy
        rx = r * (.44 + scrunch * .08)
        ry = r * (.33 - scrunch * .07)
        out = ('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s" stroke="%s" stroke-width="%s"/>'
               % (n(cx), n(cy), n(rx), n(ry), self.snoutf, P, n(W)))
        nd = rx * .34
        for sd in (-1, 1):
            out += '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"/>' % (
                n(cx + sd * nd), n(cy), n(rx * .17), n(ry * .34), P)
        if rot:
            out = '<g transform="rotate(%s %s %s)">%s</g>' % (n(rot), n(cx), n(cy), out)
        return out

    def face(self, eyes='dot', mouth='smile', blush_on=True, brows=None,
             scrunch=0.0, snout_dx=0.0, snout_dy=0.0, snout_rot=0.0, extra=''):
        out = ''
        if brows:
            out += self.brows(brows)
        out += self.eyes(eyes)
        out += self.snout(scrunch, snout_dx, snout_dy, snout_rot)
        # tiny mouth tucked under the snout
        my = self.cy + self.r * .80
        if mouth == 'smile':
            out += tiny_smile(self.cx, my, self.r * .26, self.r * .14, 3.0)
        elif mouth == 'grin':
            out += open_smile(self.cx, my - self.r * .06, self.r * .40, self.r * .26)
        elif mouth == 'wobble':
            out += wobble_mouth(self.cx, my, self.r * .40, 3.0)
        elif mouth == 'pout':
            out += pout_mouth(self.cx, my - self.r * .02, self.r * .40, 3.2)
        elif mouth == 'cry':
            out += open_mouth(self.cx, my + self.r * .04, self.r * .15, self.r * .19)
        elif mouth == 'kiss':
            out += kiss_mouth(self.cx, my, self.r * .11, self.r * .14)
        elif mouth == 'flat':
            out += flat_c(self.cx, my, self.r * .24)
        elif mouth == 'frown':
            out += frown(self.cx, my + self.r * .04, self.r * .26, self.r * .14)
        if blush_on:
            out += self.blushes()
        return out + extra

    def whole(self, perk=0.0, **kw):
        return self.ears(perk) + self.head() + self.face(**kw)


class Poppy(Pig):
    fill, snoutf, limbf = POPPY_F, POPPY_SNOUT, POPPY_F
    floppy = False


class Truffle(Pig):
    fill, snoutf, limbf = TRUFFLE_F, TRUFFLE_SNOUT, TRUFFLE_F
    floppy = True
    blushc = '#C8536F'


def poppy(cx, cy, r=27.0):
    return Poppy(cx, cy, r)


def truffle(cx, cy, r=29.0):
    return Truffle(cx, cy, r)


def curly_tail(x, y, kind='curl', fill=POPPY_F, side=1):
    """The pigs' signature tail. It participates: droops when sad, springs when happy."""
    dark, inner = 11.4, 5.2
    if kind == 'curl':          # relaxed corkscrew
        d = ('M%s %s c9 0 12 -6 9.6 -10.5 c-2.1 -3.9 -8.1 -3.3 -8.4 1.2 '
             'c-.3 3.9 3.9 6 7.5 4.5' % (n(x), n(y)))
    elif kind == 'spring':      # tight, bouncy, lifted
        d = ('M%s %s c9.8 -1.5 12.8 -9 9.6 -14 c-2.7 -4.4 -9.3 -3.3 -9 1.8 '
             'c.3 4.5 5.4 6.3 9.6 3.9' % (n(x), n(y)))
    elif kind == 'droop':       # uncurled, hanging
        d = 'M%s %s c8 3.5 10 10 8 16.5' % (n(x), n(y))
    elif kind == 'wag':
        d = 'M%s %s c10.5 1.5 13.5 -6 9.9 -11.4 c-2.4 -3.6 -8.1 -2.1 -6.9 2.4' % (n(x), n(y))
    else:
        d = 'M%s %s c9 0 12 -6 9.6 -11' % (n(x), n(y))
    out = limb(d, fill, dark, inner)
    if side < 0:      # mirror, otherwise a left-hand tail curls back into the body
        out = '<g transform="translate(%s 0) scale(-1 1)">%s</g>' % (n(2 * x), out)
    return out


def snout_boop(cx, cy):
    """Contact marks for the snout-to-cheek kiss."""
    return (spark_lines(cx, cy) +
            '<circle cx="%s" cy="%s" r="1.9" fill="#FFD9E2" stroke="%s" stroke-width="1.4"/>'
            % (n(cx - 2), n(cy + 6), P))


def spark_lines(cx, cy):
    return ('<path d="M%s %sl2.8 -3.8M%s %sl4.0 -1.8M%s %sl1.0 -4.2" stroke="#E85D75"'
            ' stroke-width="2.2" stroke-linecap="round" opacity=".85"/>'
            % (n(cx), n(cy), n(cx + 4), n(cy + 5), n(cx - 5), n(cy + 2)))
