'use client';

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { cn } from '@/utils/cn';

type Props = {
    urls: string[];
    rotateMs?: number;
    cover?: boolean; // if true, scale to cover parent (no black bars), otherwise contain
    className?: string;
    style?: React.CSSProperties;
};

export default function IframeEmbed({
    urls,
    rotateMs = 3000,
    cover = true,
    className,
    style,
}: Props) {
    const [index, setIndex] = useState(0);
    const [windowSize, setWindowSize] = useState<{
        width: number;
        height: number;
    } | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [containerSize, setContainerSize] = useState<{
        width: number;
        height: number;
    } | null>(null);
    const interactingRef = useRef(false);
    const savedScrollRef = useRef<number | null>(null);

    // measure window before paint
    useLayoutEffect(() => {
        const update = () =>
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    // observe container size
    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const update = () => {
            const r = el.getBoundingClientRect();
            setContainerSize({ width: r.width, height: r.height });
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // rotation timer
    useEffect(() => {
        if (!urls || urls.length <= 1) return;
        const id = setInterval(
            () => setIndex((s) => (s + 1) % urls.length),
            rotateMs,
        );
        return () => clearInterval(id);
    }, [urls, rotateMs]);

    // compute uniform scale (simple in-render calculation — let React handle memoization)
    const scale = useMemo(() => {
        if (!windowSize || !containerSize) return 1;
        if (cover) {
            return Math.max(
                containerSize.width / windowSize.width,
                containerSize.height / windowSize.height,
            );
        }
        return Math.min(
            1,
            Math.min(
                containerSize.width / windowSize.width,
                containerSize.height / windowSize.height,
            ),
        );
    }, [windowSize, containerSize, cover]);

    // body scroll lock helpers
    const lockBodyScroll = useCallback(() => {
        if (interactingRef.current) return;
        interactingRef.current = true;
        savedScrollRef.current = window.scrollY || window.pageYOffset;
        const body = document.body;
        body.style.position = 'fixed';
        body.style.top = `-${savedScrollRef.current}px`;
        body.style.left = '0';
        body.style.right = '0';
    }, []);

    const unlockBodyScroll = useCallback(() => {
        if (!interactingRef.current) return;
        interactingRef.current = false;
        const body = document.body;
        const saved = savedScrollRef.current ?? 0;
        body.style.position = '';
        body.style.top = '';
        body.style.left = '';
        body.style.right = '';
        window.scrollTo(0, saved);
        savedScrollRef.current = null;
    }, []);

    // attach pointer handlers on the container element
    const handlePointerEnter = useCallback(
        () => lockBodyScroll(),
        [lockBodyScroll],
    );
    const handlePointerLeave = useCallback(
        () => unlockBodyScroll(),
        [unlockBodyScroll],
    );

    // safety: ensure scroll is unlocked on unmount
    useEffect(() => {
        return () => unlockBodyScroll();
    }, [unlockBodyScroll]);

    const content = useMemo(() => {
        if (!windowSize) {
            return (
                <div className="absolute inset-0">
                    <iframe
                        src={urls[0]}
                        title={`embed-0`}
                        loading="lazy"
                        className="w-full h-full border-0"
                    />
                </div>
            );
        }

        return urls.map((src, i) => {
            const visible = i === index;
            const anchorTop = !!cover;

            const outerBase =
                'absolute left-1/2 transition-opacity duration-300';
            const outerPos = anchorTop ? 'top-0' : 'top-1/2';
            const visibility = visible
                ? 'z-10 opacity-100 pointer-events-auto'
                : 'z-0 opacity-0 pointer-events-none';

            const outerClass = cn(outerBase, outerPos, visibility);
            // compute layout-sized (scaled) width/height (do NOT clamp scale here)
            const scaledW = Math.max(0, Math.round(windowSize.width * scale));
            const scaledH = Math.max(0, Math.round(windowSize.height * scale));

            // Use modern CSS functions/units to keep the iframe bounded to viewport
            // while preserving the scaled size. `min()` + `dvw`/`dvh` avoid overflow
            // on mobile dynamic viewports.
            const wrapperStyle: React.CSSProperties = anchorTop
                ? ({
                      width: `min(${scaledW}px, 100dvw)`,
                      height: `min(${scaledH}px, 100dvh)`,
                      transform: 'translateX(-50%)',
                      transformOrigin: 'top center',
                      willChange: 'transform',
                  } as React.CSSProperties)
                : ({
                      width: `min(${scaledW}px, 100dvw)`,
                      height: `min(${scaledH}px, 100dvh)`,
                      transform: 'translate(-50%, -50%)',
                      transformOrigin: 'center center',
                      willChange: 'transform',
                  } as React.CSSProperties);

            return (
                <div key={src} className={outerClass} style={wrapperStyle}>
                    <iframe
                        src={src}
                        title={`embed-${i}`}
                        loading="lazy"
                        className="w-full h-full border-0 block"
                    />
                </div>
            );
        });
    }, [urls, windowSize, index, scale]);

    return (
        <div
            ref={containerRef}
            className={cn(
                'relative h-full w-full overflow-hidden rounded',
                className,
            )}
            style={style}
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
            onTouchStart={handlePointerEnter}
            onTouchEnd={handlePointerLeave}
        >
            {content}
        </div>
    );
}
