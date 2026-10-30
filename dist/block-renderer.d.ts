import type { BlockRendererPlugin } from "@cloakui/block-renderer";
import type { StyleOutput } from "./types.js";
/** The plugin owns traversal and collection; adapters own data and rendering. */
export declare function blockStylesPlugin(options: {
    getEngine: (renderer: any) => {
        supports: (block: any) => boolean;
        render: (block: any) => StyleOutput<string>;
        css?: "inline" | "external";
    } | null | undefined;
    prepare: (block: any) => any;
    apply: (props: Record<string, any>, output: StyleOutput<string>, context: {
        block: any;
        engine: any;
    }) => Record<string, any>;
    complete: (rendered: any, css: string) => any;
}): BlockRendererPlugin<any, any, any>;
//# sourceMappingURL=block-renderer.d.ts.map