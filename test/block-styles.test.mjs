import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createBlockStyleEngine,
  compileBlockStyleRules,
  fromResponsive,
  mergeStyleInputs,
} from "../dist/index.js";

test("custom prefixes apply to rules, variables, responsive states and the catalog", () => {
  const engine = createBlockStyleEngine({ prefix: "wp", breakpoints: [{ name: "mobile", query: "(max-width: 480px)" }] });
  const out = engine.render({ "border-top-left-radius": { base: "4px", breakpoints: { mobile: "8px" }, states: { hover: { base: "10px" } } }, "grid-template-columns": "repeat(2, 1fr)" });
  assert.equal(out.variables["--wp-rad-tl"], "4px");
  assert.equal(out.variables["--wp-rad-tl--mobile"], "8px");
  assert.equal(out.variables["--wp-rad-tl--hover"], "10px");
  assert.equal(out.variables["--wp-grid-cols"], "repeat(2, 1fr)");
  assert.ok(engine.catalog().classProperties["wp-rad-tl"]);
  assert.match(compileBlockStyleRules([out]), /\.wp-rad-tl/);
  for (const prefix of ["", "1bad", "x--y", "x-", "x y", "<style>"])
    assert.throws(() => createBlockStyleEngine({ prefix }), /Invalid block style prefix/);
});

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
    "--cms-fs--mobile": "1rem",
    "--cms-fs--tablet": "2rem",
    "--cms-fs--cinema": "4rem",
  });
  const css = compileBlockStyleRules([out, out]);
  assert.match(css, /@media \(min-width: 2000px\)/);
  assert.equal(css.match(/cms-fs--tablet/g).length, 2);
  assert.deepEqual(out.diagnostics, []);
});

