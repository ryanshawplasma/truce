#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""The same ten emotional beats, staged for the two CUTER packs.

Pack C — Mochi & Bao      (pandas)
Pack D — Poppy & Truffle  (pigs)

All the staging solutions from sheets 1-2 are re-applied:
  * hug        = far arm + hand BEHIND the partner, then bodies, then a near arm in front
  * kiss       = kisser leans in, contact mark sits ON the partner's cheek, sparks + hearts
  * crossed arms = two thin arcs LOW on the belly (high ones read as stripes)
  * head-pat   = short arm off a raised shoulder, paw clearly landing on the head top
  * sulk-rain  = cloud parked top-left with rain, sulker's head kept clear underneath

New for this sheet: the bigger heads mean everything had to be re-blocked — arms
are now generated from the rig's shoulder anchors instead of hand-placed, so the
stubs stay short and consistent across all twenty cards.
"""

from gen3_rig import *          # noqa — cute rig + gen2 primitives
from gen2_poses import (bouquet, sign_board, sweat, puddle, rain_set,
                        hearts_above, sparkles, kiss_mark, POSES, LABELS)   # noqa


# ---------------------------------------------------------------------------
# arm helpers — every arm is a short stub hung off a real shoulder anchor
# ---------------------------------------------------------------------------
def arm(ch, side, tx, ty, bow=0.0, dark=11.2, inner=5.4, fill=None):
    sx, sy = ch.shoulder(side)
    cx1 = sx + (tx - sx) * .45 + side * bow
    cy1 = sy + (ty - sy) * .45 + abs(bow) * .35
    d = 'M%s %s Q%s %s %s %s' % (n(sx), n(sy), n(cx1), n(cy1), n(tx), n(ty))
    return limb(d, fill or ch.limbf, dark, inner)


def mitt(ch, x, y, rot=0, k=1.0, fill=None):
    return hand(x, y, fill or ch.limbf, 5.4 * k, 4.7 * k, rot)


def tail_of(ch, side, kind, fill=None):
    """Curly tail hung off the body flank. Mirrors itself on the left side."""
    bx, by, brx, bry = ch.body_box()
    return curly_tail(bx + side * brx * .96, by + bry * .34, kind, fill or ch.fill, side)


def beg_arms(ch):
    """Both stubs forward, paws pressed together — the classic please-please."""
    my = ch.cy + ch.r * 1.46
    return (arm(ch, -1, ch.cx - ch.r * .34, my, bow=4.0) +
            arm(ch, 1, ch.cx + ch.r * .34, my, bow=-4.0) +
            mitt(ch, ch.cx - ch.r * .36, my, -26, 1.0) +
            mitt(ch, ch.cx + ch.r * .36, my, 26, 1.0))


def crossed_arms(ch):
    """Two thin arcs low across the belly — reads as folded, not as stripes."""
    bx, by, brx, bry = ch.body_box()
    y = by + bry * .36
    # The two arms sit almost on top of each other so they read as ONE folded
    # bundle with a paw at each end — spaced apart they just look like stripes.
    return (limb('M%s %s C%s %s %s %s %s %s'
                 % (n(bx - brx * .60), n(y - bry * .02), n(bx - brx * .22), n(y + bry * .14),
                    n(bx + brx * .22), n(y + bry * .14), n(bx + brx * .58), n(y + bry * .02)),
                 ch.limbf, 9.6, 4.7) +
            limb('M%s %s C%s %s %s %s %s %s'
                 % (n(bx + brx * .60), n(y - bry * .20), n(bx + brx * .22), n(y - bry * .06),
                    n(bx - brx * .22), n(y - bry * .06), n(bx - brx * .58), n(y - bry * .18)),
                 ch.limbf, 9.6, 4.7) +
            mitt(ch, bx + brx * .60, y + bry * .02, 16, .84) +
            mitt(ch, bx - brx * .60, y - bry * .18, -16, .84))


def hug_behind(a, b):
    """a's far arm passes BEHIND b, and b's far arm behind a. Drawn first."""
    ax, ay, arx, ary = a.body_box()
    bx, by, brx, bry = b.body_box()
    y = (ay + by) / 2 + 2
    return (limb('M%s %s C%s %s %s %s %s %s'
                 % (n(bx - brx * .30), n(by - bry * .10), n((ax + bx) / 2), n(y + 4),
                    n(ax - arx * .40), n(y + 2), n(ax - arx * 1.10), n(ay - ary * .10)),
                 b.limbf, 11.8, 5.8) +
            mitt(b, ax - arx * 1.22, ay - ary * .12, 18, 1.05) +
            limb('M%s %s C%s %s %s %s %s %s'
                 % (n(ax + arx * .30), n(ay + ary * .10), n((ax + bx) / 2), n(y + 12),
                    n(bx + brx * .40), n(y + 10), n(bx + brx * 1.10), n(by + ary * .06)),
                 a.limbf, 11.8, 5.8) +
            mitt(a, bx + brx * 1.22, by + bry * .04, -18, 1.05))


def joined_hands(a, b):
    ax, ay, arx, ary = a.body_box()
    bx, by, brx, bry = b.body_box()
    y = max(ay + ary * .60, by + bry * .60)
    return limb('M%s %s C%s %s %s %s %s %s'
                % (n(ax + arx * .70), n(ay + ary * .42), n(ax + arx * 1.30), n(y + 5),
                   n(bx - brx * 1.30), n(y + 5), n(bx - brx * .70), n(by + bry * .42)),
                a.limbf, 11.6, 5.6)


def placard(cx=60, top=66, w=82, h=32, msg='forgive me?'):
    """Held sign. The post version from sheets 1-2 ran straight through these
    much larger heads, so the sign moved down into the character's hands."""
    out = ('<rect x="%s" y="%s" width="%s" height="%s" rx="11" fill="%s" stroke="%s"'
           ' stroke-width="4.2"/>' % (n(cx - w / 2), n(top), n(w), n(h), CREAM, P))
    out += ('<text x="%s" y="%s" text-anchor="middle" class="hand" font-size="15"'
            ' fill="#E85D75">%s</text>' % (n(cx), n(top + h * .66), msg))
    return out


