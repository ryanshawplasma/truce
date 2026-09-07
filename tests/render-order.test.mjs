import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * A hook's dependency array must not name a `const` declared below it.
 *
 * WHY THIS TEST EXISTS
 * --------------------
 * "Our corner" was unopenable for days. Creating one worked, the cookie was
 * kept, the session verified — and then /couple/room answered 500 to every
 * request, which from the outside looked exactly like a sign-in the browser
 * had thrown away. Three theories and two shipped fixes went at the cookie.
 * The cookie was fine. The server log said:
 *
 *     ReferenceError: Cannot access 'markRead' before initialization
 *
 * markRead was a useCallback declared four hundred lines below two hooks that
 * named it in their dependency arrays. A dependency array is an expression
 * evaluated DURING the render — unlike the callback beside it, which runs
 * later — so it read a `const` that was still in its temporal dead zone. Every
 * render threw. Every render had always thrown.
 *
 * Nothing caught it. `next build` compiles each module without executing it;
 * the whole test suite is pure logic that never renders a component. The code
 * was syntactically perfect and semantically dead, and the only signal was a
 * production 500.
 *
 * WHAT IT CHECKS
 * --------------
 * For every dependency array in every component: each plain identifier in it
 * must not be declared by a later `const`/`let` in the same component. That is
 * the exact shape of the bug and it cannot false-positive on hoisted things —
 * imports, props and `function` declarations are all reachable from anywhere,
 * so they simply never match a later declaration.
 *
 * It is a text scan rather than a real render because this suite has no JSX
 * transform and earns its keep by needing no dependencies. A scan that catches
 * the bug that actually shipped is worth more than a renderer that might.
 */

const ROOT = path.resolve(import.meta.dirname, '..');

function componentFiles() {
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.jsx')) out.push(full);
    }
  })(path.join(ROOT, 'app'));
  return out;
}

/**
 * Where each top-level function in the file begins.
 *
 * Needed because a name can legitimately appear twice: Wizard.jsx takes a prop
 * called `start` and, six hundred lines later, a different function declares a
 * local `const start` for a cursor position. Comparing across that boundary
 * reported a bug that does not exist, so the scan only ever compares a
 * dependency array with declarations from its own function.
 */
function blockStarts(lines) {
  const starts = [0];
  lines.forEach((line, i) => {
    if (/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s/.test(line)) starts.push(i + 1);
    else if (/^(?:export\s+)?(?:default\s+)?const\s+[A-Za-z_$][\w$]*\s*=/.test(line)) starts.push(i + 1);
  });
  return starts;
}

const blockOf = (starts, line) => starts.filter((s) => s <= line).pop();

/**
 * Declarations in a component's OWN body, with the line they appear on.
 *
 * Exactly two spaces of indent, which in this codebase means "directly inside a
 * top-level function". Anything deeper belongs to a nested function or a block,
 * where it is a different binding and cannot be the one a dependency array
 * up here is naming.
 */
function declarations(lines) {
  const at = new Map();
  const starts = blockStarts(lines);
  const remember = (name, line) => {
    if (!name) return;
    const key = `${blockOf(starts, line)}:${name}`;
    if (!at.has(key)) at.set(key, line);
  };

  lines.forEach((line, i) => {
    const n = i + 1;
    if (!/^ {2}(?:const|let)\s/.test(line)) return;

    let m = line.match(/^ {2}(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/);
    if (m) remember(m[1], n);

    /* Destructured: const [a, setA] = useState(), const { x } = props */
    m = line.match(/^ {2}(?:const|let)\s*[[{]([^\]}]*)[\]}]\s*=/);
    if (m) {
      for (const piece of m[1].split(',')) {
        remember(piece.trim().split(':').pop().trim().replace(/[^\w$].*$/, ''), n);
      }
    }
  });

  return { at, starts };
}

/**
 * Dependency arrays, as (line, identifier) pairs.
 *
 * Only bare identifiers count. `a.b` is a member expression whose ONLY
 * temporal-dead-zone risk is `a`, which the regex captures on its own, and
 * string literals and numbers cannot be bindings at all.
 */
function dependencyRefs(lines) {
  const refs = [];
  lines.forEach((line, i) => {
    const m = line.match(/^ {2}\},\s*\[(.*)\]\s*\)\s*;?\s*$/);
    if (!m || !m[1].trim()) return;
    for (const piece of m[1].split(',')) {
      const name = piece.trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) refs.push({ line: i + 1, name });
    }
  });
  return refs;
}

test('no hook dependency names a const declared below it', () => {
  const offences = [];

  for (const file of componentFiles()) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const { at, starts } = declarations(lines);

    for (const { line, name } of dependencyRefs(lines)) {
      const declared = at.get(`${blockOf(starts, line)}:${name}`);
      if (declared !== undefined && declared > line) {
        offences.push(
          `${path.relative(ROOT, file)}: '${name}' is used in the dependency ` +
            `array on line ${line} but declared on line ${declared}`,
        );
      }
    }
  }

  assert.deepEqual(offences, []);
});

test('the scan finds the shape of the bug it was written for', () => {
  /* The check is only worth having if it fires. This is the real thing,
     reduced: a callback named in a dependency array above its own const. */
  const broken = [
    'export default function Room() {',
    '  useEffect(() => {',
    '    markRead(1);',
    '  }, [messages, markRead]);',
    '',
    '  const markRead = useCallback(() => {}, []);',
    '}',
  ];

  const { at, starts } = declarations(broken);
  const refs = dependencyRefs(broken);

  assert.deepEqual(refs, [
    { line: 4, name: 'messages' },
    { line: 4, name: 'markRead' },
  ]);
  assert.equal(at.get(`${blockOf(starts, 4)}:markRead`), 6, 'declared below the array naming it');

  /* And it must stay quiet about the identifier that is genuinely fine:
     `messages` here is a prop, so it has no declaration in the body at all. */
  assert.equal(at.get(`${blockOf(starts, 4)}:messages`), undefined);
});

test('a same-named local in another function is not mistaken for the bug', () => {
  /* Reduced from the one false positive this scan produced when it ignored
     scope: Wizard takes a prop called `start`, and a different function far
     below declares its own `start` for a cursor position. Nothing is wrong,
     and a check that cries wolf here is a check people learn to skip. */
  const fine = [
    'export default function Wizard({ start = null }) {',
    '  useEffect(() => {',
    '    if (!start) return;',
    '  }, [start]);',
    '}',
    '',
    'function insertEmoji(field) {',
    '  const start = field.selectionStart;',
    '  return start;',
    '}',
  ];

  const { at, starts } = declarations(fine);
  const [ref] = dependencyRefs(fine);

  assert.deepEqual(ref, { line: 4, name: 'start' });
  assert.equal(at.get(`${blockOf(starts, 4)}:start`), undefined, 'the prop has no later twin here');
  assert.equal(at.get(`${blockOf(starts, 8)}:start`), 8, 'the local belongs to the other function');
});