test("compact tokens are reversible through metadata and do not collide with custom properties", () => {
  const engine = createBlockStyleEngine({
    properties: {
      mt: { css: "color" },
      "gap-x": { css: "opacity" },
      tracking: { css: "letter-spacing" },
      constructor: { css: "color" },
    },
  });
  const output = engine.render({
    "margin-top": "1rem",
    mt: "red",
    "column-gap": "2rem",
    "gap-x": "0.5",
    "padding-left": "3px",
    tracking: "1px",
    constructor: "blue",
  });
  assert.equal(output.variables["--cms-margin-top"], "1rem");
  assert.equal(output.variables["--cms-mt"], "red");
  assert.equal(output.variables["--cms-column-gap"], "2rem");
  assert.equal(output.variables["--cms-gap-x"], "0.5");
  assert.equal(output.variables["--cms-pl"], "3px");
  assert.equal(output.variables["--cms-tracking"], "1px");
  assert.equal(output.variables["--cms-constructor"], "blue");
  for (const [token, property] of Object.entries(output.classProperties)) {
    assert.equal(engine.catalog().classProperties[token], property);
  }
  assert.equal(
    createBlockStyleEngine()
      .render({ "margin-top": "1rem", "column-gap": "2rem" })
      .classes.join(" "),
    "cms-mt cms-gap-x",
  );
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

test("gap shorthand precedes axis-specific overrides at each viewport and state", () => {
  const engine = createBlockStyleEngine({
    breakpoints: [{ name: "mobile", query: "(width <= 480px)" }],
  });
  const out = engine.render({
    "column-gap": {
      base: "2px",
      breakpoints: { mobile: "4px" },
      states: { hover: { base: "6px", breakpoints: { mobile: "8px" } } },
    },
    gap: {
      base: "1px",
      breakpoints: { mobile: "3px" },
      states: { hover: { base: "5px", breakpoints: { mobile: "7px" } } },
    },
  });
  const css = compileBlockStyleRules([out]);
  for (const suffix of ["", "--mobile", "--hover", "--mobile--hover"]) {
    const shorthand = css.indexOf(`var(--cms-gap${suffix})`);
    const longhand = css.indexOf(`var(--cms-gap-x${suffix})`);
    assert.ok(shorthand >= 0 && shorthand < longhand, suffix);
  }
  assert.deepEqual(
    out.rules,
    Object.fromEntries(
      Object.entries(out.rules).map(([key, rule]) => [
        key,
        engine.catalog().rules[key],
      ]),
    ),
  );
});

test("equal physical spacing values share a class and variable without touching other sides", () => {
  const engine = createBlockStyleEngine();
  const output = engine.render({
    "margin-top": "1rem",
    "margin-bottom": "1rem",
    "padding-left": "2px",
    "padding-right": "2px",
  });
  assert.deepEqual(output.variables, { "--cms-my": "1rem", "--cms-px": "2px" });
  const css = compileBlockStyleRules([output]);
  assert.match(css, /margin-top:var\(--cms-my\);margin-bottom:var\(--cms-my\)/);
  assert.match(
    css,
    /padding-right:var\(--cms-px\);padding-left:var\(--cms-px\)/,
  );
  const all = engine.render({
    "margin-top": "1rem",
    "margin-right": "1rem",
    "margin-bottom": "1rem",
    "margin-left": "1rem",
  });
  assert.deepEqual(all.variables, { "--cms-m": "1rem" });
  for (const [key, rule] of Object.entries(output.rules))
    assert.equal(engine.catalog().rules[key], rule);
});

test("grouping respects complete responsive/state values, diagnostics, defaults and slots", () => {
  const mobile = { name: "mobile", query: "(width <= 480px)" };
  const value = {
    base: "4px",
    breakpoints: { mobile: "8px" },
    states: { hover: { base: "2px" } },
  };
  const engine = createBlockStyleEngine({ breakpoints: [mobile] });
  const grouped = engine.render({
    "padding-top": value,
    "padding-bottom": value,
  });
  assert.equal(grouped.variables["--cms-py"], "4px");
  assert.equal(grouped.variables["--cms-py--mobile"], "8px");
  assert.equal(grouped.variables["--cms-py--hover"], "2px");
  const different = engine.render({
    "margin-top": value,
    "margin-bottom": { ...value, base: "5px" },
  });
  assert.ok(
    different.classes.includes("cms-mt") &&
      different.classes.includes("cms-mb"),
  );
  const separate = createBlockStyleEngine({ canCombine: () => false }).render({
    "margin-top": "4px",
    "margin-bottom": "4px",
  });
  assert.ok(
    separate.classes.includes("cms-mt") && separate.classes.includes("cms-mb"),
  );
  const defaults = createBlockStyleEngine({
    cssDefaults: { "margin-top": "4px" },
  }).render({ "margin-top": "4px", "margin-bottom": "4px" });
  assert.deepEqual(defaults.classes, ["cms-mb"]);
  const invalid = engine.render({
    "margin-top": "bad;value",
    "margin-bottom": "bad;value",
  });
  assert.deepEqual(
    invalid.diagnostics.map((d) => d.property),
    ["margin-top", "margin-bottom"],
  );
  const unknown = engine.render({
    "margin-top": { breakpoints: { unknown: "1px" } },
    "margin-bottom": { breakpoints: { unknown: "1px" } },
  });
  assert.deepEqual(
    unknown.diagnostics.map((d) => d.property),
    ["margin-top", "margin-bottom"],
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
  assert.deepEqual(out.variables, { "--cms-align": "right" });
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
  assert.deepEqual(heading.classes, ["cms-fg"]);
  assert.deepEqual(heading.variables, { "--cms-fg": "red" });
  assert.equal(Object.keys(heading.rules).length, 1);
  assert.ok(
    engine
      .render({ "text-align": "center" }, { type: "paragraph" })
      .classes.includes("cms-align"),
  );
  assert.ok(engine.render({ "margin-top": "0" }).classes.includes("cms-mt"));
  const responsive = engine.render(
    { "text-align": { base: "center", breakpoints: { mobile: "left" } } },
    { type: "heading" },
  );
  assert.equal(responsive.variables["--cms-align"], "center");
  assert.equal(responsive.variables["--cms-align--mobile"], "left");
  const interactive = engine.render(
    { "text-align": { base: "center", states: { hover: { base: "left" } } } },
    { type: "heading" },
  );
  assert.equal(interactive.variables["--cms-align"], "center");
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
  assert.equal(out.variables["--cms-align"], "left");
  assert.equal(out.variables["--cms-tracking"], "0.3em");
  assert.match(
    compileBlockStyleRules([out]),
    /letter-spacing:var\(--cms-tracking\)/,
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
    /:where\(\.cms-link-color\) a\{color:var\(--cms-link-color\)\}/,
  );
  assert.match(css, /:where\(\.cms-link-hover-color\) a:hover/);
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
  assert.ok(catalog.classes.includes("cms-tracking--phone--hover"));
});
