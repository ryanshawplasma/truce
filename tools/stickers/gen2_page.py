#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Builds /home/claude/sticker-samples-2.html from the pose generators."""

import io
from gen2_poses import POSES, LABELS, PACK_A, PACK_B

CSS = """
:root{
  --cream:#FFF7F2; --plum:#3D2137; --plum-mid:#6B4E63; --plum-soft:#785A72;
  --rose:#E85D75; --rose-deep:#B03A54; --gold:#F2B880; --line:rgba(61,33,55,.10);
  --ease:cubic-bezier(.22,.61,.36,1);
}
*{box-sizing:border-box}
body{
  margin:0;background:var(--cream);color:var(--plum);
  font-family:"Nunito","Avenir Next","Segoe UI",system-ui,-apple-system,Arial,sans-serif;
  line-height:1.6;-webkit-font-smoothing:antialiased;
}
.wrap{max-width:1080px;margin:0 auto;padding:34px 22px 60px}
header{text-align:center;margin-bottom:30px}
.eyebrow{
  display:inline-block;font-size:.72rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;
  color:var(--rose-deep);background:rgba(255,228,233,.75);border:1px solid rgba(232,93,117,.2);
  padding:6px 14px;border-radius:999px;margin-bottom:14px;
}
h1{
  font-family:Georgia,"Iowan Old Style",serif;font-size:clamp(1.7rem,4.6vw,2.5rem);
  margin:0 0 8px;letter-spacing:-.02em;
}
header p{margin:0 auto;max-width:560px;color:var(--plum-mid);font-size:.98rem}
.pack{margin-top:46px}
.pack-head{
  display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;
  border-top:1px solid var(--line);padding-top:26px;margin-bottom:6px;
}
.pack-head h2{
  font-family:Georgia,serif;font-size:1.5rem;margin:0;letter-spacing:-.01em;
}
.pack-head .tag{
  font-size:.72rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;
  color:var(--rose-deep);background:rgba(255,228,233,.8);padding:5px 12px;border-radius:999px;
}
.pack-head .who{color:var(--plum-soft);font-size:.9rem;margin:0}
.pack > p.blurb{color:var(--plum-mid);font-size:.95rem;margin:0 0 18px;max-width:620px}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(198px,1fr))}
.card{
  background:#fff;border:1px solid var(--line);border-radius:22px;
  padding:14px 10px 12px;text-align:center;
  box-shadow:0 6px 18px rgba(61,33,55,.07);
  display:flex;flex-direction:column;justify-content:space-between;
}
.card .stk{display:block;margin:0 auto;width:100%;height:auto;max-width:172px}
.name{
  margin:8px 0 0;font-size:.78rem;font-weight:800;letter-spacing:.09em;
  text-transform:uppercase;color:var(--plum-soft);
}
h3{
  font-family:Georgia,serif;font-size:1.1rem;margin:30px 0 4px;text-align:center;letter-spacing:-.01em;
  font-weight:normal;
}
.sub{text-align:center;color:var(--plum-soft);font-size:.85rem;margin:0 0 16px}
.strip{
  display:flex;flex-wrap:wrap;gap:10px;justify-content:center;
  background:#fff;border:1px solid var(--line);border-radius:22px;padding:16px;
  box-shadow:0 6px 18px rgba(61,33,55,.06);
}
.strip .stk{display:block;width:72px;height:72px;flex:0 0 72px}
footer{text-align:center;color:var(--plum-soft);font-size:.82rem;margin-top:40px}
.hand{
  font-family:"Bradley Hand","Segoe Print","Comic Sans MS",Georgia,serif;
  font-style:italic;font-weight:700;
}

/* ---- the little loops ---------------------------------------------------- */
/* Only the animated groups need fill-box; applying it to every node breaks the
   origin of SVG transform="rotate(a cx cy)" attributes (hands, paws, tilts). */
.stk [class*="an-"]{transform-box:fill-box}
@keyframes plead{0%,100%{transform:translateY(0) rotate(-1.5deg)}50%{transform:translateY(-2px) rotate(1.5deg)}}
.an-plead{animation:plead 2.6s var(--ease) infinite;transform-origin:50% 100%}
@keyframes teardrop{0%{transform:translateY(-4px) scale(.5);opacity:0}25%{transform:translateY(0) scale(1);opacity:1}
  75%{transform:translateY(16px) scale(1);opacity:1}100%{transform:translateY(26px) scale(.6);opacity:0}}
.an-teardrop{animation:teardrop 2.4s var(--ease) infinite}
@keyframes stream{0%{transform:translateY(-6px) scaleY(.9)}100%{transform:translateY(6px) scaleY(1.06)}}
.an-stream{animation:stream .55s linear infinite alternate;transform-origin:50% 0%}
@keyframes sob{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-3px) rotate(2deg)}}
.an-sob{animation:sob 1.1s var(--ease) infinite;transform-origin:50% 100%}
@keyframes squeeze{0%,100%{transform:scale(1)}50%{transform:scale(1.045,.965)}}
.an-squeeze{animation:squeeze 2.4s var(--ease) infinite;transform-origin:50% 90%}
@keyframes bob{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-5px) scale(1.08)}}
.an-bob{animation:bob 2.4s var(--ease) infinite;transform-origin:50% 100%}
@keyframes shy{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
.an-shy{animation:shy 3.2s var(--ease) infinite;transform-origin:50% 100%}
@keyframes swaysmall{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
.an-sway-s{animation:swaysmall 3s var(--ease) infinite;transform-origin:50% 100%}
@keyframes steam{0%{transform:translateY(4px) scale(.7);opacity:0}30%{opacity:.9}
  100%{transform:translateY(-12px) scale(1.15);opacity:0}}
.an-steam{animation:steam 2.2s var(--ease) infinite}
@keyframes huff{0%,100%{transform:scale(1)}45%{transform:scale(1.04,.97)}}
.an-huff{animation:huff 1.8s var(--ease) infinite;transform-origin:50% 100%}
@keyframes lean{0%,100%{transform:translateX(0)}50%{transform:translateX(2.5px)}}
.an-lean{animation:lean 2.2s var(--ease) infinite;transform-origin:50% 100%}
@keyframes startle{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
.an-startle{animation:startle 2.2s var(--ease) infinite;transform-origin:50% 100%}
@keyframes pat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.an-pat{animation:pat 1.4s var(--ease) infinite}
@keyframes melt{0%,100%{transform:translateY(0) scaleY(1)}50%{transform:translateY(1.5px) scaleY(.985)}}
.an-melt{animation:melt 2.6s var(--ease) infinite;transform-origin:50% 100%}
@keyframes tilt{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
.an-tilt{animation:tilt 3s var(--ease) infinite;transform-origin:50% 100%}
@keyframes cloudy{0%,100%{transform:translateX(-3px)}50%{transform:translateX(3px)}}
.an-cloud{animation:cloudy 3.4s var(--ease) infinite}
@keyframes rain{0%{transform:translateY(-4px);opacity:0}25%{opacity:1}100%{transform:translateY(20px);opacity:0}}
.an-rain{animation:rain 1.3s linear infinite}
@keyframes cheer{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-4px) rotate(2deg)}}
.an-cheer{animation:cheer 2.2s var(--ease) infinite;transform-origin:50% 100%}
@keyframes twinkle{0%,100%{transform:scale(.7);opacity:.45}50%{transform:scale(1.15);opacity:1}}
.an-twinkle{animation:twinkle 2.2s var(--ease) infinite;transform-origin:50% 50%}
.an-d2{animation-delay:.45s}
.an-d3{animation-delay:.9s}

@media (prefers-reduced-motion:reduce){
  [class*="an-"]{animation:none !important}
}
"""

