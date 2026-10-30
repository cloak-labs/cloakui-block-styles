import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createBlockStyleEngine,
  compileBlockStyleRules,
  fromResponsive,
  mergeStyleInputs,
} from "../dist/index.js";

test("responsive values match CloakUI names and accept additional breakpoints", () => {
  const engine = createBlockStyleEngine({
    breakpoints: [
      { name: "mobile", query: null },
      { name: "tablet", query: "(min-width: 640px)" },
      { name: "cinema", query: "(min-width: 2000px)" },
    ],
  });
  const out = engine.render({
    "font-size": fromResponsive({
      mobile: "1rem",
      tablet: "2rem",
      cinema: "4rem",
    }),
  });
  assert.deepEqual(out.variables, {
    "--cui-font-size--mobile": "1rem",
    "--cui-font-size--tablet": "2rem",
    "--cui-font-size--cinema": "4rem",
  });
  const css = compileBlockStyleRules([out, out]);
  assert.match(css, /@media \(min-width: 2000px\)/);
  assert.equal(css.match(/cui-font-size--tablet/g).length, 2);
  assert.deepEqual(out.diagnostics, []);
});

test("state and responsive rules are ordered independent of block traversal", () => {
  const engine = createBlockStyleEngine({
    breakpoints: [{ name: "mobile", query: "(max-width: 480px)" }],
  });
  const a = engine.render({
    color: {
      base: "red",
      breakpoints: { mobile: "blue" },
      states: { hover: { base: "green", breakpoints: { mobile: "black" } } },
    },
  });
  const b = engine.render({ color: { states: { active: { base: "white" } } } });
  assert.equal(compileBlockStyleRules([a, b]), compileBlockStyleRules([b, a]));
  assert.match(
    compileBlockStyleRules([a]),
    /@media \(max-width: 480px\).*:hover/,
  );
});

test("project overrides can merge or replace all responsive values", () => {
  const initial = {
    "text-align": { base: "left", breakpoints: { mobile: "center" } },
  };
  const merged = mergeStyleInputs(initial, { "text-align": { base: "right" } });
  assert.equal(merged["text-align"].breakpoints.mobile, "center");
  const engine = createBlockStyleEngine({
    resolve: (styles) => ({ ...styles, "text-align": { base: "right" } }),
  });
  const out = engine.render(initial);
  assert.deepEqual(out.variables, { "--cui-text-align": "right" });
  assert.deepEqual(mergeStyleInputs(initial, { "text-align": null }), {});
});

test("omits only values explicitly guaranteed by the consumer's CSS", () => {
  const engine = createBlockStyleEngine({
    cssDefaults: (context) =>
      context?.type === "heading"
        ? { "text-align": "center", "margin-top": 0 }
        : {},
  });
  const heading = engine.render(
    { "text-align": "center", "margin-top": "0", color: "red" },
    { type: "heading" },
  );
  assert.deepEqual(heading.classes, ["cui-color"]);
  assert.deepEqual(heading.variables, { "--cui-color": "red" });
  assert.equal(Object.keys(heading.rules).length, 1);
  assert.ok(
    engine
      .render({ "text-align": "center" }, { type: "paragraph" })
      .classes.includes("cui-text-align"),
  );
  assert.ok(
    engine.render({ "margin-top": "0" }).classes.includes("cui-margin-top"),
  );
  const responsive = engine.render(
    { "text-align": { base: "center", breakpoints: { mobile: "left" } } },
    { type: "heading" },
  );
  assert.equal(responsive.variables["--cui-text-align"], "center");
  assert.equal(responsive.variables["--cui-text-align--mobile"], "left");
  const interactive = engine.render(
    { "text-align": { base: "center", states: { hover: { base: "left" } } } },
    { type: "heading" },
  );
  assert.equal(interactive.variables["--cui-text-align"], "center");
  assert.equal(
    engine.render({ "text-align": "left;bad" }, { type: "heading" })
      .diagnostics[0].reason,
    "invalid-value",
  );
});

