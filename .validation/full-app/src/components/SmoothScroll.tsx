import React, { useEffect } from 'react';
import { ReactLenis, useLenis } from 'lenis/react';
import 'lenis/dist/lenis.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface SmoothScrollProps {
  children: React.ReactNode;
  options?: {
    duration?: number;
    smoothWheel?: boolean;
    [key: string]: any;
  };
  // Root mode (default) scrolls the whole window/document — the original
  // usage. FIXED_HEADER.md's fixed-header/fixed-sidebar layout requires the
  // browser body to never scroll, so AppShell.tsx uses root={false} to scope
  // Lenis to just its own content region instead: ReactLenis then renders
  // its own wrapper/content div pair around `children` rather than managing
  // document scroll. `className` lands on that auto-generated wrapper (via
  // ReactLenis's own prop passthrough) so callers can target it with CSS/
  // GSAP ScrollTrigger's `scroller` option.
  root?: boolean;
  className?: string;
}

const SmoothScroll: React.FC<SmoothScrollProps> = ({ children, options, root = true, className }) => {
  // 1.2s (Lenis's own library default) is tuned for slow, dramatic
  // marketing-site scroll — inside a dense dashboard it reads as lag,
  // especially reversing direction (scroll up right after scrolling down),
  // since Lenis has to smoothly redirect the virtual scroll position
  // instead of snapping immediately like native scroll does. 0.55s keeps
  // the inertia feel (smoothWheel) without the noticeable delay.
  const defaultOptions = { duration: 0.55, smoothWheel: true };
  const mergedOptions = { ...defaultOptions, ...options };

  return (
    <ReactLenis root={root} className={className} options={mergedOptions}>
      <ScrollSync />
      {children as any}
    </ReactLenis>
  );
};

function ScrollSync() {
  const lenis = useLenis();

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
  }, []);

  useEffect(() => {
    if (!lenis) return;

    const onScroll = () => {
      ScrollTrigger.update();
    };

    lenis.on('scroll', onScroll);
    ScrollTrigger.refresh();

    return () => {
      lenis.off('scroll', onScroll);
    };
  }, [lenis]);

  // "Scroll stuck at [x]" bug (reported live on the OSINT page after
  // FIX_OSINT_LAYOUT.md): Lenis only recalculates its scroll limit when its
  // own ResizeObserver sees the WRAPPER or CONTENT element's *own box size*
  // change (packages/core/src/dimensions.ts). AppShell.css intentionally
  // pins the Lenis content div to `height: 100%` (so descendant pages can
  // resolve `min-height: 100%` against a definite ancestor) — but that same
  // fixed sizing means neither observed element's box ever actually
  // resizes when a page's content grows underneath it (e.g. OSINT/History
  // results loading async). Lenis's limit silently stays pinned to
  // whatever it was at last real resize, usually the short empty-state
  // height — so once real content pushes scrollHeight past that stale
  // limit, both wheel-driven scroll AND direct scrollTop writes get
  // clamped/reset by Lenis's own render loop right back to that limit,
  // which is exactly what "stuck" looks and feels like.
  // Fix: independently watch the DOM for the mutations that actually grow
  // page content (nodes being added, e.g. results rendering in) and force
  // Lenis to recompute (`resize()` re-reads the correct, already-accurate
  // `wrapper.scrollHeight`) shortly after. This is intentionally decoupled
  // from Lenis's own (blind, in this layout) resize detection rather than
  // undoing the height:100% chain, which other pages' percentage heights
  // depend on.
  useEffect(() => {
    if (!lenis) return;
    const target = lenis.rootElement;
    if (!target || typeof MutationObserver === 'undefined') return;

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleResize = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => lenis.resize(), 120);
    };

    const observer = new MutationObserver(scheduleResize);
    observer.observe(target, { childList: true, subtree: true, characterData: true });

    return () => {
      clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }, [lenis]);

  return (
    null
  );
}

export default SmoothScroll;
