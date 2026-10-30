import { defaultStyleProperties, isSafeStyleValue } from "./properties.js";
export * from "./types.js";
export { defaultStyleProperties, isSafeStyleValue } from "./properties.js";
/** Mirrors @cloakui/responsive's mobile-first breakpoint names and Tailwind modifiers. */
export const defaultBreakpoints = [
    { name: "mobile", query: null },
    { name: "tablet", query: "(min-width: 640px)" },
    { name: "tabletWide", query: "(min-width: 768px)" },
    { name: "laptop", query: "(min-width: 1024px)" },
    { name: "desktop", query: "(min-width: 1280px)" },
    { name: "desktopWide", query: "(min-width: 1536px)" },
];
const STATES = ["hover", "focus", "focus-visible", "active"];
const IDENTIFIER = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const PROPERTY = /^-?[a-z][a-z0-9-]*$/;
const QUERY = /^[a-zA-Z0-9\s():.\-/%<>=]+$/;
const SELECTOR = /^[a-zA-Z0-9\s&.:#>+~*(),_-]+$/;
/** Adapts the same scalar-or-breakpoint-object shape as @cloakui/responsive. */
export function fromResponsive(value) {
    return typeof value === "object" && value !== null
        ? { breakpoints: { ...value } }
        : { base: value };
}
/** Merge per property and state. null removes the property; undefined leaves it alone. */
export function mergeStyleInputs(...inputs) {
    const result = {};
    for (const input of inputs) {
        for (const [property, next] of Object.entries(input ?? {})) {
            if (next === undefined)
                continue;
            if (next === null) {
                delete result[property];
                continue;
            }
            if (property === "__proto__") {
                Object.defineProperty(result, property, {
                    value: next,
                    enumerable: true,
                    configurable: true,
                    writable: true,
                });
                continue;
            }
            const previous = Object.prototype.hasOwnProperty.call(result, property)
                ? result[property]
                : undefined;
            if (typeof next !== "object" || previous == null) {
                result[property] = next;
                continue;
            }
            const prev = typeof previous === "object" ? previous : { base: previous };
            const states = Object.assign(Object.create(null), prev.states);
            for (const [state, stateValue] of Object.entries(next.states ?? {})) {
                const key = state;
                states[key] = {
                    ...states[key],
                    ...stateValue,
                    breakpoints: {
                        ...states[key]?.breakpoints,
                        ...stateValue?.breakpoints,
                    },
                };
            }
            result[property] = {
                ...prev,
                ...next,
                breakpoints: { ...prev.breakpoints, ...next.breakpoints },
                states,
            };
        }
    }
    return result;
}
export function createBlockStyleEngine(options = {}) {
    const breakpoints = options.breakpoints ?? defaultBreakpoints;
    const modules = options.modules ?? [];
    const moduleNames = new Set();
    for (const module of modules) {
        if (!IDENTIFIER.test(module.name) || moduleNames.has(module.name))
            throw new Error(`Invalid or duplicate style module: ${module.name}`);
        moduleNames.add(module.name);
    }
    const properties = Object.assign(Object.create(null), defaultStyleProperties, ...modules.map((module) => module.properties ?? {}), options.properties);
    const seen = new Set();
    for (const { name, query } of breakpoints) {
        if (!IDENTIFIER.test(name) ||
            name.includes("--") ||
            seen.has(name) ||
            (query !== null && (!query || !QUERY.test(query) || /<\s*\//.test(query)))) {
            throw new Error(`Invalid or duplicate style breakpoint: ${name}`);
        }
        seen.add(name);
    }
    for (const [name, definition] of Object.entries(properties)) {
        if (!IDENTIFIER.test(name) ||
            name.includes("--") ||
            !PROPERTY.test(definition.css) ||
            (definition.selector !== undefined &&
                (!SELECTOR.test(definition.selector) ||
                    (definition.selector.match(/&/g) ?? []).length !== 1)))
            throw new Error(`Invalid style property: ${name}`);
    }
    const buildOutput = (values, catalog = false, cssDefaults = {}) => {
        const output = {
            classes: [],
            variables: {},
            rules: {},
            diagnostics: [],
        };
        const diagnose = (property, reason, value) => output.diagnostics.push({ property, reason, value });
        const emit = (property, value, breakpoint, state, omitIfDefault = false) => {
            if (value === undefined)
                return;
            const definition = properties[property];
            const text = String(value).trim();
            if (!catalog &&
                (!isSafeStyleValue(text) ||
                    (definition.validate && !definition.validate(text)))) {
                diagnose(property, "invalid-value", value);
                return;
            }
            if (omitIfDefault &&
                Object.prototype.hasOwnProperty.call(cssDefaults, property) &&
                text === String(cssDefaults[property]).trim())
                return;
            const breakpointIndex = breakpoint ? breakpoints.indexOf(breakpoint) : -1;
            const stateIndex = state ? STATES.indexOf(state) : -1;
            const suffix = [breakpoint?.name, state].filter(Boolean).join("--");
            const token = `cui-${property}${suffix ? `--${suffix}` : ""}`;
            const variable = `--${token}`;
            const host = options.specificity === "strong"
                ? `.${token}.${token}.${token}${state ? `:${state}` : ""}`
                : options.specificity === "class"
                    ? `.${token}${state ? `:${state}` : ""}`
                    : `:where(.${token}${state ? `:${state}` : ""})`;
            const target = (definition.selector ?? "&").replace("&", host);
            const selector = target;
            const rule = `${selector}{${definition.css}:var(${variable})}`;
            // Keep interaction precedence across both base and responsive rules.
            const rank = state
                ? 2 + stateIndex * 2 + (breakpoint ? 1 : 0)
                : breakpoint
                    ? 1
                    : 0;
            const key = `${rank}:${String(breakpointIndex + 1).padStart(4, "0")}:${stateIndex + 1}:${property}`;
            output.classes.push(token);
            output.variables[variable] = text;
            output.rules[key] = breakpoint?.query
                ? `@media ${breakpoint.query}{${rule}}`
                : rule;
        };
        const emitBreakpoints = (property, values, state) => {
            for (const name of Object.keys(values ?? {}))
                if (!seen.has(name))
                    diagnose(property, "unknown-breakpoint", name);
            for (const bp of breakpoints)
                emit(property, values?.[bp.name], bp, state);
        };
        for (const [property, inputValue] of Object.entries(values)) {
            if (inputValue == null)
                continue;
            if (!Object.prototype.hasOwnProperty.call(properties, property)) {
                diagnose(property, "unknown-property", inputValue);
                continue;
            }
            const value = typeof inputValue === "object" ? inputValue : { base: inputValue };
            const onlyBase = !Object.keys(value.breakpoints ?? {}).length &&
                !Object.keys(value.states ?? {}).length;
            emit(property, value.base, undefined, undefined, !catalog && onlyBase);
            emitBreakpoints(property, value.breakpoints);
            for (const [state, stateValue] of Object.entries(value.states ?? {})) {
                if (!STATES.includes(state)) {
                    diagnose(property, "invalid-state", state);
                    continue;
                }
                emit(property, stateValue?.base, undefined, state);
                emitBreakpoints(property, stateValue?.breakpoints, state);
            }
        }
        return output;
    };
    return {
        render(input, context) {
            const selected = modules.filter((module) => !module.matches || module.matches(context));
            let resolved = mergeStyleInputs(options.defaults, ...selected.map((module) => typeof module.defaults === "function"
                ? module.defaults(context)
                : module.defaults), input);
            for (const module of selected)
                if (module.resolve)
                    resolved = module.resolve(resolved, context);
            const values = options.resolve
                ? options.resolve(resolved, context)
                : resolved;
            const cssDefaults = typeof options.cssDefaults === "function"
                ? options.cssDefaults(context)
                : options.cssDefaults;
            return buildOutput(values, false, cssDefaults);
        },
        /** Static, value-free capability rules for stylesheet build tools. */
        catalog() {
            const breakpointValues = Object.fromEntries(breakpoints.map(({ name }) => [name, "0"]));
            const states = Object.fromEntries(STATES.map((state) => [
                state,
                { base: "0", breakpoints: breakpointValues },
            ]));
            const input = Object.fromEntries(Object.keys(properties).map((property) => [
                property,
                { base: "0", breakpoints: breakpointValues, states },
            ]));
            return buildOutput(input, true);
        },
    };
}
/** Combine outputs from every rendered block, deduplicating capability rules. */
export function compileBlockStyleRules(outputs) {
    const rules = Object.create(null);
    for (const output of outputs)
        for (const [key, rule] of Object.entries(output.rules)) {
            if (rules[key] && rules[key] !== rule)
                throw new Error(`Conflicting block style rule: ${key}`);
            rules[key] = rule;
        }
    return Object.keys(rules)
        .sort()
        .map((key) => rules[key])
        .join("");
}
