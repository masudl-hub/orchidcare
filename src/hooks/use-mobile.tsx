import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

/** Detects touch-primary devices via pointer capability (more accurate than width). */
export function useIsTouch() {
  const [isTouch, setIsTouch] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia("(pointer: coarse)");
    const onChange = () => setIsTouch(mql.matches);
    mql.addEventListener("change", onChange);
    setIsTouch(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isTouch;
}
