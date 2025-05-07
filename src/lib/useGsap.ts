// src/lib/useGsap.ts
import { useEffect, RefObject } from 'react';
import gsap, { GSAPTweenVars } from 'gsap';

/**
 * useGsap - React hook for animating elements with GSAP
 * @param ref - React ref to the element to animate
 * @param vars - GSAP animation vars
 * @param deps - Dependency array to re-run the animation
 */
export function useGsap(ref: RefObject<HTMLElement>, vars: GSAPTweenVars, deps: any[] = []) {
  useEffect(() => {
    if (ref.current) {
      gsap.fromTo(ref.current, vars.from || {}, vars.to || {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default gsap;
