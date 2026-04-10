'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/utils/cn';

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
    const iframeRefs = useRef<Array<HTMLIFrameElement | null>>([]);

    // Rotation timer
    useEffect(() => {
        if (!urls || urls.length <= 1) return;
        const id = setInterval(
            () => setIndex((s) => (s + 1) % urls.length),
            rotateMs,
        );
        return () => clearInterval(id);
    }, [urls, rotateMs]);

    useEffect(() => {
        iframeRefs.current[index]?.focus();
    }, [index]);

    if (!urls || urls.length === 0) return null;

    return (
        <div
            className={cn('relative h-full w-full overflow-hidden', className)}
            style={style}
        >
            {urls.map((src, i) => {
                const visible = i === index;

                return (
                    <iframe
                        ref={(el) => {
                            iframeRefs.current[i] = el;
                        }}
                        key={`${src}-${i}`}
                        src={src}
                        title={`embed-${i}`}
                        loading="lazy"
                        tabIndex={visible ? 0 : -1}
                        onMouseEnter={(event) => event.currentTarget.focus()}
                        className={cn(
                            'absolute inset-0 h-full w-full border-0 transition-opacity duration-300',
                            visible
                                ? 'z-10 opacity-100 pointer-events-auto'
                                : 'z-0 opacity-0 pointer-events-none',
                        )}
                        style={{
                            overflow: 'auto',
                            WebkitOverflowScrolling: 'touch',
                            overscrollBehavior: 'contain',
                        }}
                    />
                );
            })}
        </div>
    );
}
