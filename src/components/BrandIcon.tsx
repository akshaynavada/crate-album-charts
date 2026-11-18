import { siApplemusic, siBandcamp, siDeezer, siSpotify, siYoutube } from "simple-icons";

const ICONS = { "Apple Music": siApplemusic, Spotify: siSpotify, YouTube: siYoutube, Bandcamp: siBandcamp, Deezer: siDeezer } as const;
export type Brand = keyof typeof ICONS;

/** Brand logo (Simple Icons, CC0) in the brand's colour, or the current text colour with `mono`. */
export function BrandIcon({ name, className = "h-4 w-4", mono = false }: { name: Brand; className?: string; mono?: boolean }) {
  const i = ICONS[name];
  return (
    <svg viewBox="0 0 24 24" role="img" aria-hidden className={className} fill={mono ? "currentColor" : `#${i.hex}`}>
      <path d={i.path} />
    </svg>
  );
}
