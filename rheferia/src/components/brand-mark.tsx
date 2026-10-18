import { brand } from "@/lib/config/brand";

/**
 * The original Rheferia brand mark: a compass-needle / connected-knowledge
 * glyph. Simple original SVG, no copied artwork.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label={`${brand.name} mark`}
      fill="none"
    >
      {/* Compass ring */}
      <circle cx="16" cy="16" r="13.5" stroke="var(--brass)" strokeWidth="1.5" />
      {/* Needle: knowledge pointing up */}
      <path d="M16 7.5 L20 16 L16 24.5 L12 16 Z" fill="var(--primary)" />
      <circle cx="16" cy="16" r="2.25" fill="var(--card)" />
      {/* Connected-knowledge node */}
      <circle cx="24.5" cy="8.5" r="2" fill="var(--brass)" />
      <path d="M18.2 13.8 L23 9.6" stroke="var(--brass)" strokeWidth="1.25" />
    </svg>
  );
}