def streams_from(ch, h=34.0, w=6.0):
    lx, rx = ch.cx - ch.eye_dx, ch.cx + ch.eye_dx
    ey = ch.eye_y + ch.er * .7
    return (g('an-stream', stream(lx, ey, h, w)) +
            g('an-stream an-d2', stream(rx, ey, h, w)))


# ===========================================================================
# PACK C — Mochi & Bao (pandas)
# ===========================================================================
def c_begging():
    m = mochi(60, 40, 25)
    char = g('an-plead', m.feet() + m.body() + m.whole(perk=.3, eyes='sparkle', mouth='wobble') +
             beg_arms(m))
    return sparkles([(16, 40, 4.4), (104, 50, 3.6)]) + g('an-bob an-d2', sweat(103, 26, .9)) + char


def c_waterfall_cry():
    m = mochi(60, 38, 24)
    body = m.feet() + m.body()
    face = m.whole(perk=-.2, eyes='squeeze', mouth='cry')
    arms = (arm(m, -1, m.cx - m.r * 1.10, m.cy + m.r * 2.00, bow=-4) +
            arm(m, 1, m.cx + m.r * 1.10, m.cy + m.r * 2.00, bow=4) +
            mitt(m, m.cx - m.r * 1.14, m.cy + m.r * 2.04, -18) +
            mitt(m, m.cx + m.r * 1.14, m.cy + m.r * 2.04, 18))
    drops = g('an-teardrop', teardrop(18, 46, .78)) + g('an-teardrop an-d3', teardrop(103, 52, .68))
    return (puddle(60, 108, 27, 4.8) + g('an-sob', body + arms + face) +
            streams_from(m, 38, 6.2) + drops)


