import { test } from "node:test";
import assert from "node:assert/strict";
import { extendTailwindMerge } from "tailwind-merge";
import {
  withBlockStyles,
  createBlockStylesTailwindMergePlugin,
} from "../dist/tailwind-merge.js";
import { createBlockStyleEngine } from "../dist/index.js";

test("merges unconditional CMS styles and Tailwind classes in either order", () => {
  const cx = extendTailwindMerge(withBlockStyles);
  assert.equal(cx("gap-y-2.5 cms-gap-y"), "cms-gap-y");
  assert.equal(cx("cms-gap-y gap-y-2.5"), "gap-y-2.5");
  assert.equal(cx("gap-x-2 gap-y-2 cms-gap"), "cms-gap");
  assert.equal(cx("cms-gap gap-y-2"), "cms-gap gap-y-2");
  assert.equal(cx("rounded-lg cms-rad rounded-none"), "rounded-none");
  assert.equal(cx("w-full cms-w w-32"), "w-32");
  assert.equal(cx("p-6 cms-pt"), "p-6 cms-pt");
  assert.equal(cx("cms-pt p-6"), "p-6");
  assert.equal(cx("mt-2 mb-2 cms-my"), "cms-my");
  assert.equal(cx("cms-my mt-2"), "cms-my mt-2");
  assert.equal(cx("text-xl leading-7 cms-fs"), "leading-7 cms-fs");
  assert.equal(cx("cms-fs text-xl"), "text-xl");
});

test("keeps CMS viewport and state classes distinct from unrelated Tailwind modifiers", () => {
  const cx = extendTailwindMerge(withBlockStyles);
  assert.equal(
    cx("gap-y-2.5 cms-gap-y--mobile"),
    "gap-y-2.5 cms-gap-y--mobile",
  );
  assert.equal(cx("cms-gap--mobile md:gap-4"), "cms-gap--mobile md:gap-4");
  assert.equal(
    cx("cms-bg--hover hover:bg-red-500"),
    "cms-bg--hover hover:bg-red-500",
  );
  assert.equal(
    cx("cms-link-color text-red-500"),
    "cms-link-color text-red-500",
  );
});

test("customized token collisions use the engine's catalog", () => {
  const engine = createBlockStyleEngine({
    properties: { "gap-x": { css: "opacity" } },
  });
  const cx = extendTailwindMerge(
    createBlockStylesTailwindMergePlugin(engine.catalog()),
  );
  assert.equal(cx("gap-x-4 cms-column-gap"), "cms-column-gap");
  assert.equal(cx("gap-x-4 cms-gap-x"), "gap-x-4 cms-gap-x");
  assert.equal(cx("mt-2 mb-2 cms-my"), "cms-my");
});

test("custom prefixes merge only the configured engine's capabilities", () => {
  const engine = createBlockStyleEngine({ prefix: "wp" });
  const cx = extendTailwindMerge(createBlockStylesTailwindMergePlugin(engine.catalog()));
  assert.equal(cx("text-left wp-align"), "wp-align");
  assert.equal(cx("wp-align text-right"), "text-right");
  assert.equal(cx("rounded-tl-lg wp-rad-tl"), "wp-rad-tl");
  assert.equal(cx("wp-rad-tl rounded-tl-none"), "rounded-tl-none");
});

test("custom property definitions and descendant selectors are not misidentified", () => {
  const engine = createBlockStyleEngine({
    properties: {
      color: { css: "opacity" },
      "background-color": { css: "background-color", selector: "& a" },
    },
  });
  const cx = extendTailwindMerge(
    createBlockStylesTailwindMergePlugin(engine.catalog()),
  );
  assert.equal(cx("text-red-500 cms-fg"), "text-red-500 cms-fg");
  assert.equal(cx("bg-red-500 cms-bg"), "bg-red-500 cms-bg");
});
