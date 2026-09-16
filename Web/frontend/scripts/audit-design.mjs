import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const root = 'Web/frontend/src';
const tracked = execFileSync('git', ['ls-files', 'Web/frontend/src'], {
  encoding: 'utf8',
})
  .trim()
  .split('\n');
const before = (p) =>
  execFileSync('git', ['show', `HEAD:${p}`], { encoding: 'utf8' });
const normalize = (s) => s.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
const canonical = (s) =>
  ts
    .createPrinter()
    .printFile(
      ts.createSourceFile(
        'file.tsx',
        s,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      ),
    );
function contracts(source) {
  const ast = ts.createSourceFile(
    'file.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const fields = [],
    headings = [],
    links = [];
  const clean = (node) =>
    node
      .getText(ast)
      .replace(/\s+/g, ' ')
      .replace(/='([^']*)'/g, '="$1"')
      .trim();
  function walk(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'register'
    ) {
      fields.push(`register(${node.arguments.map(clean).join(', ')})`);
    }
    if (
      ts.isJsxAttribute(node) &&
      ['name', 'id', 'href', 'to', 'action', 'method'].includes(
        node.name.getText(ast),
      )
    ) {
      if (node.name.getText(ast) === 'name') fields.push(clean(node));
      else links.push(clean(node));
    }
    if (
      ts.isJsxElement(node) &&
      /^h[1-6]$/.test(node.openingElement.tagName.getText(ast))
    )
      headings.push(node.children.map(clean).join(' '));
    ts.forEachChild(node, walk);
  }
  walk(ast);
  return { fields, headings, links };
}
const report = {
  staticDashes: [],
  protectedFiles: [],
  contracts: [],
  contrast: [],
};
// Presentation components may move between modules. Their contracts must remain
// present somewhere in the source, while route nesting is compared separately.
const currentSources = fs
  .readdirSync(root, { recursive: true })
  .filter((p) => /\.tsx?$/.test(p) && !/\.test\./.test(p));
const allContracts = currentSources.map((p) =>
  contracts(fs.readFileSync(`${root}/${p}`, 'utf8')),
);
const dashRoots = ['Web/frontend/src', 'Web/backend/src'];
for (const dashRoot of dashRoots) {
  const files = fs
    .readdirSync(dashRoot, { recursive: true })
    .filter((path) => /\.(?:ts|tsx|css|html|mjs)$/.test(path));
  report.staticDashes.push(
    ...files
      .filter((path) =>
        /[\u2013\u2014]/.test(fs.readFileSync(`${dashRoot}/${path}`, 'utf8')),
      )
      .map((path) => `${dashRoot}/${path}`),
  );
}
const routePaths = (source) => {
  const ast = ts.createSourceFile(
    'file.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const paths = [];
  function walk(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'path')
      paths.push(cleanRouteValue(node.getText(ast)));
    ts.forEachChild(node, walk);
  }
  const cleanRouteValue = (value) => value.replace(/\s+/g, '').replaceAll("'", '"');
  walk(ast);
  return paths;
};
const oldRoutePaths = routePaths(before(`${root}/app/App.tsx`));
const currentRoutePaths = routePaths(
  fs.readFileSync(`${root}/app/App.tsx`, 'utf8'),
);
report.routeTreeUnchanged = oldRoutePaths.every((path) =>
  currentRoutePaths.includes(path),
);
for (const path of tracked) {
  if (!/\.tsx?$/.test(path) || /\.test\./.test(path)) continue;
  const old = before(path),
    current = fs.readFileSync(path, 'utf8');
  const a = contracts(old),
    b = contracts(current);
  for (const key of ['fields', 'headings', 'links']) {
    const removed = a[key].filter(
      (item) =>
        !b[key].includes(item) &&
        !allContracts.some((c) => c[key].includes(item)),
    );
    if (removed.length) report.contracts.push({ path, type: key, removed });
  }
  if (/\/core\/|\/app\/routes\/|DocumentTitle/.test(path)) {
    const unchanged = canonical(old) === canonical(current);
    const approvedChange = [
      `${root}/app/routes/guards.tsx`,
      `${root}/core/api/client.ts`,
      `${root}/core/auth/AuthContext.ts`,
      `${root}/core/auth/AuthProvider.tsx`,
    ].includes(path);
    report.protectedFiles.push({
      path,
      unchanged,
      approvedChange,
    });
  }
}
const css = fs.readFileSync(`${root}/shared/styles/tokens.css`, 'utf8');
const darkSelectorIndex = css.indexOf(":root[data-theme='dark']");
const light = Object.fromEntries(
  [...css.slice(0, darkSelectorIndex).matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/g)].map(
    (m) => [m[1], m[2]],
  ),
);
const dark = Object.fromEntries(
  [
    ...css
      .slice(darkSelectorIndex)
      .matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/g),
  ].map((m) => [m[1], m[2]]),
);
function luminance(hex) {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((x) => parseInt(x, 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
for (const [mode, tokens] of Object.entries({ light, dark }))
  for (const [fg, bg, min] of [
    ['ink', 'surface', 7],
    ['muted', 'surface', 7],
    ['muted', 'subtle', 7],
    ['primary', 'accent-soft', 4.5],
    ['on-primary', 'primary', 4.5],
    ['success', 'success-soft', 4.5],
    ['warning', 'warning-soft', 4.5],
    ['danger', 'danger-soft', 4.5],
    ['control-line', 'surface', 3],
  ]) {
    const a = luminance(tokens[fg]),
      b = luminance(tokens[bg]);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    report.contrast.push({
      mode,
      pair: `${fg}/${bg}`,
      ratio: Number(ratio.toFixed(2)),
      pass: ratio >= min,
    });
  }
const legal = normalize(
  before(`${root}/features/legal/LegalPages.tsx`),
).replace('approximative \u2014 jamais', 'approximative, jamais');
report.legalApprovedChangeOnly =
  legal ===
  normalize(fs.readFileSync(`${root}/features/legal/LegalPages.tsx`, 'utf8'));
const approvedContractChanges = new Set([
  'Web/frontend/src/features/attendance/AttendancePage.tsx:headings',
  'Web/frontend/src/features/dashboard/DashboardPage.tsx:headings',
  'Web/frontend/src/features/dashboard/RoleDashboards.tsx:headings',
]);
report.contracts = report.contracts.filter(
  ({ path, type }) => !approvedContractChanges.has(`${path}:${type}`),
);
console.log(JSON.stringify(report, null, 2));
fs.writeFileSync(
  'Docs/HSA_DESIGN_CHECKS.json',
  JSON.stringify(report, null, 2),
);
if (
  report.staticDashes.length ||
  report.contracts.length ||
  report.protectedFiles.some(
    (file) => !file.unchanged && !file.approvedChange,
  ) ||
  report.contrast.some((pair) => !pair.pass) ||
  !report.routeTreeUnchanged ||
  !report.legalApprovedChangeOnly
)
  process.exitCode = 1;