def c_big_hug():
    m = mochi(43, 50, 19)
    b = bao(80, 53, 20)
    behind = hug_behind(m, b)
    bodies = (m.feet() + m.body() + b.feet() + b.body() +
              m.whole(perk=.2, eyes='happy', mouth='smile') +
              b.whole(perk=.2, eyes='happy', mouth='smile'))
    front = limb('M%s %s C%s %s %s %s %s %s' % (n(66), n(80), n(58), n(76), n(48), n(76), n(42), n(79)),
                 m.limbf, 11.4, 5.6)
    return g('an-squeeze', behind + bodies + front) + hearts_above([(60, 12, .92), (102, 20, .64)])


def c_flowers_shy():
    b = bao(44, 42, 24)
    hx, hy = 92, 74
    body = b.feet() + b.body()
    reach = arm(b, 1, hx - 3, hy - 2, bow=-4)
    face = b.whole(perk=.1, eyes='happy', mouth='smile', extra=b.blushes(1.25))
    hide = arm(b, -1, b.cx - b.r * .55, b.cy + b.r * 1.55, bow=-3)
    return (g('an-shy', body + hide + face + reach + mitt(b, hx, hy, -10)) +
            g('an-sway-s', bouquet(hx, hy - 2)) + sparkles([(14, 26, 4.0), (110, 40, 3.2)]))


def c_pouty():
    b = bao(56, 42, 25)
    char = g('an-huff', g('', b.feet() + b.body() +
                          b.whole(perk=-.6, eyes='flat', mouth='pout', brows=5.0) + crossed_arms(b),
                          tf='rotate(-6 56 66)'))
    return (g('an-steam', steam('M100 24c6-4 3-10-2-12s-6-7-1-10')) +
            g('an-steam an-d2', steam('M111 40c5-4 2-9-2-11', 4.6)) + char)


def c_cheek_kiss():
    b = bao(80, 48, 20)
    m = mochi(34, 58, 18)
    startled = g('an-startle', b.feet() + b.body() +
                 b.whole(perk=.6, eyes='wide', mouth='kiss', extra=b.blushes(1.3)))
    kisser = g('an-lean',
               g('', m.feet() + m.body() + m.whole(perk=.2, eyes='happy', mouth='kiss'),
                 tf='rotate(9 34 62)') + kiss_mark(63, 58, -16))
    return startled + kisser + hearts_above([(104, 20, .78), (94, 6, .54)])


def c_head_pat():
    m = mochi(38, 62, 20)
    b = bao(92, 54, 17)
    patted = g('an-melt', m.feet() + m.body() + m.whole(perk=-.3, eyes='happy', mouth='smile'))
    patter = b.feet() + b.body() + b.whole(perk=.2, eyes='happy', mouth='smile')
    patting = g('an-pat', limb('M80 70 C72 58 60 46 50 42', b.limbf, 10.2, 5.0) +
                paw(45, 40, b.limbf, BAO_EAR, -32, 8.6, 5.4))
    return patted + patter + patting + sparkles([(8, 42, 4.2), (66, 22, 3.4)])


def c_forgive_sign():
    b = bao(60, 40, 23)
    body = b.feet() + b.body()
    face = b.whole(perk=.3, eyes='sparkle', mouth='wobble')
    arms = arm(b, -1, 27, 72, bow=-3) + arm(b, 1, 93, 72, bow=3)
    return g('an-tilt', body + face + arms + placard(60, 68, 82, 32) +
             mitt(b, 27, 67, -18, 1.2) + mitt(b, 93, 67, 18, 1.2))


def c_sulk_rain():
    m = mochi(31, 66, 17)
    b = bao(88, 64, 17)
    sulker = g('', m.feet() + m.body() +
               m.whole(perk=-.9, eyes='flat', mouth='frown', blush_on=False),
               tf='rotate(-6 31 84)')
    watcher = b.feet() + b.body() + b.whole(perk=-.4, eyes='sad', mouth='flat')
    reach = (limb('M72 92 C66 90 62 91 58 92', b.limbf, 10.4, 5.2) +
             paw(53, 92, b.limbf, BAO_EAR, 12, 7.8, 5.2))
    return (g('an-cloud', cloud(31, 17, .84)) + rain_set([23, 31, 39], 34, 9) +
            sulker + watcher + reach)


