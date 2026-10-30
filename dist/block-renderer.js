import { compileBlockStyleRules } from "./index.js";
/** The plugin owns traversal and collection; adapters own data and rendering. */
export function blockStylesPlugin(options) {
    const collected = new WeakMap();
    const activeBlocks = new WeakSet();
    return (config, { executionCount }) => {
        if (executionCount > 1)
            return config;
        const previousPrepare = config.hooks?.filters?.prepareBlock;
        const previousResult = config.hooks?.filters?.dataRouterResult;
        const previousCombine = config.combineBlocks;
        return {
            ...config,
            hooks: {
                ...config.hooks,
                filters: {
                    ...config.hooks?.filters,
                    prepareBlock(block, context) {
                        const prepared = previousPrepare?.(block, context) ?? block;
                        const renderer = context?.blockRenderer;
                        if (!renderer)
                            return prepared;
                        if (!prepared.context?.parent && prepared.context?.index === 0)
                            collected.delete(renderer);
                        const engine = options.getEngine(renderer);
                        if (!engine?.supports(prepared))
                            return prepared;
                        const styledBlock = options.prepare(prepared);
                        activeBlocks.add(styledBlock);
                        return styledBlock;
                    },
                    dataRouterResult(props, context) {
                        const result = previousResult?.(props, context) ?? props;
                        const renderer = context?.blockRenderer;
                        const block = context?.block;
                        if (!renderer || !block)
                            return result;
                        const engine = options.getEngine(renderer);
                        if (!engine || !activeBlocks.has(block))
                            return result;
                        const output = engine.render(block);
                        const outputs = collected.get(renderer) ?? [];
                        outputs.push(output);
                        collected.set(renderer, outputs);
                        return options.apply(result, output, { block, engine });
                    },
                },
            },
            combineBlocks(rendered, components, renderOptions, renderer) {
                const result = previousCombine?.(rendered, components, renderOptions, renderer) ?? rendered;
                if (!renderer || renderOptions?.parent)
                    return result;
                const outputs = collected.get(renderer) ?? [];
                collected.delete(renderer);
                const engine = options.getEngine(renderer);
                if (!engine || engine.css === "external")
                    return result;
                const css = compileBlockStyleRules(outputs);
                return css ? options.complete(result, css) : result;
            },
        };
    };
}
