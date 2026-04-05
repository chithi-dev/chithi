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

    // compute uniform scale
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

            // anchor to top when using cover mode so top of content is visible
            const anchorTop = !!cover;

            const wrapperStyle: React.CSSProperties = anchorTop
                ? {
                      position: 'absolute',
                      left: '50%',
                      top: 0,
                      width: `${windowSize.width}px`,
                      height: `${windowSize.height}px`,
                      transform: `translateX(-50%) scale(${scale})`,
                      transformOrigin: 'top center',
                      transition: 'opacity 300ms, transform 300ms',
                  }
                : {
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      width: `${windowSize.width}px`,
                      height: `${windowSize.height}px`,
                      transform: `translate(-50%, -50%) scale(${scale})`,
                      transformOrigin: 'center center',
                      transition: 'opacity 300ms, transform 300ms',
                  };

            return (
                <div
                    key={src}
                    style={wrapperStyle}
                    className={cn(
                        visible && 'z-10 opacity-100 pointer-events-auto',
                        !visible && 'z-0 opacity-0 pointer-events-none',
                    )}
                >
                    <iframe
                        src={src}
                        title={`embed-${i}`}
                        loading="lazy"
                        style={{
                            width: '100%',
                            height: '100%',
                            border: 0,
                            display: 'block',
                        }}
                    />
                </div>
            );
        });
    }, [urls, windowSize, index, scale]);

    return (
        <div
            ref={containerRef}
            className={cn(
                'relative h-full w-full overflow-auto rounded',
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
