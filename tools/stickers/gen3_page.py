#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Builds /home/claude/sticker-samples-3.html — same sheet format as sheet 2."""

import io
from gen2_page import CSS, svg
from gen3_poses import POSES, LABELS, PACK_C, PACK_D

EXTRA_CSS = """
@keyframes boop{0%,100%{transform:translateX(0) rotate(0)}50%{transform:translateX(3px) rotate(2deg)}}
.an-boop{animation:boop 2.2s var(--ease) infinite;transform-origin:50% 100%}
"""

PACKS = [
    dict(key='c', title='Mochi &amp; Bao 🐼', tag='Pack C · cuter',
         who='Mochi — white panda, tilted teardrop patches. Bao — bigger, cream-tinted, rounder patches, rose inner ears.',
         blurb='The chunkier direction. Heads are now roughly 58% of the whole character and wider '
               'than the body, the bodies are little beans, and the limbs are barely stubs. The risk '
               'with pandas is the dark eye patches swallowing the eyes, so the eyes are drawn ON the '
               'patch with a cream sclera behind a plum pupil and two glints — at 72px they still '
               'read as eyes rather than as holes.',
         data=PACK_C),
    dict(key='d', title='Poppy &amp; Truffle 🐷', tag='Pack D · cuter',
         who='Poppy — soft pink, perky ears, round snout, tight curly tail. Truffle — bigger, dusty mauve, floppy ears.',
         blurb='The snouts do the acting: they scrunch wide and flat when the pigs are pouty or '
               'crying, and in the cheek-kiss Poppy leans in and boops Truffle with hers instead of '
               'using a lip mark. The curly tails are the second voice — they uncurl and hang in '
               'sulk &amp; rain, and spring up tight when everyone has made up.',
         data=PACK_D),
]


def build():
    out = io.StringIO()
    out.write('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n')
    out.write('<meta name="viewport" content="width=device-width, initial-scale=1">\n')
    out.write('<title>Truce — the cuter sticker couples</title>\n<style>%s%s</style>\n</head>\n<body>\n'
              % (CSS, EXTRA_CSS))
    out.write('<div class="wrap">\n  <header>\n    <span class="eyebrow">Sample sheet 3</span>\n')
    out.write('    <h1>Cuter, chunkier, squishier 🐼🐷</h1>\n')
    out.write('    <p>Two more couples in the same ten beats, re-proportioned for maximum softness: '
              'bigger heads, much bigger glossy eyes sat low and wide, tiny stubby limbs and more '
              'squash in every pose. Same plum ink and house palette as sheets one and two, so all '
              'four packs still read as one family. Inline SVG only — the loops switch themselves '
              'off for <em>prefers-reduced-motion</em>.</p>\n  </header>\n')

    for pk in PACKS:
        out.write('\n<section class="pack">\n  <div class="pack-head"><h2>%s</h2>'
                  '<span class="tag">%s</span></div>\n' % (pk['title'], pk['tag']))
        out.write('  <p class="who" style="margin:0 0 6px;color:var(--plum-soft);font-size:.9rem">%s</p>\n'
                  % pk['who'])
        out.write('  <p class="blurb">%s</p>\n' % pk['blurb'])
        out.write('  <div class="grid">')
        for p in POSES:
            inner = pk['data'][p]()
            out.write('<figure class="card" data-sticker="%s-%s">%s'
                      '<figcaption class="name">%s</figcaption></figure>'
                      % (pk['key'], p, svg(inner, 150, p), LABELS[p]))
        out.write('</div>\n')
        out.write('  <h3>How they read at 72px</h3>\n')
        out.write('  <p class="sub">Actual size in a chat bubble — the silhouette has to carry it.</p>\n')
        out.write('  <div class="strip">')
        for p in POSES:
            inner = pk['data'][p]()
            out.write('<div data-small="%s-%s">%s</div>' % (pk['key'], p, svg(inner, 72, p)))
        out.write('</div>\n</section>\n')

    out.write('\n  <footer>Truce — sticker studies, sheet three. '
              'Mochi &amp; Bao, Poppy &amp; Truffle. 🤍</footer>\n</div>\n</body>\n</html>\n')
    return out.getvalue()


if __name__ == '__main__':
    html = build()
    open('/home/claude/sticker-samples-3.html', 'w', encoding='utf-8').write(html)
    print('wrote', len(html), 'bytes')
