import assert from "node:assert/strict";
import { test } from "node:test";
import { BlockRenderer } from "@cloakui/block-renderer";
import { createBlockStyleEngine } from "../dist/index.js";
import { blockStylesPlugin } from "../dist/block-renderer.js";

test("optional renderer plugin composes hooks and collects each render's CSS", () => {
  const engine = createBlockStyleEngine();
  const plugin = blockStylesPlugin({
    getEngine: (renderer) => renderer.getMeta("styles"),
    prepare: (block) => ({ ...block, marked: true }),
    apply: (props, output) => ({ ...props, classes: output.classes, variables: output.variables }),
    complete: (rendered, css) => ({ rendered, css }),
  });
  const renderer = new BlockRenderer({
    blockIdField: "name",
    plugins: [plugin],
    renderBlock: ({ props, block }) => ({ ...props, marked: block.marked }),
    hooks: { filters: { dataRouterResult: (props) => ({ ...props, existing: true }) } },
    blocks: { example: { component: () => null, dataRouter: () => ({ text: "ok" }) } },
  }).mergeConfigWith({});
  renderer.setMeta({ styles: { supports: () => true, render: (block) => engine.render(block.styles) } });
  const first = renderer.render([{ name: "example", styles: { color: "red" } }]);
  assert.equal(first.rendered[0].existing, true);
  assert.equal(first.rendered[0].marked, true);
  assert.equal(first.rendered[0].variables["--cui-color"], "red");
  assert.match(first.css, /cui-color/);
  const second = renderer.render([{ name: "example", styles: { "text-align": "center" } }]);
  assert.match(second.css, /cui-text-align/);
  assert.doesNotMatch(second.css, /cui-color/);
  renderer.setMeta({ styles: null });
  assert.equal(Array.isArray(renderer.render([{ name: "example" }])), true);
});
