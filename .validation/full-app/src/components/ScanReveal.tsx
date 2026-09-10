import React, { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// "Scroll stuck" bug (reported live on the OSINT page): every ScanReveal
// instance used to call `ScrollTrigger.refresh()` in its own rAF callback.
// A results page renders many cards (Name Checker alone can mount 20-30+
// across platforms) essentially in the same paint, so this fired the same
// expensive, page-wide refresh() dozens of times back-to-back — and GSAP's
// refresh() recalculates every trigger's start/end by briefly forcing the
// scroller to known positions to measure them. That repeated, overlapping
// forcing is what made the page feel like it snapped back / wouldn't move
// while results were still rendering. Coalescing every pending call from
// this mount burst into a single refresh() per animation frame (module-
// level, shared by all instances) keeps the same "recalculate after DOM
// settles" behavior without the redundant scroll-position churn.
let scrollTriggerRefreshScheduled = false;
function scheduleScrollTriggerRefresh() {
  if (scrollTriggerRefreshScheduled) return;
  scrollTriggerRefreshScheduled = true;
  requestAnimationFrame(() => {
    scrollTriggerRefreshScheduled = false;
    ScrollTrigger.refresh();
    ScrollTrigger.update();
  });
}

interface ScanRevealProps {
    children: React.ReactNode;
    direction?: 'left' | 'right' | 'up' | 'down';
    delay?: number;
    className?: string;
    duration?: number;
    scanColor?: string;
    triggerStart?: string;
}

const ScanReveal: React.FC<ScanRevealProps> = ({ 
    children, 
    direction = 'up', 
    delay = 0,
    className = '',
    duration = 0.8,
    scanColor = 'var(--primary-color, #00ff9d)',
    triggerStart = "top 90%"
}) => {
    const el = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!el.current) return;

        const ctx = gsap.context((self: any) => {
            const mm = gsap.matchMedia();

            mm.add("(prefers-reduced-motion: reduce)", () => {
                // Reduced motion: instant appearance, no scan line
                gsap.set(el.current, { 
                    opacity: 1, 
                    y: 0, 
                    x: 0, 
                    scale: 1, 
                    filter: 'blur(0px)' 
                });
                const scanLineEl = self?.selector ? self.selector(".scan-line") : el.current?.querySelector?.(".scan-line");
                if (scanLineEl) gsap.set(scanLineEl as any, { opacity: 0 });
            });

            mm.add("(prefers-reduced-motion: no-preference)", () => {
                // Main reveal animation
                gsap.fromTo(el.current, 
                    { 
                        opacity: 0, 
                        y: direction === 'up' ? 20 : direction === 'down' ? -20 : 0,
                        x: direction === 'left' ? 20 : direction === 'right' ? -20 : 0,
                        scale: 0.98,
                        filter: 'blur(5px)'
                    },
                    {
                        opacity: 1,
                        y: 0,
                        x: 0,
                        scale: 1,
                        filter: 'blur(0px)',
                        duration: duration,
                        delay: delay,
                        ease: "power2.out",
                        scrollTrigger: {
                            trigger: el.current,
                            // FIXED_HEADER.md: the window/body never scrolls
                            // anymore — .app-shell-scroll-region (Lenis's
                            // scoped wrapper, see AppShell.tsx) is the real
                            // scrolling element now. Falls back to the
                            // default (window) scroller harmlessly wherever
                            // this renders outside that shell (e.g. tests).
                            scroller: document.querySelector('.app-shell-scroll-region') || undefined,
                            start: triggerStart,
                            toggleActions: "play none none reverse"
                        }
                    }
                );

                const scanLineEl = self?.selector ? self.selector(".scan-line") : el.current?.querySelector?.(".scan-line");
                if (scanLineEl) {
                    gsap.fromTo(scanLineEl as any,
                        { top: '-20%', opacity: 0 },
                        {
                            top: '120%',
                            opacity: 0.8,
                            duration: 1.5,
                            ease: "power2.inOut",
                            scrollTrigger: {
                                trigger: el.current,
                                scroller: document.querySelector('.app-shell-scroll-region') || undefined,
                                start: "top 85%",
                                toggleActions: "restart none none none"
                            }
                        }
                    );
                }
            });
        }, el);

        scheduleScrollTriggerRefresh();
        if (!import.meta.env.PROD) {
            requestAnimationFrame(() => {
                const rect = el.current?.getBoundingClientRect?.();
                console.debug('[ScanReveal] ScrollTrigger refresh scheduled', { triggerStart, rect });
            });
        }

        return () => ctx.revert();
    }, [direction, delay, duration, triggerStart]);

    return (
        <div ref={el} className={`scan-reveal-wrapper ${className}`} style={{ position: 'relative', overflow: 'hidden', willChange: 'transform, opacity' }}>
            {children}
            <div className="scan-line" style={{
                position: 'absolute',
                left: 0,
                width: '100%',
                height: '4px',
                background: `linear-gradient(90deg, transparent 0%, ${scanColor} 50%, transparent 100%)`,
                boxShadow: `0 0 15px ${scanColor}`,
                zIndex: 10,
                pointerEvents: 'none',
                opacity: 0
            }} />
        </div>
    );
};

export default ScanReveal;
