# @cloakui/block-styles

A CMS-independent styling engine for structured content. Convert semantic style
values into reusable CSS rules, class names, and per-element CSS custom
properties. Keep the rules in your frontend instead of relying on a CMS to
render its own stylesheet.

The core works without a block renderer, React, WordPress, Tailwind, or a
browser. An optional adapter connects it to `@cloakui/block-renderer`. A CMS
adapter can translate its own attributes into the same style model, and a
project can customize the default properties, values, breakpoints, and output.

> **Status:** This repository is an early, unreleased package. It is not yet
> available on npm. The optional renderer plugin requires the `prepareBlock`
> hook from the companion renderer's current local development version; that
> hook is not present in its existing public repository release. The workspace
> currently supplies the renderer through a `workspace:*` development
> dependency. Publishing both packages and updating the dependency versions are
> required before a standalone npm installation or clone is supported.

## How it works

1. An application or CMS adapter maps its data to `StyleInput`.
2. The engine resolves defaults, modules, content values, and project overrides.
3. Each block receives the returned classes and custom properties.
4. The application emits the returned reusable CSS rules once for the page, or
   selects them into an external stylesheet.

For example, `text-align: center` produces the class `cui-text-align`, the
custom property `--cui-text-align: center`, and a reusable rule that reads the
property. The value is attached to the individual element, while the rule can
be shared with other elements and deduplicated.

## Quick start

```ts
import {
  createBlockStyleEngine,
  compileBlockStyleRules,
  fromResponsive,
} from '@cloakui/block-styles';

const engine = createBlockStyleEngine();
const heading = engine.render({
  'text-align': 'center',
  'font-size': fromResponsive({ mobile: '1rem', tablet: '1.25rem' }),
  color: { base: 'black', states: { hover: { base: 'blue' } } },
});

// Attach heading.classes and heading.variables to the SAME element.
// In React this is className={heading.classes.join(' ')} and
// style={heading.variables as React.CSSProperties}.
const css = compileBlockStyleRules([heading]);
// Emit `css` in your framework's stylesheet mechanism, or publish it.
```

`render()` returns:

| Field | Purpose |
| --- | --- |
| `classes` | Class names to attach to the styled element. |
| `variables` | CSS custom properties containing its values. |
| `rules` | Keyed, value-free CSS capability rules. |
| `diagnostics` | Unknown properties, breakpoints or states, and invalid values. |

Use `compileBlockStyleRules(outputs)` to combine outputs, deduplicate rules and
produce deterministic CSS ordering. Conflicting rules under the same key throw
an error. It does not create a `<style>` element: resource placement belongs to
the framework or application.

## Responsive values and states

A property can be a string or number, or an object with an unconditional `base`,
named `breakpoints`, and `states`:

```ts
const result = engine.render({
  color: {
    base: '#222',
    breakpoints: { tablet: '#444' },
    states: {
      hover: { base: '#06c', breakpoints: { desktop: '#048' } },
      'focus-visible': { base: '#06c' },
    },
  },
});
```

Supported states are `hover`, `focus`, `focus-visible`, and `active`.
`fromResponsive` accepts a scalar or a breakpoint-keyed object like
`@cloakui/responsive`'s `BreakpointOptions`. The package does not depend on
`@cloakui/responsive` at runtime.

The default names and minimum widths are `mobile` (unconditional), `tablet`
(640px), `tabletWide` (768px), `laptop` (1024px), `desktop` (1280px), and
`desktopWide` (1536px). Supply a different ordered set to match your design
system, including additional names or non-overlapping viewport ranges:

```ts
const engine = createBlockStyleEngine({
  breakpoints: [
    { name: 'phone', query: '(width <= 40rem)' },
    { name: 'wide', query: '(width > 40rem)' },
    { name: 'cinema', query: '(min-width: 120rem)' },
  ],
});
```

`base` rules precede breakpoint rules. Breakpoint rules follow the configured
order; interaction rules follow hover, focus, focus-visible, then active, with
responsive variants following each state. When media conditions overlap, the
last matching rule of equal specificity wins. Set bounded media conditions if
your CMS or design system treats viewports as mutually exclusive.

## Defaults and overrides

`defaults` are desired styles. Module defaults merge over engine defaults;
content input merges over both. Matching modules resolve in their configured
order, and the project's `resolve` function runs last. A scalar or returned
property replaces that property's previous definition; use `mergeStyleInputs`
when individual responsive or state values should be preserved. A `null`
property removes it while merging; `undefined` leaves it unchanged.

```ts
import { createBlockStyleEngine, mergeStyleInputs } from '@cloakui/block-styles';

const engine = createBlockStyleEngine({
  defaults: { 'text-align': 'start' },
  resolve: (styles, context) =>
    mergeStyleInputs(styles, { color: { states: { hover: { base: 'navy' } } } }),
});

const result = engine.render({ color: { base: 'blue' } }, { type: 'heading' });
// Both blue and the navy hover value are retained.
```

### Avoiding redundant markup

`cssDefaults` describes values **already guaranteed by the consuming
component's CSS**, optionally based on the render context. When an
unconditional resolved value exactly matches that declaration, no class,
variable, or rule is emitted for it. This differs from `defaults`, which are
styles the engine is asked to apply and must otherwise emit.