PACKS = [
    dict(key='a', title='Rosie &amp; Plum 💕', tag='Pack A · on-brand',
         who='Rosie — rose heart. Plum — deep-plum heart, a little bigger.',
         blurb='The house pack: the logo is a bandaged heart, so the mascots are hearts too. '
               'No ears, no tails — every ounce of feeling comes from the face, the stubby arms '
               'and how much the body squashes or tilts. Plum carries a lighter inner face panel '
               'so the eyes and blush still read against the deep fill.',
         data=PACK_A),
    dict(key='b', title='Clover &amp; Biscuit 🐰🐱', tag='Pack B · classic cute',
         who='Clover — cream bunny with one flopped ear. Biscuit — caramel cat with a talking tail.',
         blurb='The softer, more familiar pack. Clover keeps the bunny silhouette but rounder in the '
               'cheeks, with one ear tip permanently flopped so she is never mistaken for Pip. '
               'Biscuit does half his acting with his tail: it droops when he sulks, puffs when he is '
               'cross, and curls into a heart once everyone has made up.',
         data=PACK_B),
]


def svg(inner, size, label, cls='stk'):
    return ('<svg viewBox="0 0 120 120" width="%d" height="%d" class="%s" xmlns="http://www.w3.org/2000/svg"'
            ' role="img" aria-label="%s">%s</svg>' % (size, size, cls, label, inner))


def build():
    out = io.StringIO()
    out.write('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n')
    out.write('<meta name="viewport" content="width=device-width, initial-scale=1">\n')
    out.write('<title>Truce — two more sticker couples</title>\n<style>%s</style>\n</head>\n<body>\n' % CSS)
    out.write('<div class="wrap">\n  <header>\n    <span class="eyebrow">Sample sheet 2</span>\n')
    out.write('    <h1>Pick your couple 💕🐰🐱</h1>\n')
    out.write('    <p>Two more casts, staged in exactly the same ten emotional beats as Momo &amp; Pip, '
              'so any pack can be swapped in behind the same card moments. Everything is inline SVG — '
              'no images, no fonts to load, and the loops switch themselves off for '
              '<em>prefers-reduced-motion</em>.</p>\n  </header>\n')

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

    out.write('\n  <footer>Truce — sticker studies, sheet two. '
              'Rosie &amp; Plum, Clover &amp; Biscuit. 🤍</footer>\n</div>\n</body>\n</html>\n')
    return out.getvalue()


if __name__ == '__main__':
    html = build()
    open('/home/claude/sticker-samples-2.html', 'w', encoding='utf-8').write(html)
    print('wrote', len(html), 'bytes')
