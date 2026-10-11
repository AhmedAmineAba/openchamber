import React from 'react';

import { Toaster } from '@/components/ui/sonner';

// Below sonner's 600px breakpoint `mobileOffset` replaces `offset`, so both
// carry the same top: under the notch, inside the visible part of the screen.
const TOP_OFFSET = 'calc(var(--oc-safe-area-top, 0px) + var(--oc-visual-viewport-top, 0px) + 16px)';

/**
 * Sonner fixes its toaster to the layout viewport. iOS Safari does not shrink
 * that viewport for the keyboard; it pans the visible area down over it, so a
 * top-anchored toast ended up above the screen while the keyboard was open
 * (#3763). The pan is mirrored into a CSS variable the offset adds. Where the
 * keyboard resizes the page instead (Capacitor, Android), the pan stays 0.
 */
function useVisualViewportTopVariable(): void {
  React.useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    const apply = () => {
      root.style.setProperty('--oc-visual-viewport-top', `${Math.max(0, Math.round(viewport.offsetTop))}px`);
    };
    apply();
    viewport.addEventListener('scroll', apply);
    viewport.addEventListener('resize', apply);
    return () => {
      viewport.removeEventListener('scroll', apply);
      viewport.removeEventListener('resize', apply);
      root.style.removeProperty('--oc-visual-viewport-top');
    };
  }, []);
}

export function MobileToaster() {
  useVisualViewportTopVariable();
  return <Toaster position="top-center" offset={TOP_OFFSET} mobileOffset={{ top: TOP_OFFSET }} />;
}