```ts
const engine = createBlockStyleEngine({
  // Only correct if the component CSS guarantees this in every relevant case.
  cssDefaults: { 'text-align': 'center' },
});
engine.render({ 'text-align': 'center' }).classes; // []
engine.render({ 'text-align': 'left' }).classes;   // ['cui-text-align']
```

Do not assume browser defaults represent your component's cascade: an explicit
zero or transparent value may be needed to override another rule. Only
unconditional values are omitted; properties with breakpoint or interaction
values retain their base declaration to preserve resets. Matching compares the
trimmed strings, not CSS equivalence (`0` and `0px` are different). Renderer
and stylesheet build must use the same configuration and context.

## Extending properties and modules

The built-in allowlist covers common typography, colors, backgrounds, spacing,
borders, dimensions, layout, and link colors. `properties` adds or replaces
property definitions. A name maps to a CSS property and may specify a trusted
selector and value validator:

```ts
const engine = createBlockStyleEngine({
  properties: {
    tracking: {
      css: 'letter-spacing',
      validate: value => /^\d+px$/.test(value),
    },
    'child-color': { css: 'color', selector: '& a' },
  },
  modules: [{
    name: 'headings',
    matches: context => (context as { type?: string } | undefined)?.type === 'heading',
    defaults: { tracking: '2px' },
  }],
});
```

Module names must be unique. Module property definitions are registered for
the engine; `matches` controls that module's defaults and resolver for each
context. A custom selector must be trusted configuration and contain exactly
one `&`, representing the styled element. Custom properties inherit, so attach
a returned class and its matching variable to the same element. A descendant
selector such as `& a` reads that variable through inheritance.

Root selectors use `:where()` by default for low specificity. Set
`specificity: 'class'` or `'strong'` when integrating with existing styles that
must be overridden. The latter repeats the class three times; select the least
specific mode that works for your cascade.

## Stylesheet selection

For inline rendering, collect each `render()` output and emit the result of
`compileBlockStyleRules` once. For external CSS, `engine.catalog()` returns the
value-free rules for every configured property, breakpoint, and state without
executing project resolvers or value validators. A build adapter can select
rules using the classes actually found in content. The catalog itself can be
large; do not ship it unfiltered when only a subset is used.

A separate build process must use the same engine configuration and block
context as the renderer. Publish matching CSS before exposing content that
needs its rules. Preview or draft content may need an inline fallback until a
matching external stylesheet is available. This package does not manage
publication, CMS indexing, or CSS build-tool integration.

## Block renderer plugin

The optional `@cloakui/block-styles/block-renderer` entry point exports
`blockStylesPlugin`. It composes the renderer's hooks, calls the configured
engine for supported blocks, collects their rules per renderer, and delegates
framework-specific prop application and stylesheet emission to callbacks.
Its companion renderer is an optional peer; importing the core engine does not
load the renderer.

The following framework-neutral example returns a data structure instead of
rendering DOM. A React adapter would apply `output.variables` to the target
component's `style`, and turn the CSS supplied to `complete` into a style
resource or another framework-specific output:

```ts
import { BlockRenderer } from '@cloakui/block-renderer';
import { createBlockStyleEngine } from '@cloakui/block-styles';
import { blockStylesPlugin } from '@cloakui/block-styles/block-renderer';

const engine = createBlockStyleEngine();
const plugin = blockStylesPlugin({
  getEngine: renderer => renderer.getMeta('styles'),
  prepare: block => block,
  apply: (props, output) => ({
    ...props,
    classes: output.classes,
    variables: output.variables,
  }),
  complete: (rendered, css) => ({ rendered, css }),
});
const renderer = new BlockRenderer({
  blockIdField: 'name',
  plugins: [plugin],
  blocks: { heading: { component: () => null } },
  renderBlock: ({ props }) => props,
});
renderer.setMeta({
  styles: {
    supports: block => block.name === 'heading',
    render: block => engine.render(block.styles, block),
  },
});
const page = renderer.render([
  { name: 'heading', styles: { 'text-align': 'center' } },
]);
```

`getEngine` may return no engine to disable styling. An engine with
`css: 'external'` applies classes and variables without invoking `complete`.
A CMS adapter is responsible for normalizing attributes, diagnostics, choosing
which blocks support the integration, and deciding which component slot receives
styles. Plugin `prepare` may annotate a block before its data router runs.

## Validation and deployment considerations

Property names and CSS declarations come from trusted engine configuration.
The engine checks registered identifiers, media conditions, and selectors,
and rejects values containing stylesheet-breaking characters or unsupported
URL forms. `isSafeStyleValue` is an output-safety guard, **not** a full CSS
parser or a substitute for application-specific validation. Invalid or unknown
input is omitted and reported in `diagnostics`; consumers should surface those
diagnostics during development.

Values are normally placed in inline CSS custom properties. A strict Content
Security Policy may require a different value-emission strategy. Content and
stylesheet publication must be coordinated when external stylesheets are used.

## Development

In the agency workspace, install dependencies with pnpm, then run:

```sh
pnpm --filter @cloakui/block-styles test
pnpm --filter @cloakui/block-styles typecheck
```

The tests build the package first and exercise the generic engine and optional
renderer plugin. The renderer peer currently resolves to the local workspace
package; see the status note above before trying to build an isolated clone.

## License

[LGPL-3.0-only](LICENSE). The license incorporates the terms of the
[GNU GPL v3](LICENSE-GPL).