test("unknown values and CSS injection are rejected with diagnostics", () => {
  const engine = createBlockStyleEngine();
  const out = engine.render({
    color: "red;display:none",
    "font-size": { breakpoints: { other: "10px" } },
    typo: "red",
    "background-image": "url(javascript:alert(1))",
  });
  assert.deepEqual(out.classes, []);
  assert.deepEqual(
    out.diagnostics.map((item) => item.reason),
    [
      "invalid-value",
      "unknown-breakpoint",
      "unknown-property",
      "invalid-value",
    ],
  );
  assert.equal(
    engine.render({ "background-image": 'url("https://example.com/a.jpg")' })
      .diagnostics.length,
    0,
  );
  assert.throws(
    () =>
      createBlockStyleEngine({
        breakpoints: [{ name: "mobile", query: "(width: 1px){}" }],
      }),
    /Invalid/,
  );
});

test("untrusted property names cannot change prototypes or impersonate registered properties", () => {
  const input = JSON.parse('{"__proto__":"red","constructor":"blue"}');
  const out = createBlockStyleEngine().render(input);
  assert.deepEqual(out.classes, []);
  assert.deepEqual(
    out.diagnostics.map((item) => item.reason),
    ["unknown-property", "unknown-property"],
  );
  assert.equal({}.polluted, undefined);
});

test("modules compose contextual defaults, custom properties, and project resolution", () => {
  const engine = createBlockStyleEngine({
    modules: [
      {
        name: "heading",
        matches: (context) => context?.type === "heading",
        properties: { tracking: { css: "letter-spacing" } },
        defaults: { "text-align": "center", tracking: "0.1em" },
        resolve: (styles) => ({ ...styles, tracking: "0.2em" }),
      },
    ],
    resolve: (styles) => ({ ...styles, tracking: "0.3em" }),
  });
  const out = engine.render({ "text-align": "left" }, { type: "heading" });
  assert.equal(out.variables["--cui-text-align"], "left");
  assert.equal(out.variables["--cui-tracking"], "0.3em");
  assert.match(
    compileBlockStyleRules([out]),
    /letter-spacing:var\(--cui-tracking\)/,
  );
  assert.throws(
    () =>
      createBlockStyleEngine({ modules: [{ name: "same" }, { name: "same" }] }),
    /duplicate/,
  );
});

test("trusted descendant selectors retain link interaction specificity", () => {
  const engine = createBlockStyleEngine();
  const out = engine.render({
    "link-color": "red",
    "link-hover-color": "blue",
  });
  const css = compileBlockStyleRules([out]);
  assert.match(
    css,
    /:where\(\.cui-link-color\) a\{color:var\(--cui-link-color\)\}/,
  );
  assert.match(css, /:where\(\.cui-link-hover-color\) a:hover/);
  assert.throws(
    () =>
      createBlockStyleEngine({
        properties: { unsafe: { css: "color", selector: "& a{}" } },
      }),
    /Invalid/,
  );
});

test("static catalog includes every emitted rule without running value validators or project resolvers", () => {
  let validate = 0;
  let resolve = 0;
  const engine = createBlockStyleEngine({
    breakpoints: [{ name: "phone", query: "(width <= 35rem)" }],
    properties: {
      tracking: {
        css: "letter-spacing",
        validate: (value) => {
          validate++;
          return value === "2px";
        },
      },
    },
    resolve: (value) => {
      resolve++;
      return value;
    },
  });
  const catalog = engine.catalog();
  assert.equal(validate, 0);
  assert.equal(resolve, 0);
  const output = engine.render({
    tracking: {
      base: "2px",
      states: { hover: { breakpoints: { phone: "2px" } } },
    },
  });
  assert.equal(validate, 2);
  assert.equal(resolve, 1);
  for (const [key, rule] of Object.entries(output.rules))
    assert.equal(catalog.rules[key], rule);
  assert.ok(catalog.classes.includes("cui-tracking--phone--hover"));
});
