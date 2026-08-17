"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Thin wrapper so the root layout (a Server Component) can mount the
// client-only provider. attribute="class" toggles the `.dark` class that
// globals.css already keys its dark tokens off; defaultTheme/enableSystem
// make "follow the OS" the default until someone picks light or dark.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
