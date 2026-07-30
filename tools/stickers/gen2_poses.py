#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""The 10 staged poses, built twice: once for Rosie & Plum, once for Clover & Biscuit.

Staging rules learned on the Momo & Pip sheet and re-applied here:
  * hug = far arm + hand BEHIND the partner, bodies, then one near arm across the front
  * kiss = kisser leans in, kiss-mark sits ON the partner's cheek, sparks + hearts nearby
  * crossed arms = two thin arcs low on the belly (high ones read as stripes)
  * head-pat = short arm from a raised shoulder, paw clearly landing on the head top
"""

import math
from gen2_rig import *   # noqa

POSES = ['begging', 'waterfall-cry', 'big-hug', 'flowers-shy', 'pouty',
         'cheek-kiss', 'head-pat', 'forgive-sign', 'sulk-rain', 'made-up']

LABELS = {
    'begging': 'Begging', 'waterfall-cry': 'Waterfall cry', 'big-hug': 'Big hug',
    'flowers-shy': 'Flowers, shy', 'pouty': 'Pouty', 'cheek-kiss': 'Cheek kiss',
    'head-pat': 'Head pat', 'forgive-sign': 'Forgive me?', 'sulk-rain': 'Sulk & rain',
    'made-up': 'Made up',
}


# ---------------------------------------------------------------------------
# shared props
# ---------------------------------------------------------------------------
def flower(cx, cy, r=6.0, petal='#FFF3E9', mid='#F2B880'):
    out = ''
    for i in range(5):
        a = math.radians(-90 + i * 72)
        out += ('<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="%s" stroke-width="2.4"/>'
                % (n(cx + math.cos(a) * r * .82), n(cy + math.sin(a) * r * .82), n(r * .58), petal, P))
    out += '<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="%s" stroke-width="2.4"/>' % (
        n(cx), n(cy), n(r * .44), mid, P)
    return out


def bouquet(hx, hy):
    """Blooms fanned above a hand at (hx,hy)."""
    out = ''
    for dx, dy in ((-11, -18), (1, -27), (12, -16)):
        out += ('<path d="M%s %s Q%s %s %s %s" stroke="#6FA96E" stroke-width="3.6"'
                ' stroke-linecap="round" fill="none"/>'
                % (n(hx), n(hy - 2), n(hx + dx * .35), n(hy + dy * .6), n(hx + dx), n(hy + dy)))
    out += ('<path d="M%s %s l-6 3 M%s %s l6 4" stroke="#6FA96E" stroke-width="3.2"'
            ' stroke-linecap="round" fill="none"/>' % (n(hx - 3), n(hy - 12), n(hx + 3), n(hy - 8)))
    for dx, dy, r in ((-11, -18, 6.2), (1, -27, 6.6), (12, -16, 5.8)):
        out += flower(hx + dx, hy + dy, r)
    return out


def sign_board(cx=60, top=6, w=104, h=40, msg='forgive me?', post_to=72):
    out = '<path d="M%s %s V%s" stroke="%s" stroke-width="6" stroke-linecap="round"/>' % (
        n(cx), n(top + h - 4), n(post_to), P)
    out += ('<rect x="%s" y="%s" width="%s" height="%s" rx="10" fill="%s" stroke="%s" stroke-width="4.2"/>'
            % (n(cx - w / 2), n(top), n(w), n(h), CREAM, P))
    out += ('<text x="%s" y="%s" text-anchor="middle" class="hand" font-size="18" fill="#E85D75">%s</text>'
            % (n(cx), n(top + h * .68), msg))
    return out


def sweat(cx, cy, s=1.0):
    return ('<path d="M%s %s c%s %s %s %s 0 %s c%s %s %s %s 0 %sZ" fill="#BFD6F5"'
            ' stroke="%s" stroke-width="2.2" stroke-linejoin="round"/>'
            % (n(cx), n(cy - 5 * s), n(2.6 * s), n(3.0 * s), n(4.0 * s), n(5.4 * s), n(9.4 * s),
               n(-4.0 * s), n(0), n(-4.0 * s), n(-2.4 * s), n(-9.4 * s), P))


def puddle(cx, cy, rx=24, ry=4.6):
    return '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="#BFD6F5" opacity=".75"/>' % (
        n(cx), n(cy), n(rx), n(ry))


def rain_set(xs, y, h=9.0):
    out = ''
    for i, x in enumerate(xs):
        cls = 'an-rain' + ('' if i == 0 else (' an-d2' if i == 1 else ' an-d3'))
        out += g(cls, rain(x, y, h))
    return out


def hearts_above(pts):
    out = ''
    for i, (x, y, s) in enumerate(pts):
        cls = 'an-bob' + ('' if i == 0 else (' an-d2' if i == 1 else ' an-d3'))
        out += g(cls, heart_sym(x, y, s))
    return out


def sparkles(pts):
    out = ''
    for i, (x, y, r) in enumerate(pts):
        cls = 'an-twinkle' + ('' if i == 0 else (' an-d2' if i == 1 else ' an-d3'))
        out += g(cls, sparkle(x, y, r))
    return out


def kiss_mark(cx, cy, rot=-14):
    return ('<g transform="rotate(%s %s %s)">'
            '<ellipse cx="%s" cy="%s" rx="6.6" ry="5.2" fill="#FFD9E2" stroke="%s" stroke-width="3.0"/>'
            '<path d="M%s %s h9.2" stroke="%s" stroke-width="2.0" stroke-linecap="round"/>'
            '</g>' % (n(rot), n(cx), n(cy), n(cx), n(cy), P, n(cx - 4.6), n(cy), P))


def spark_lines(cx, cy):
    return ('<path d="M%s %sl3.5 -4.5M%s %sl5 -2.5" stroke="#E85D75" stroke-width="2.6"'
            ' stroke-linecap="round" opacity="0.8"/>' % (n(cx), n(cy), n(cx + 7), n(cy + 5)))


def body_ell(cx, cy, rx, ry, fill):
    return '<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (
        n(cx), n(cy), n(rx), n(ry), fill, P, n(W))


def sh(ch, side):
    x, y = ch.shoulder(side)
    return n(x), n(y)


# ===========================================================================
# PACK A — Rosie & Plum  (hearts)
# ===========================================================================
def a_begging():
    r = rosie(60, 58, 1.15)
    x0, y0 = sh(r, -1)
    x1, y1 = sh(r, 1)
    arms = (limb('M%s %s C42 74 50 76 56 75' % (x0, y0), r.limbf, 14.2, 7.0) +
            limb('M%s %s C78 74 70 76 64 75' % (x1, y1), r.limbf, 14.2, 7.0) +
            hand(55, 74, r.limbf, 6.0, 5.2, -20) + hand(65, 74, r.limbf, 6.0, 5.2, 20))
    char = g('an-plead', r.body() + r.face(eyes='sparkle', mouth='wobble') + arms)
    return sparkles([(20, 42, 4.4), (100, 50, 3.6)]) + g('an-bob an-d2', sweat(96, 30, .9)) + char


def a_waterfall_cry():
    r = rosie(60, 52, 1.05)
    lx, rx_, ey = r.cx - r.eye_dx, r.cx + r.eye_dx, r.eye_y
    face = r.feet() + r.body() + r.face(eyes='squeeze', mouth='cry')
    streams = (g('an-stream', stream(lx - 4, ey + 4, 40, 5.8)) +
               g('an-stream an-d2', stream(rx_ + 4, ey + 4, 40, 5.8)))
    drops = (g('an-teardrop', teardrop(24, 48, .8)) + g('an-teardrop an-d3', teardrop(98, 54, .7)))
    return puddle(60, 99, 26, 5) + g('an-sob', face) + streams + drops


def a_big_hug():
    ro = rosie(42, 66, .95)
    pl = plum(82, 62, 1.0)
    behind = (limb('M72 78 C60 71 44 70 30 72', pl.limbf, 14.6, 7.2) +
              hand(26, 71, pl.limbf, 7.0, 6.0, 18) +
              limb('M50 80 C62 74 80 72 96 73', ro.limbf, 14.6, 7.2) +
              hand(100, 72, ro.limbf, 7.0, 6.0, -18))
    bodies = (ro.body() + ro.face(eyes='happy', mouth='smile') +
              pl.body() + pl.face(eyes='happy', mouth='smile'))
    front = limb('M72 72 C64 67 54 67 47 70', pl.limbf, 14.2, 7.0)
    return g('an-squeeze', behind + bodies + front) + hearts_above([(60, 15, .95), (98, 24, .68)])


def a_flowers_shy():
    r = rosie(46, 62, 1.1)
    hx, hy = 84, 74
    x1, y1 = sh(r, 1)
    arm = limb('M%s %s C72 72 78 74 %s %s' % (x1, y1, n(hx - 1), n(hy - 2)), r.limbf)
    body = (r.feet() + r.body() +
            r.face(eyes='happy', mouth='smile',
                   extra=blush(r.cx - .26 * r.w, r.cy + .03 * r.h, 7.6, 5.2, r.blushc, .95) +
                         blush(r.cx + .26 * r.w, r.cy + .03 * r.h, 7.6, 5.2, r.blushc, .95)))
    return (g('an-shy', body + arm + hand(hx, hy, r.limbf, 6.4, 5.6, -10)) +
            g('an-sway-s', bouquet(hx, hy - 2)) + sparkles([(18, 38, 4.0)]))


def a_pouty():
    pl = plum(58, 58, 1.2)
    arms = (limb('M34 70 C44 76 58 79 71 78', pl.limbf, 13.4, 6.8) +
            limb('M78 69 C68 75 54 78 41 77', pl.limbf, 13.4, 6.8) +
            hand(73, 78, pl.limbf, 6.2, 5.4, 14) + hand(39, 77, pl.limbf, 6.2, 5.4, -14))
    char = g('an-huff', g('', pl.body() +
             pl.face(eyes='flat', mouth='pout', brows=5.4) + arms,
             tf='rotate(-7 58 62)'))
    return (g('an-steam', steam('M96 30c6-4 3-10-2-12s-6-7-1-10')) +
            g('an-steam an-d2', steam('M108 44c5-4 2-9-2-11', 4.6)) + char)


def a_cheek_kiss():
    ro = rosie(84, 54, 1.02)
    pl = plum(30, 62, .94)
    startled = g('an-startle', ro.feet() + ro.body() +
                 ro.face(eyes='wide', mouth='kiss',
                         extra=blush(ro.cx - .26 * ro.w, ro.cy + .05 * ro.h, 8.4, 5.8, ro.blushc, .95) +
                               blush(ro.cx + .26 * ro.w, ro.cy + .05 * ro.h, 7.6, 5.2, ro.blushc, .95)))
    kisser = g('an-lean',
               g('', pl.feet() + pl.body() + pl.face(eyes='happy', mouth='kiss'),
                 tf='rotate(9 30 62)') + kiss_mark(66, 47, -16))
    return startled + kisser + hearts_above([(104, 26, .8), (94, 11, .58)])


def a_head_pat():
    ro = rosie(38, 78, 1.02)
    pl = plum(90, 56, .9)
    patting = g('an-pat', limb('M82 68 C74 56 62 46 52 42', pl.limbf, 13.0, 6.4) +
                paw(45, 41, pl.limbf, pl.panel, -34, 9.6, 6.0))
    return (g('an-melt', ro.feet() + ro.body() + ro.face(eyes='happy', mouth='smile')) +
            pl.feet() + pl.body() + pl.face(eyes='happy', mouth='smile') +
            patting + sparkles([(12, 54, 4.2), (66, 26, 3.4)]))


def a_forgive_sign():
    r = rosie(60, 84, 1.0)
    x0, y0 = sh(r, -1)
    x1, y1 = sh(r, 1)
    arms = (limb('M%s %s C34 92 33 99 37 103' % (x0, y0), r.limbf, 14.2, 7.0) +
            limb('M%s %s C86 92 87 99 83 103' % (x1, y1), r.limbf, 14.2, 7.0) +
            hand(36, 105, r.limbf, 6.2, 5.4, -18) + hand(84, 105, r.limbf, 6.2, 5.4, 18))
    return (r.feet() + r.body() + arms + g('an-tilt', sign_board(top=4, h=38, post_to=64)) +
            r.face(eyes='sparkle', mouth='wobble'))


def a_sulk_rain():
    ro = rosie(32, 80, .9)
    pl = plum(88, 76, .9)
    x0, y0 = sh(pl, -1)
    reach = (limb('M%s %s C68 84 64 86 61 87' % (x0, y0), pl.limbf, 12.6, 6.2) +
             paw(56, 87, pl.limbf, pl.panel, 14, 7.8, 5.2))
    sulker = g('', ro.feet() + ro.body() + ro.face(eyes='flat', mouth='frown', blush_on=False),
               tf='rotate(-6 32 80)')
    return (g('an-cloud', cloud(33, 20, .92)) + rain_set([25, 33, 41], 40, 9) +
            sulker + pl.feet() + pl.body() + pl.face(eyes='sad', mouth='flat') + reach)


def a_made_up():
    ro = rosie(38, 74, 1.02)
    pl = plum(84, 71, 1.0)
    joined = limb('M52 88 C60 92 68 92 76 88', ro.limbf, 14.6, 7.2)
    return (g('an-cheer', ro.body() + ro.face(eyes='happy', mouth='grin')) +
            g('an-cheer an-d2', pl.body() + pl.face(eyes='happy', mouth='grin')) +
            joined +
            hearts_above([(60, 16, 1.0), (22, 30, .58)]) +
            sparkles([(8, 60, 3.6), (112, 40, 3.4)]))


# ===========================================================================
# PACK B — Clover & Biscuit  (bunny + cat)
# ===========================================================================
def b_begging():
    cat = Biscuit(60, 50, 20.0)
    body = body_ell(60, 86, 23, 16, BISCUIT_F)
    tail = cat_tail(80, 90, 'hook')
    arms = (limb('M45 90 C48 82 52 75 56 73', BISCUIT_F, 14.2, 7.0) +
            limb('M75 90 C72 82 68 75 64 73', BISCUIT_F, 14.2, 7.0) +
            hand(55, 71, BISCUIT_F, 6.0, 5.2, -22) + hand(65, 71, BISCUIT_F, 6.0, 5.2, 22))
    char = g('an-plead', tail + body + cat.whole(back=.5, eyes='wide', mouth='wobble') + arms)
    return sparkles([(18, 46, 4.2), (102, 54, 3.6)]) + g('an-bob an-d2', sweat(99, 32, .85)) + char


def b_waterfall_cry():
    cl = Clover(60, 46, 19.5)
    lx, rx_ = cl.cx - cl.r * .40, cl.cx + cl.r * .40
    ey = cl.cy + cl.r * .02
    body = body_ell(60, 82, 21, 15, CLOVER_F)
    arms = (limb('M43 80 C36 84 34 90 37 94', CLOVER_F, 14.6, 7.2) +
            limb('M77 80 C84 84 86 90 83 94', CLOVER_F, 14.6, 7.2))
    face = cl.whole(spread=.45, droop=.5, eyes='squeeze', mouth='cry')
    streams = (g('an-stream', stream(lx, ey + 5, 38, 6.2)) +
               g('an-stream an-d2', stream(rx_, ey + 5, 38, 6.2)))
    drops = g('an-teardrop', teardrop(24, 48, .78)) + g('an-teardrop an-d3', teardrop(98, 54, .68))
    return puddle(60, 102, 25, 4.6) + g('an-sob', body + arms + face) + streams + drops


def b_big_hug():
    cl = Clover(42, 54, 18.0)
    bi = Biscuit(80, 57, 19.0)
    tail = cat_tail(96, 90, 'curl')
    behind = (limb('M68 86 C56 80 42 79 28 82', BISCUIT_F, 14.6, 7.2) +
              hand(24, 81, BISCUIT_F, 7.0, 6.0, 18) +
              limb('M54 92 C66 88 82 87 96 89', CLOVER_F, 14.6, 7.2) +
              hand(100, 88, CLOVER_F, 7.0, 6.0, -18))
    bodies = (body_ell(43, 91, 20, 14, CLOVER_F) + body_ell(80, 92, 20, 14, BISCUIT_F) +
              cl.whole(spread=.3, droop=.12, eyes='happy', mouth='smile') +
              bi.whole(back=.22, eyes='happy', mouth='smile'))
    front = limb('M68 80 C60 76 50 76 44 79', CLOVER_F, 14.2, 7.0)
    return g('an-squeeze', tail + behind + bodies + front) + hearts_above([(60, 13, .92), (100, 22, .66)])


def b_flowers_shy():
    bi = Biscuit(46, 50, 19.5)
    hx, hy = 86, 76
    body = body_ell(48, 86, 21, 15, BISCUIT_F)
    tail = cat_tail(28, 90, 'curl')
    arm = limb('M64 84 C74 80 80 78 %s %s' % (n(hx - 1), n(hy - 2)), BISCUIT_F, 14.6, 7.2)
    face = bi.whole(back=.2, eyes='happy', mouth='smile',
                    extra=blush(bi.cx - bi.r * .74, bi.cy + bi.r * .30, 7.0, 5.0, '#F2748C', .9) +
                          blush(bi.cx + bi.r * .74, bi.cy + bi.r * .30, 7.0, 5.0, '#F2748C', .9))
    return (g('an-shy', tail + body + face + arm + hand(hx, hy, BISCUIT_F, 6.4, 5.6, -10)) +
            g('an-sway-s', bouquet(hx, hy - 2)) + sparkles([(18, 32, 4.0)]))


def b_pouty():
    bi = Biscuit(52, 46, 20.5)
    body = body_ell(54, 88, 25, 17, BISCUIT_F)
    tail = cat_tail(82, 100, 'puff')
    arms = (limb('M34 78 C44 85 58 89 70 88', BISCUIT_F, 13.4, 6.8) +
            limb('M74 77 C64 84 50 88 38 87', BISCUIT_F, 13.4, 6.8) +
            hand(72, 88, BISCUIT_F, 6.2, 5.4, 14) + hand(36, 87, BISCUIT_F, 6.2, 5.4, -14))
    char = g('an-huff', g('', tail + body +
             bi.whole(back=.85, eyes='flat', mouth='pout', brows=5.0) + arms,
             tf='rotate(-6 54 60)'))
    return (g('an-steam', steam('M94 24c6-4 3-10-2-12s-6-7-1-10')) +
            g('an-steam an-d2', steam('M106 38c5-4 2-9-2-11', 4.6)) + char)


def b_cheek_kiss():
    bi = Biscuit(84, 52, 20.0)
    cl = Clover(30, 60, 18.0)
    startled = g('an-startle',
                 cat_tail(102, 88, 'up') + body_ell(86, 92, 21, 15, BISCUIT_F) +
                 bi.whole(back=.1, eyes='wide', mouth='kiss',
                          extra=blush(bi.cx - bi.r * .78, bi.cy + bi.r * .34, 8.0, 5.6, '#F2748C', .92) +
                                blush(bi.cx + bi.r * .78, bi.cy + bi.r * .34, 7.2, 5.2, '#F2748C', .92)))
    kisser = g('an-lean',
               g('', body_ell(30, 94, 19, 13, CLOVER_F) +
                 cl.whole(spread=.35, droop=.18, eyes='happy', mouth='kiss'),
                 tf='rotate(9 30 64)') + kiss_mark(65, 50, -16))
    return startled + kisser + hearts_above([(106, 26, .78), (97, 10, .56)])


def b_head_pat():
    bi = Biscuit(38, 70, 21.0)
    cl = Clover(92, 58, 16.5)
    patted = g('an-melt', cat_tail(56, 100, 'up') + body_ell(38, 100, 23, 15, BISCUIT_F) +
               bi.whole(back=.2, eyes='happy', mouth='smile'))
    patter = body_ell(92, 96, 19, 15, CLOVER_F) + cl.whole(spread=.3, droop=.05, eyes='happy', mouth='smile')
    patting = g('an-pat', limb('M82 74 C74 60 60 48 48 43', CLOVER_F, 13.0, 6.4) +
                paw(42, 41, CLOVER_F, CLOVER_IN, -34, 9.8, 6.2))
    return patted + patter + patting + sparkles([(10, 52, 4.2), (66, 30, 3.4)])


def b_forgive_sign():
    bi = Biscuit(60, 80, 19.5)
    body = body_ell(60, 106, 24, 15, BISCUIT_F)
    tail = cat_tail(83, 104, 'hook')
    arms = (limb('M43 94 C34 84 42 70 51 65', BISCUIT_F, 14.6, 7.2) +
            limb('M77 94 C86 84 78 70 69 65', BISCUIT_F, 14.6, 7.2))
    return (tail + body + arms + g('an-tilt', sign_board(top=4, h=38, post_to=72)) +
            bi.whole(back=.15, eyes='wide', mouth='wobble'))


def b_sulk_rain():
    bi = Biscuit(32, 68, 17.0)
    cl = Clover(86, 66, 16.5)
    sulker = g('', cat_tail(47, 100, 'droop') + body_ell(32, 98, 20, 13, BISCUIT_F) +
               bi.whole(back=.95, eyes='flat', mouth='flat', blush_on=False), tf='rotate(-5 32 84)')
    reach = limb('M76 92 C70 90 66 91 63 92', CLOVER_F, 13.0, 6.4) + paw(58, 92, CLOVER_F, CLOVER_IN, 12, 8.0, 5.4)
    watcher = body_ell(88, 96, 19, 13, CLOVER_F) + cl.whole(spread=0, droop=.7, eyes='sad', mouth='flat')
    return (g('an-cloud', cloud(33, 18, .86)) + rain_set([25, 33, 41], 36, 9) +
            sulker + watcher + reach)


def b_made_up():
    cl = Clover(36, 56, 18.5)
    bi = Biscuit(84, 60, 19.5)
    tail = cat_tail(95, 92, 'heart')
    joined = limb('M56 96 C62 99 68 99 74 96', CLOVER_F, 14.2, 7.0)
    return (tail +
            g('an-cheer', body_ell(37, 96, 21, 15, CLOVER_F) +
              cl.whole(spread=.4, droop=.08, eyes='happy', mouth='grin')) +
            g('an-cheer an-d2', body_ell(84, 98, 21, 15, BISCUIT_F) +
              bi.whole(back=.1, eyes='happy', mouth='grin')) +
            joined +
            hearts_above([(60, 14, .95), (16, 26, .56)]) +
            sparkles([(6, 62, 3.4), (114, 70, 3.0)]))


PACK_A = {'begging': a_begging, 'waterfall-cry': a_waterfall_cry, 'big-hug': a_big_hug,
          'flowers-shy': a_flowers_shy, 'pouty': a_pouty, 'cheek-kiss': a_cheek_kiss,
          'head-pat': a_head_pat, 'forgive-sign': a_forgive_sign, 'sulk-rain': a_sulk_rain,
          'made-up': a_made_up}

PACK_B = {'begging': b_begging, 'waterfall-cry': b_waterfall_cry, 'big-hug': b_big_hug,
          'flowers-shy': b_flowers_shy, 'pouty': b_pouty, 'cheek-kiss': b_cheek_kiss,
          'head-pat': b_head_pat, 'forgive-sign': b_forgive_sign, 'sulk-rain': b_sulk_rain,
          'made-up': b_made_up}
