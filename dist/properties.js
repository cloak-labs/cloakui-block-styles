/** Explicit property allowlist: arbitrary CSS and URLs are not style values. */
export const defaultStyleProperties = Object.fromEntries([
    "text-align",
    "font-size",
    "font-family",
    "font-style",
    "font-weight",
    "line-height",
    "letter-spacing",
    "text-decoration",
    "text-transform",
    "text-indent",
    "column-count",
    "writing-mode",
    "color",
    "background-color",
    "background-image",
    "background-size",
    "background-position",
    "background-repeat",
    "background-attachment",
    "border-radius",
    "border-top-left-radius",
    "border-top-right-radius",
    "border-bottom-right-radius",
    "border-bottom-left-radius",
    "border-color",
    "border-width",
    "border-style",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width",
    "border-top-style",
    "border-right-style",
    "border-bottom-style",
    "border-left-style",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "row-gap",
    "column-gap",
    "width",
    "height",
    "min-width",
    "min-height",
    "max-width",
    "max-height",
    "aspect-ratio",
    "object-fit",
    "object-position",
    "display",
    "flex-direction",
    "flex-wrap",
    "align-items",
    "justify-content",
    "grid-template-columns",
    "grid-column",
    "grid-column-start",
    "flex-basis",
    "flex-grow",
    "flex-shrink",
    "box-shadow",
    "text-shadow",
    "opacity",
].map((css) => [css, { css }]));
defaultStyleProperties["text-align"].validate = (value) => /^(left|right|center|justify|start|end|match-parent|inherit|initial|unset|revert|var\(--[\w-]+\))$/.test(value);
defaultStyleProperties["link-color"] = { css: "color", selector: "& a" };
defaultStyleProperties["link-hover-color"] = {
    css: "color",
    selector: "& a:hover",
};
defaultStyleProperties["link-focus-color"] = {
    css: "color",
    selector: "& a:focus",
};
defaultStyleProperties["link-focus-visible-color"] = {
    css: "color",
    selector: "& a:focus-visible",
};
defaultStyleProperties["link-active-color"] = {
    css: "color",
    selector: "& a:active",
};
/** Reject stylesheet-breaking data even for explicitly added properties. */
export function isSafeStyleValue(value) {
    if (!value.length ||
        value.length > 2048 ||
        /[;{}<>\\\x00-\x1f\x7f]/.test(value) ||
        /(?:expression\s*\(|@import)/i.test(value))
        return false;
    const withoutUrls = value.replace(/url\(\s*(["']?)(https?:\/\/[^\s"'()]+|\/(?!\/)[^\s"'()]*)\1\s*\)/gi, "");
    return !/url\s*\(/i.test(withoutUrls);
}
