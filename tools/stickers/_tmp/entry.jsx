import ReactDOMServer from 'react-dom/server';
import fs from 'node:fs';
import { PACKS } from '../../../app/components/stickers';

const out = {};
const missing = [];
for (const pack of PACKS) {
  for (const s of pack.stickers) {
    if (!s.Comp) { missing.push(s.id); continue; }
    out[s.id] = ReactDOMServer.renderToStaticMarkup(<s.Comp />);
  }
}
fs.writeFileSync('/tmp/stk/stickers.json', JSON.stringify(out));
console.log('rendered', Object.keys(out).length, 'missing', missing.length, missing.join(','));