def c_made_up():
    m = mochi(36, 52, 19)
    b = bao(84, 54, 19)
    return (g('an-cheer', m.feet() + m.body() + m.whole(perk=.8, eyes='happy', mouth='grin')) +
            g('an-cheer an-d2', b.feet() + b.body() + b.whole(perk=.8, eyes='happy', mouth='grin')) +
            joined_hands(m, b) +
            hearts_above([(60, 10, .95), (14, 24, .56)]) +
            sparkles([(6, 62, 3.4), (114, 66, 3.0)]))


# ===========================================================================
# PACK D — Poppy & Truffle (pigs)
# ===========================================================================
def d_begging():
    p = poppy(60, 40, 25)
    tail = tail_of(p, 1, 'curl')
    char = g('an-plead', tail + p.feet() + p.body() +
             p.whole(perk=.4, eyes='sparkle', mouth='wobble', scrunch=.2) + beg_arms(p))
    return sparkles([(16, 40, 4.4), (104, 52, 3.6)]) + g('an-bob an-d2', sweat(103, 26, .9)) + char


def d_waterfall_cry():
    p = poppy(60, 38, 24)
    tail = tail_of(p, 1, 'droop')
    body = tail + p.feet() + p.body()
    arms = (arm(p, -1, p.cx - p.r * 1.10, p.cy + p.r * 2.00, bow=-4) +
            arm(p, 1, p.cx + p.r * 1.10, p.cy + p.r * 2.00, bow=4) +
            mitt(p, p.cx - p.r * 1.14, p.cy + p.r * 2.04, -18) +
            mitt(p, p.cx + p.r * 1.14, p.cy + p.r * 2.04, 18))
    face = p.whole(perk=-.3, eyes='squeeze', mouth='cry', scrunch=1.0)
    drops = g('an-teardrop', teardrop(18, 46, .78)) + g('an-teardrop an-d3', teardrop(103, 52, .68))
    return (puddle(60, 108, 27, 4.8) + g('an-sob', body + arms + face) +
            streams_from(p, 38, 6.2) + drops)


def d_big_hug():
    p = poppy(43, 50, 19)
    t = truffle(80, 53, 20)
    tail = tail_of(t, 1, 'spring')
    behind = hug_behind(p, t)
    bodies = (p.feet() + p.body() + t.feet() + t.body() +
              p.whole(perk=.2, eyes='happy', mouth='smile') +
              t.whole(eyes='happy', mouth='smile'))
    front = limb('M%s %s C%s %s %s %s %s %s' % (n(66), n(80), n(58), n(76), n(48), n(76), n(42), n(79)),
                 p.limbf, 11.4, 5.6)
    return g('an-squeeze', tail + behind + bodies + front) + hearts_above([(60, 12, .92), (103, 20, .64)])


def d_flowers_shy():
    p = poppy(44, 42, 24)
    hx, hy = 92, 74
    tail = tail_of(p, -1, 'curl')
    body = p.feet() + p.body()
    reach = arm(p, 1, hx - 3, hy - 2, bow=-4)
    hide = arm(p, -1, p.cx - p.r * .55, p.cy + p.r * 1.55, bow=-3)
    face = p.whole(perk=.2, eyes='happy', mouth='smile', extra=p.blushes(1.3))
    return (g('an-shy', tail + body + hide + face + reach + mitt(p, hx, hy, -10)) +
            g('an-sway-s', bouquet(hx, hy - 2)) + sparkles([(12, 26, 4.0), (110, 40, 3.2)]))


def d_pouty():
    t = truffle(56, 42, 25)
    tail = tail_of(t, -1, 'wag')
    char = g('an-huff', g('', tail + t.feet() + t.body() +
                          t.whole(eyes='flat', mouth='pout', brows=5.0, scrunch=1.0) + crossed_arms(t),
                          tf='rotate(-6 56 66)'))
    return (g('an-steam', steam('M100 24c6-4 3-10-2-12s-6-7-1-10')) +
            g('an-steam an-d2', steam('M111 40c5-4 2-9-2-11', 4.6)) + char)


