import type { StyleProperty } from "./types.js";
/** Explicit property allowlist: arbitrary CSS and URLs are not style values. */
export declare const defaultStyleProperties: Record<string, StyleProperty>;
/** Reject stylesheet-breaking data even for explicitly added properties. */
export declare function isSafeStyleValue(value: string): boolean;
//# sourceMappingURL=properties.d.ts.map