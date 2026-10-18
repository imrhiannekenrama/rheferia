/**
 * Rheferia brand configuration — the single source of truth for brand
 * naming, colors, and copy used across the application.
 *
 * Brand origin: "Rheferia" is a coined blend of "Rhianne" and "references".
 * Pronunciation: reh-FEER-ee-ah.
 */

export const brand = {
  name: "Rheferia",
  tagline: "Where ideas find their sources.",
  pronunciation: "reh-FEER-ee-ah",
  origin: 'A coined blend of "Rhianne" and "references".',
  /** Feature names used in headings and marketing surfaces. */
  features: {
    search: "Rheferia Search",
    cite: "Rheferia Cite",
    tools: "Rheferia Tools",
  },
  /** Short navigation labels where space is limited. */
  nav: {
    search: "Search",
    cite: "Cite",
    tools: "Tools",
  },
  /** Honest capability language. Never claim complete internet coverage. */
  claims: {
    search: "Find relevant research and available full texts.",
  },
} as const;

/**
 * Palette starting points from the design brief. Final accessible values
 * are expressed as CSS custom properties in globals.css; these constants
 * exist for places that cannot read CSS variables (e.g. some SVG exports).
 */
export const brandColors = {
  backgroundIvory: "#F7F6F2",
  ink: "#162329",
  primaryEmerald: "#146B57",
  accentBrass: "#A17D40",
  surface: "#FFFFFF",
} as const;

export type Brand = typeof brand;
