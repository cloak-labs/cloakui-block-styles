import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const rendererDir = fileURLToPath(new URL("../../block-renderer", import.meta.url));
const work = await mkdtemp(path.join(tmpdir(), "block-styles-pack-"));
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr}`);
  return result.stdout;
}
try {
  const packed = JSON.parse(run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", work], packageDir));
  await writeFile(path.join(work, "package.json"), '{"private":true,"type":"module"}');
  run("npm", ["install", "--offline", "--ignore-scripts", "--legacy-peer-deps", "--no-audit", "--no-fund", path.join(work, packed[0].filename)], work);
  await writeFile(path.join(work, "smoke.mjs"), `
    import { createBlockStyleEngine, compileBlockStyleRules } from '@cloakui/block-styles';
    import { blockStylesPlugin } from '@cloakui/block-styles/block-renderer';
    import { withBlockStyles } from '@cloakui/block-styles/tailwind-merge';
    const result = createBlockStyleEngine().render({ 'text-align': 'center' });
    if (!result.classes.includes('cms-align') || !compileBlockStyleRules([result]).includes('text-align:var(--cms-align)') || typeof blockStylesPlugin !== 'function' || !withBlockStyles) process.exit(1);
  `);
  run(process.execPath, ["smoke.mjs"], work);
  console.log("Packed core and optional entry points installed and imported without workspace dependencies.");
  // Test the unreleased renderer as a second packed artifact; this is not a
  // claim that a compatible renderer has been published to npm.
  const renderer = JSON.parse(run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", work], rendererDir));
  const merge = JSON.parse(run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", work], path.join(rendererDir, "node_modules/@kaelan/deep-merge-ts")));
  run("npm", ["install", "--offline", "--ignore-scripts", "--legacy-peer-deps", "--no-audit", "--no-fund", path.join(work, merge[0].filename), path.join(work, renderer[0].filename)], work);
  await writeFile(path.join(work, "renderer-smoke.mjs"), `
    import { BlockRenderer } from '@cloakui/block-renderer';
    import { createBlockStyleEngine } from '@cloakui/block-styles';
    import { blockStylesPlugin } from '@cloakui/block-styles/block-renderer';
    const engine = createBlockStyleEngine();
    const renderer = new BlockRenderer({ blockIdField: 'name', blocks: { heading: { component: () => null } },
      plugins: [blockStylesPlugin({ getEngine: () => ({ supports: () => true, render: () => engine.render({ 'text-align': 'center' }) }), prepare: block => block,
        apply: (props, output) => ({ ...props, classes: output.classes }), complete: (rendered, css) => ({ rendered, css }) })],
      renderBlock: ({ props }) => props });
    const result = renderer.render([{ name: 'heading' }]);
    if (!result.css?.includes('text-align:var(--cms-align)')) process.exit(1);
  `);
  run(process.execPath, ["renderer-smoke.mjs"], work);
  console.log("Packed renderer and plugin worked together in an isolated installation.");
} finally { await rm(work, { recursive: true, force: true }); }
