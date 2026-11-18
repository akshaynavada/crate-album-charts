import { createContext, useContext, useEffect, type ReactNode } from "react";
import { resolveTheme, type ResolvedTheme } from "@/lib/theme";

const ThemeCtx = createContext<ResolvedTheme>(resolveTheme(undefined));

/** Theme applied to whatever is inside, for portals (dialogs) that render outside the wrapper. */
export const useCrateTheme = () => useContext(ThemeCtx);

/** Adds a Google Fonts <link> once per URL. */
export function useFontLink(href: string | null) {
  useEffect(() => {
    if (!href || document.querySelector(`link[data-crate-font="${CSS.escape(href)}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = href; l.dataset["crateFont"] = href;
    document.head.appendChild(l);
  }, [href]);
}

/**
 * Scopes a crate theme to its children via CSS variables (validated hex colours + allowlisted fonts only),
 * so every bg-background / text-primary / font-display utility inside picks it up.
 */
export function ThemeScope({ theme, className = "", children, as: Tag = "div" }: {
  theme: ResolvedTheme; className?: string; children: ReactNode; as?: "div" | "section";
}) {
  useFontLink(theme.fontHref);
  return (
    <ThemeCtx.Provider value={theme}>
      <Tag {...theme.attrs} style={theme.style} className={`crate-scope bg-background font-sans text-foreground ${className}`}>
        {children}
      </Tag>
    </ThemeCtx.Provider>
  );
}
