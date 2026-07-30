#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Emit React (JSX) sticker components for the five couple packs.

Sources
  momo-pip        sheet 1  -> parsed out of tools/stickers/sheet-1.html
  rosie-plum      sheet 2  -> gen2_poses.PACK_A
  clover-biscuit  sheet 2  -> gen2_poses.PACK_B
  mochi-bao       sheet 3  -> gen3_poses.PACK_C
  poppy-truffle   sheet 3  -> gen3_poses.PACK_D

The drawings are static, so each pose becomes a plain function component that
renders the same nodes the sample sheets rendered. Nothing is re-drawn here;
this is a mechanical SVG -> JSX transcription so the geometry cannot drift.

Writes  app/components/stickers/<pack>.jsx

Run from anywhere:  python3 tools/stickers/gen_pack_jsx.py
"""

import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

from gen2_poses import PACK_A, PACK_B, POSES, LABELS          # noqa: E402
from gen3_poses import PACK_C, PACK_D                          # noqa: E402

OUT_DIR = os.path.join(REPO, 'app', 'components', 'stickers')
SHEET1 = os.path.join(HERE, 'sheet-1.html')

# --------------------------------------------------------------------------- #
# pack definitions
# --------------------------------------------------------------------------- #
PACK_DEFS = [
    dict(id='momo-pip', name='Momo & Pip', emoji='🐻',
         who='Bear and bunny — the original couple from sheet one.'),
    dict(id='rosie-plum', name='Rosie & Plum', emoji='💕',
         who='Two little hearts with arms; the most on-brand of the couples.'),
    dict(id='clover-biscuit', name='Clover & Biscuit', emoji='🐰',
         who='Bunny and cat, classic-cute proportions.'),
    dict(id='mochi-bao', name='Mochi & Bao', emoji='🐼',
         who='Panda couple, chunkier heads and glossy eyes.'),
    dict(id='poppy-truffle', name='Poppy & Truffle', emoji='🐷',
         who='Pig couple; the snouts and curly tails do the acting.'),
]


def momo_pack():
    """Pull the ten sheet-1 stickers straight out of the rendered sample sheet."""
    html = open(SHEET1, encoding='utf-8').read()
    found = {}
    for m in re.finditer(r'<figure class="card" data-sticker="([a-z-]+)">(<svg.*?</svg>)', html, re.S):
        inner = re.sub(r'^<svg[^>]*>', '', m.group(2))
        inner = re.sub(r'</svg>$', '', inner)
        found[m.group(1)] = inner
    missing = [p for p in POSES if p not in found]
    if missing:
        raise SystemExit('sheet 1 is missing poses: %s' % missing)
    return {p: found[p] for p in POSES}


SOURCES = {
    'momo-pip': momo_pack,
    'rosie-plum': lambda: {p: PACK_A[p]() for p in POSES},
    'clover-biscuit': lambda: {p: PACK_B[p]() for p in POSES},
    'mochi-bao': lambda: {p: PACK_C[p]() for p in POSES},
    'poppy-truffle': lambda: {p: PACK_D[p]() for p in POSES},
}

# --------------------------------------------------------------------------- #
# SVG -> JSX
# --------------------------------------------------------------------------- #
# Every hyphenated SVG attribute that appears in the generated markup. Anything
# not on this list is passed through unchanged (cx, cy, d, fill, opacity, …).
ATTR_MAP = {
    'class': 'className',
    'stroke-width': 'strokeWidth',
    'stroke-linecap': 'strokeLinecap',
    'stroke-linejoin': 'strokeLinejoin',
    'stroke-dasharray': 'strokeDasharray',
    'stroke-opacity': 'strokeOpacity',
    'fill-opacity': 'fillOpacity',
    'fill-rule': 'fillRule',
    'clip-rule': 'clipRule',
    'clip-path': 'clipPath',
    'text-anchor': 'textAnchor',
    'font-size': 'fontSize',
    'font-family': 'fontFamily',
    'font-weight': 'fontWeight',
    'font-style': 'fontStyle',
    'letter-spacing': 'letterSpacing',
    'dominant-baseline': 'dominantBaseline',
    'stop-color': 'stopColor',
    'stop-opacity': 'stopOpacity',
}

ATTR_RE = re.compile(r'([a-zA-Z:-]+)\s*=\s*"([^"]*)"')
TOKEN_RE = re.compile(r'<[^>]+>|[^<]+')

ALLOWED_TAGS = {'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polygon',
                'polyline', 'text', 'tspan', 'defs', 'clipPath', 'use'}


def convert_attrs(raw):
    """Rewrite an attribute string into JSX form."""
    out = []
    for m in ATTR_RE.finditer(raw):
        name, value = m.group(1), m.group(2)
        if name not in ATTR_MAP and '-' in name:
            raise SystemExit('unmapped hyphenated attribute: %r' % name)
        if ':' in name:
            raise SystemExit('namespaced attribute needs a decision: %r' % name)
        out.append('%s="%s"' % (ATTR_MAP.get(name, name), value))
    leftovers = ATTR_RE.sub('', raw).strip()
    if leftovers not in ('', '/'):
        raise SystemExit('unparsed attribute text: %r' % leftovers)
    return out


def to_jsx(inner, base_indent):
    """Transcribe SVG markup to indented JSX children."""
    lines = []
    depth = 0
    text_buf = None          # set while we are inside a <text> element

    def pad():
        return ' ' * (base_indent + depth * 2)

    for tok in TOKEN_RE.findall(inner):
        if not tok.startswith('<'):
            if text_buf is not None:
                text_buf.append(tok)
            elif tok.strip():
                raise SystemExit('stray text outside <text>: %r' % tok[:60])
            continue

        if tok.startswith('</'):
            tag = tok[2:-1].strip()
            if tag == 'text':
                body = ''.join(text_buf or []).strip()
                lines[-1] = lines[-1][:-3] + '>' + body + '</text>'
                text_buf = None
                continue
            depth -= 1
            lines.append('%s</%s>' % (pad(), tag))
            continue

        body = tok[1:-1]
        self_closing = body.endswith('/')
        if self_closing:
            body = body[:-1]
        parts = body.split(None, 1)
        tag = parts[0]
        if tag not in ALLOWED_TAGS:
            raise SystemExit('unexpected tag: %r' % tag)
        attrs = convert_attrs(parts[1] if len(parts) > 1 else '')

        if self_closing:
            lines.append('%s<%s%s />' % (pad(), tag, ''.join(' ' + a for a in attrs)))
        elif tag == 'text':
            # kept on one line; the closing handler splices the body back in
            lines.append('%s<%s%s />' % (pad(), tag, ''.join(' ' + a for a in attrs)))
            text_buf = []
        else:
            lines.append('%s<%s%s>' % (pad(), tag, ''.join(' ' + a for a in attrs)))
            depth += 1

    if depth != 0:
        raise SystemExit('unbalanced markup (depth %d)' % depth)
    return '\n'.join(lines)


HAND_RE = re.compile(
    r'(<rect [^>]*?width="([\d.]+)"[^>]*/>\s*\n\s*<text )([^>]*className="hand"[^>]*?)fontSize="[\d.]+"')

# Rough advance width of "forgive me?" in the app's display face, in em.
# Used to pick a font size that lands close to the target width so the
# textLength correction below stays visually tiny.
HAND_EM = 5.8


def fit_hand_text(src):
    """Make the "forgive me?" sign lettering fit its board, in any font.

    The sample sheets set this in a system handwriting stack; the app renders it
    in Fraunces italic, which is wider, so the words overflowed the sign. Pin the
    run to the sign's inner width with textLength/lengthAdjust — that is
    font-independent, so it also survives the next/font fallback.
    """
    def repl(m):
        head, width, attrs = m.group(1), float(m.group(2)), m.group(3)
        target = round(width - 18, 1)          # ~9px of padding inside each edge
        size = round(target / HAND_EM, 1)
        return '%s%sfontSize="%s" textLength="%s" lengthAdjust="spacingAndGlyphs"' % (
            head, attrs, size, target)

    src, n = HAND_RE.subn(repl, src)
    return src, n


def comp_name(pack_id, pose):
    """momo-pip + big-hug -> MomoPipBigHug"""
    bits = re.split(r'[^a-zA-Z0-9]+', '%s-%s' % (pack_id, pose))
    return ''.join(b[:1].upper() + b[1:] for b in bits if b)


def build_pack(pack):
    pid = pack['id']
    data = SOURCES[pid]()
    out = io.StringIO()
    out.write('/* eslint-disable */\n')
    out.write("'use client';\n\n")
    out.write('/**\n * %s %s — %s\n *\n' % (pack['name'], pack['emoji'], pack['who']))
    out.write(' * AUTO-GENERATED by tools/stickers/gen_pack_jsx.py. Do not edit by hand:\n')
    out.write(' * re-run the generator instead, or the drawings drift from the sheets.\n')
    out.write(' *\n * Ten poses, one 120x120 board each, house palette and plum ink. The\n')
    out.write(' * `an-*` classes are the little motion loops; they live in globals.css and\n')
    out.write(' * switch themselves off under prefers-reduced-motion.\n */\n\n')
    out.write("import { Board } from './board';\n\n")

    for pose in POSES:
        name = comp_name(pid, pose)
        out.write('/* %s — %s */\n' % (LABELS[pose], '%s/%s' % (pid, pose)))
        out.write('export function %s(props) {\n' % name)
        out.write('  return (\n    <Board {...props}>\n')
        out.write(to_jsx(data[pose], 6))
        out.write('\n    </Board>\n  );\n}\n\n')

    out.write('/* id -> component, ready for the registry in ./index.jsx */\n')
    out.write('export const COMPONENTS = {\n')
    for pose in POSES:
        out.write("  '%s/%s': %s,\n" % (pid, pose, comp_name(pid, pose)))
    out.write('};\n\nexport default COMPONENTS;\n')
    return out.getvalue()


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    total = 0
    for pack in PACK_DEFS:
        src = build_pack(pack)
        src, fixed = fit_hand_text(src)
        if fixed != 1:
            raise SystemExit('%s: expected 1 hand-lettered sign, fitted %d' % (pack['id'], fixed))
        path = os.path.join(OUT_DIR, '%s.jsx' % pack['id'])
        open(path, 'w', encoding='utf-8').write(src)
        total += len(src)
        print('wrote %-34s %6.1f KB  (%d poses)' % (path, len(src) / 1024, len(POSES)))
    print('total %.1f KB of generated JSX' % (total / 1024))

    # metadata block for lib/constants.js — printed so it can be pasted/checked
    print('\n--- pack metadata ---')
    for pack in PACK_DEFS:
        print("%s | %s %s | %s" % (pack['id'], pack['emoji'], pack['name'],
                                   ', '.join('%s/%s' % (pack['id'], p) for p in POSES[:2]) + ', …'))


if __name__ == '__main__':
    main()
