import { defaultPropertyTokens, spacingPropertyGroups } from "./tokens.js";
// Group IDs match tailwind-merge 2.x (Tailwind CSS 3). Descendant properties
// deliberately do not merge with declarations on the block itself.
const groups = {
    "text-align": "text-alignment",
    "font-size": "font-size",
    "font-family": "font-family",
    "font-weight": "font-weight",
    "font-style": "font-style",
    "line-height": "leading",
    "letter-spacing": "tracking",
    "text-decoration": "text-decoration",
    "text-transform": "text-transform",
    color: "text-color",
    "background-color": "bg-color",
    "background-image": "bg-image",
    "background-size": "bg-size",
    "background-position": "bg-position",
    "background-repeat": "bg-repeat",
    "background-attachment": "bg-attachment",
    "border-radius": "rounded",
    "border-top-left-radius": "rounded-tl",
    "border-top-right-radius": "rounded-tr",
    "border-bottom-right-radius": "rounded-br",
    "border-bottom-left-radius": "rounded-bl",
    "border-color": "border-color",
    "border-width": "border-w",
    "border-style": "border-style",
    "border-top-color": "border-color-t",
    "border-right-color": "border-color-r",
    "border-bottom-color": "border-color-b",
    "border-left-color": "border-color-l",
    "border-top-width": "border-w-t",
    "border-right-width": "border-w-r",
    "border-bottom-width": "border-w-b",
    "border-left-width": "border-w-l",
    padding: "p",
    "padding-y": "py",
    "padding-x": "px",
    "padding-top": "pt",
    "padding-right": "pr",
    "padding-bottom": "pb",
    "padding-left": "pl",
    margin: "m",
    "margin-y": "my",
    "margin-x": "mx",
    "margin-top": "mt",
    "margin-right": "mr",
    "margin-bottom": "mb",
    "margin-left": "ml",
    gap: "gap",
    "row-gap": "gap-y",
    "column-gap": "gap-x",
    width: "w",
    height: "h",
    "min-width": "min-w",
    "min-height": "min-h",
    "max-width": "max-w",
    "max-height": "max-h",
    "aspect-ratio": "aspect",
    "object-fit": "object-fit",
    "object-position": "object-position",
    display: "display",
    "flex-direction": "flex-direction",
    "flex-wrap": "flex-wrap",
    "align-items": "align-items",
    "justify-content": "justify-content",
    "grid-template-columns": "grid-cols",
    "grid-column": "col-start-end",
    "grid-column-start": "col-start",
    "flex-basis": "basis",
    "flex-grow": "grow",
    "flex-shrink": "shrink",
    "box-shadow": "shadow",
    opacity: "opacity",
};
/** Optional tailwind-merge plugin; breakpoint/state-suffixed CMS classes stay separate. */
export function createBlockStylesTailwindMergePlugin(catalog) {
    const classes = catalog
        ? Object.entries(catalog.classProperties).filter(([name, property]) => {
            if (name.includes("--") || !groups[property])
                return false;
            const cssProperties = spacingPropertyGroups[property] ?? [property];
            const declaration = `{${cssProperties.map((css) => `${css}:var(--${name})`).join(";")}}`;
            const selectors = [
                `:where(.${name})`,
                `.${name}`,
                `.${name}.${name}.${name}`,
            ];
            return Object.values(catalog.rules).some((rule) => selectors.some((selector) => rule === selector + declaration));
        })
        : Object.keys(groups).map((property) => [
            `cms-${defaultPropertyTokens[property] ?? property}`,
            property,
        ]);
    return (config) => {
        const classGroups = { ...config.classGroups };
        const conflictingClassGroups = { ...config.conflictingClassGroups };
        for (const [className, property] of classes) {
            const group = groups[property];
            if (group === "font-size" && classGroups[group]) {
                // Tailwind font-size utilities can also set line-height; CMS font-size
                // only sets font-size and must not remove a separate leading utility.
                classGroups["cms-font-size"] = [
                    ...(classGroups["cms-font-size"] ?? []),
                    className,
                ];
                conflictingClassGroups["cms-font-size"] = ["font-size"];
                conflictingClassGroups["font-size"] = [
                    ...(conflictingClassGroups["font-size"] ?? []),
                    "cms-font-size",
                ];
            }
            else if (group && classGroups[group])
                classGroups[group] = [...classGroups[group], className];
        }
        return { ...config, classGroups, conflictingClassGroups };
    };
}
/** Uses the default engine's property names. */
export const withBlockStyles = createBlockStylesTailwindMergePlugin();