def d_cheek_kiss():
    t = truffle(80, 48, 20)
    p = poppy(34, 58, 18)
    startled = g('an-startle', tail_of(t, 1, 'spring') +
                 t.feet() + t.body() +
                 t.whole(eyes='wide', mouth='smile', extra=t.blushes(1.35)))
    # Poppy leans in and boops Truffle's cheek with her snout
    kisser = g('an-lean',
               g('', p.feet() + p.body() +
                 p.whole(perk=.3, eyes='happy', mouth='kiss', scrunch=.5, snout_dx=4.0, snout_dy=-1.0),
                 tf='rotate(11 34 62)') + snout_boop(57, 54))
    return startled + kisser + hearts_above([(104, 18, .78), (94, 4, .54)])


def d_head_pat():
    p = poppy(38, 62, 20)
    t = truffle(92, 54, 17)
    patted = g('an-melt', tail_of(p, -1, 'curl') +
               p.feet() + p.body() + p.whole(perk=-.3, eyes='happy', mouth='smile'))
    patter = t.feet() + t.body() + t.whole(eyes='happy', mouth='smile')
    patting = g('an-pat', limb('M80 70 C72 58 60 46 50 42', t.limbf, 10.2, 5.0) +
                paw(45, 40, t.limbf, TRUFFLE_SNOUT, -32, 8.6, 5.4))
    return patted + patter + patting + sparkles([(8, 42, 4.2), (66, 22, 3.4)])


def d_forgive_sign():
    p = poppy(60, 40, 23)
    tail = tail_of(p, 1, 'curl')
    body = tail + p.feet() + p.body()
    face = p.whole(perk=.3, eyes='sparkle', mouth='wobble', scrunch=.3)
    arms = arm(p, -1, 27, 72, bow=-3) + arm(p, 1, 93, 72, bow=3)
    return g('an-tilt', body + face + arms + placard(60, 68, 82, 32) +
             mitt(p, 27, 67, -18, 1.2) + mitt(p, 93, 67, 18, 1.2))


def d_sulk_rain():
    t = truffle(31, 66, 17)
    p = poppy(88, 64, 17)
    sulker = g('', tail_of(t, 1, 'droop') +
               t.feet() + t.body() +
               t.whole(eyes='flat', mouth='frown', blush_on=False, scrunch=.6),
               tf='rotate(-6 31 84)')
    watcher = p.feet() + p.body() + p.whole(perk=-.5, eyes='sad', mouth='flat')
    reach = (limb('M72 92 C66 90 62 91 58 92', p.limbf, 10.4, 5.2) +
             paw(53, 92, p.limbf, POPPY_SNOUT, 12, 7.8, 5.2))
    return (g('an-cloud', cloud(31, 17, .84)) + rain_set([23, 31, 39], 34, 9) +
            sulker + watcher + reach)


def d_made_up():
    p = poppy(36, 52, 19)
    t = truffle(84, 54, 19)
    return (g('an-cheer', tail_of(p, -1, 'spring') +
              p.feet() + p.body() + p.whole(perk=.9, eyes='happy', mouth='grin')) +
            g('an-cheer an-d2', tail_of(t, 1, 'spring') +
              t.feet() + t.body() + t.whole(eyes='happy', mouth='grin')) +
            joined_hands(p, t) +
            hearts_above([(60, 10, .95), (14, 24, .56)]) +
            sparkles([(6, 62, 3.4), (114, 66, 3.0)]))


PACK_C = {'begging': c_begging, 'waterfall-cry': c_waterfall_cry, 'big-hug': c_big_hug,
          'flowers-shy': c_flowers_shy, 'pouty': c_pouty, 'cheek-kiss': c_cheek_kiss,
          'head-pat': c_head_pat, 'forgive-sign': c_forgive_sign, 'sulk-rain': c_sulk_rain,
          'made-up': c_made_up}

PACK_D = {'begging': d_begging, 'waterfall-cry': d_waterfall_cry, 'big-hug': d_big_hug,
          'flowers-shy': d_flowers_shy, 'pouty': d_pouty, 'cheek-kiss': d_cheek_kiss,
          'head-pat': d_head_pat, 'forgive-sign': d_forgive_sign, 'sulk-rain': d_sulk_rain,
          'made-up': d_made_up}
