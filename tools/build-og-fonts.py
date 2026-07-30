#!/usr/bin/env python3
"""
Build the static TTF files that the Open Graph image renderer needs.

Satori (the engine behind next/og) only understands TTF, OTF and WOFF — not the
WOFF2 files that next/font ships to browsers. It also renders variable fonts at
their default instance, which for our Fraunces subset is a very heavy 900.

So we snapshot one static instance of each face, subset it to the characters a
name or a short line of copy can contain, and drop the result in assets/.

Run from the project root:  python3 tools/build-og-fonts.py
Requires:  pip install fonttools brotli
"""

import os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.subset import Subsetter, Options

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "app", "fonts")
OUT = os.path.join(ROOT, "assets")

# Latin letters, digits, the punctuation our copy uses, and the accented
# characters most likely to show up in a real name.
CHARS = (
    "abcdefghijklmnopqrstuvwxyz"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "0123456789"
    " .,:;!?'\"’‘“”-–—…()&/@+*#%"
    "áàâäãåÁÀÂÄÃÅéèêëÉÈÊËíìîïÍÌÎÏóòôöõÓÒÔÖÕúùûüÚÙÛÜñÑçÇýÿÝøØåÅæÆœŒßšŠžŽ"
    "ăĂąĄćĆčČďĎęĘěĚğĞıİłŁńŃňŇőŐřŘśŚşŞťŤůŮűŰźŹżŻ"
)


def build(src_name, out_name, location, family):
    src = os.path.join(SRC, src_name)
    font = TTFont(src)

    if "fvar" in font:
        font = instancer.instantiateVariableFont(font, location, inplace=False)

    options = Options()
    options.layout_features = ["kern", "liga", "calt", "ccmp", "locl"]
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.notdef_outline = True
    options.recalc_bounds = True
    options.drop_tables += ["DSIG"]

    subsetter = Subsetter(options=options)
    subsetter.populate(text=CHARS)
    subsetter.subset(font)

    os.makedirs(OUT, exist_ok=True)
    dest = os.path.join(OUT, out_name)
    font.flavor = None  # plain TTF, which satori parses fastest
    font.save(dest)
    print(f"{family:22} {out_name:28} {os.path.getsize(dest) / 1024:6.1f} KB")


if __name__ == "__main__":
    # opsz 72 keeps the display cut; SOFT/WONK are the Fraunces character axes.
    build(
        "fraunces-latin-full-normal.woff2",
        "Fraunces-Display.ttf",
        {"opsz": 72, "wght": 700, "SOFT": 40, "WONK": 1},
        "Fraunces 700",
    )
    build(
        "nunito-latin-wght-normal.woff2",
        "Nunito-SemiBold.ttf",
        {"wght": 700},
        "Nunito 700",
    )
