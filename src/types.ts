/** Names accepted by @cloakui/responsive's BreakpointOptions. Projects may add more. */
export type StandardBreakpoint =
  | "mobile"
  | "tablet"
  | "tabletWide"
  | "laptop"
  | "desktop"
  | "desktopWide";

/** A scalar or a mobile-first value object compatible with BreakpointOptions<T>. */
export type ResponsiveValue<T, K extends string = StandardBreakpoint> =
  | T
  | Partial<Record<K, T>>;

export type StyleState = "hover" | "focus" | "focus-visible" | "active";
export type StyleScalar = string | number;

/** Base is unconditional; viewports and states are additive overrides. */
export type StyleValue<K extends string = StandardBreakpoint> = {
  base?: StyleScalar;
  breakpoints?: Partial<Record<K, StyleScalar>>;
  states?: Partial<
    Record<
      StyleState,
      {
        base?: StyleScalar;
        breakpoints?: Partial<Record<K, StyleScalar>>;
      }
    >
  >;
};

export type StyleInput<K extends string = StandardBreakpoint> = Record<
  string,
  StyleScalar | StyleValue<K> | null | undefined
>;

export type Breakpoint<K extends string = string> = {
  name: K;
  /** A media condition, or null for an unconditional mobile-first value. */
  query: string | null;
};

export type StyleProperty = {
  /** CSS property to set. CSS variables, shorthands and custom properties are opt-in. */
  css: string;
  /** Trusted selector with exactly one & representing the styled block. */
  selector?: string;
  validate?: (value: string) => boolean;
};

/** Composable functional or aesthetic style behavior for a block context. */
export type StyleModule<K extends string = StandardBreakpoint> = {
  name: string;
  matches?: (context: unknown) => boolean;
  properties?: Record<string, StyleProperty>;
  defaults?: StyleInput<K> | ((context: unknown) => StyleInput<K>);
  resolve?: (style: StyleInput<K>, context: unknown) => StyleInput<K>;
};

export type StyleDiagnostic<AdditionalReason extends string = never> = {
  property: string;
  reason:
    | "unknown-property"
    | "unknown-breakpoint"
    | "invalid-value"
    | "invalid-state"
    | AdditionalReason;
  value?: unknown;
};

export type StyleOutput<AdditionalReason extends string = never> = {
  classes: string[];
  variables: Record<string, string>;
  /** Each key identifies a reusable CSS capability, not a content value. */
  rules: Record<string, string>;
  diagnostics: StyleDiagnostic<AdditionalReason>[];
};
