# Sticker toolchain

The five **couple packs** in `app/components/stickers/` are generated, not
hand-written. This folder holds everything needed to regenerate them, so the
drawings can never drift from their source.

```
python3 tools/stickers/gen_pack_jsx.py
```

That rewrites `app/components/stickers/{momo-pip,rosie-plum,clover-biscuit,
mochi-bao,poppy-truffle}.jsx`. Nothing else in the app is touched.

## What's here

| File | What it is |
| --- | --- |
| `gen2_rig.py` | Shared drawing primitives and palette (limbs, hands, blush, eyes). |
| `gen2_poses.py` | The ten poses for Rosie & Plum (`PACK_A`) and Clover & Biscuit (`PACK_B`). |
| `gen3_rig.py` | The "cuter" rig — bigger heads, glossy eyes — built on `gen2_rig`. |
| `gen3_poses.py` | The ten poses for Mochi & Bao (`PACK_C`) and Poppy & Truffle (`PACK_D`). |
| `gen2_page.py`, `gen3_page.py` | Build the standalone review sheets (handy when drawing new poses). |
| `sheet-1.html` | The rendered Momo & Pip sheet; the generator parses its inline SVG. |
| `gen_pack_jsx.py` | Transcribes all of the above into JSX components. |

## Notes

- The transcription is mechanical — the generator refuses to run if it meets an
  SVG tag or attribute it does not already know how to convert, so a silent
  mistranslation is not possible.
- The **classics** pack (`app/components/stickers/classics.jsx`) is hand-drawn
  and hand-maintained. It is not generated; edit it directly.
- Sticker ids are `<pack>/<pose>` (the classics keep bare ids for backwards
  compatibility). Adding a pose means adding it to `POSES` here **and** to
  `STICKER_PACKS` in `lib/constants.js`.
- The `an-*` classes the generator emits are the motion loops; their keyframes
  live in `app/globals.css` and switch off under `prefers-reduced-motion`.
