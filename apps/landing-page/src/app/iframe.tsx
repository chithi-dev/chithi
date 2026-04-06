'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/utils/cn';

type Size = {
    width: number;
    height: number;
};

type Props = {
    urls: string[];
    rotateMs?: number;
    cover?: boolean;
    className?: string;
    style?: React.CSSProperties;
};

export default function IframeEmbed({
    urls,
    rotateMs = 3000,
    className,
    style,
}: Props) {
    const [index, setIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [windowSize, setWindowSize] = useState<Size>({
        width: 1200,
        height: 800,
    });
    const [containerSize, setContainerSize] = useState<Size>({
        width: 0,
        height: 0,
    });

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

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const update = () => {
            const rect = el.getBoundingClientRect();
            setContainerSize({
                width: Math.max(1, rect.width),
                height: Math.max(1, rect.height),
            });
        };

        update();
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Rotation timer
    useEffect(() => {
        if (!urls || urls.length <= 1) return;
        const id = setInterval(
            () => setIndex((s) => (s + 1) % urls.length),
            rotateMs,
        );
        return () => clearInterval(id);
    }, [urls, rotateMs]);

    const scale = useMemo(() => {
        if (containerSize.width <= 0 || containerSize.height <= 0) return 1;
        const scaleX = containerSize.width / windowSize.width;
        const scaleY = containerSize.height / windowSize.height;
        return Math.min(1, Math.min(scaleX, scaleY));
    }, [containerSize, windowSize]);

    const fittedViewportSize = useMemo(
        () => ({
            width: Math.max(1, Math.round(windowSize.width * scale)),
            height: Math.max(1, Math.round(windowSize.height * scale)),
        }),
        [windowSize, scale],
    );

    if (!urls || urls.length === 0) return null;

    return (
        <div
            ref={containerRef}
            className={cn('relative h-full w-full overflow-hidden', className)}
            style={style}
        >
            {urls.map((src, i) => {
                const visible = i === index;

                return (
                    <div
                        key={src}
                        className={cn(
                            'absolute inset-0 transition-opacity duration-300',
                            visible
                                ? 'z-10 opacity-100 pointer-events-auto'
                                : 'z-0 opacity-0 pointer-events-none',
                        )}
                    >
                        <div
                            className="absolute top-1/2 left-1/2 overflow-hidden -translate-x-1/2 -translate-y-1/2"
                            style={{
                                width: `${fittedViewportSize.width}px`,
                                height: `${fittedViewportSize.height}px`,
                            }}
                        >
                            <iframe
                                src={src}
                                title={`embed-${i}`}
                                loading="lazy"
                                scrolling="yes"
                                className="absolute top-0 left-0 block border-0"
                                style={{
                                    width: `${windowSize.width}px`,
                                    height: `${windowSize.height}px`,
                                    transform: `scale(${scale})`,
                                    transformOrigin: 'top left',
                                    overflow: 'auto',
                                    WebkitOverflowScrolling: 'touch',
                                }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
