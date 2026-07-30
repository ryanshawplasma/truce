import * as esbuild from '/tmp/stk/node_modules/esbuild/lib/main.js';
import path from 'node:path';
const ROOT = '/home/claude/truce-app';
const alias = {
  name: 'at-alias',
  setup(b) {
    b.onResolve({ filter: /^@\// }, (a) => ({ path: path.join(ROOT, a.path.slice(2)) }));
  },
};
await esbuild.build({
  entryPoints: [path.join(ROOT, 'tools/stickers/_tmp/entry.jsx')],
  outfile: path.join(ROOT, 'tools/stickers/_tmp/out.mjs'),
  bundle: true, format: 'esm', platform: 'node', target: 'node20',
  jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment',
  inject: [path.join(ROOT, 'tools/stickers/_tmp/shim.js')],
  external: ['react', 'react-dom', 'react-dom/server'],
  loader: { '.js': 'jsx' },
  logLevel: 'warning',
});
console.log('bundled');
