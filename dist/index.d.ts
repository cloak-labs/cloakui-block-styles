import type { Breakpoint, ResponsiveValue, StandardBreakpoint, StyleInput, StyleModule, StyleOutput, StyleProperty, StyleScalar, StyleValue } from "./types.js";
export * from "./types.js";
export { defaultStyleProperties, isSafeStyleValue } from "./properties.js";
/** Mirrors @cloakui/responsive's mobile-first breakpoint names and Tailwind modifiers. */
export declare const defaultBreakpoints: Breakpoint<StandardBreakpoint>[];
/** Adapts the same scalar-or-breakpoint-object shape as @cloakui/responsive. */
export declare function fromResponsive<T extends StyleScalar, K extends string = StandardBreakpoint>(value: ResponsiveValue<T, K>): StyleValue<K>;
/** Merge per property and state. null removes the property; undefined leaves it alone. */
export declare function mergeStyleInputs<K extends string>(...inputs: (StyleInput<K> | undefined)[]): StyleInput<K>;
export declare function createBlockStyleEngine<K extends string = StandardBreakpoint>(options?: {
    breakpoints?: readonly Breakpoint<K>[];
    properties?: Record<string, StyleProperty>;
    modules?: readonly StyleModule<K>[];
    defaults?: StyleInput<K>;
    resolve?: (styles: StyleInput<K>, context: unknown) => StyleInput<K>;
    /** Values guaranteed by the consumer's CSS for this context, without an engine rule. */
    cssDefaults?: Record<string, StyleScalar> | ((context: unknown) => Record<string, StyleScalar>);
    /** Use class specificity when integrating with existing unlayered utilities. */
    specificity?: "low" | "class" | "strong";
}): {
    render(input: StyleInput<K>, context?: unknown): StyleOutput;
    /** Static, value-free capability rules for stylesheet build tools. */
    catalog(): StyleOutput;
};
/** Combine outputs from every rendered block, deduplicating capability rules. */
export declare function compileBlockStyleRules(outputs: readonly Pick<StyleOutput, "rules">[]): string;
//# sourceMappingURL=index.d.ts.map