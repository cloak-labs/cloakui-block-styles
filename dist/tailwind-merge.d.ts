import type { StyleOutput } from "./types.js";
/** Optional tailwind-merge plugin; breakpoint/state-suffixed CMS classes stay separate. */
export declare function createBlockStylesTailwindMergePlugin(catalog?: Pick<StyleOutput, "classProperties" | "rules">): <T extends {
    classGroups: Record<string, any>;
    conflictingClassGroups: Record<string, any>;
}>(config: T) => T;
/** Uses the default engine's property names. */
export declare const withBlockStyles: <T extends {
    classGroups: Record<string, any>;
    conflictingClassGroups: Record<string, any>;
}>(config: T) => T;
//# sourceMappingURL=tailwind-merge.d.ts.map