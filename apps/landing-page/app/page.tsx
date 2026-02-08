'use client';

import AOS from 'aos';
import { useEffect, useState } from 'react';
import 'aos/dist/aos.css';
import {
    Activity,
    ArrowDown,
    ArrowRight,
    ArrowUp,
    BookOpen,
    Check,
    ChevronDown,
    ChevronUp,
    Clock,
    Code,
    Copy,
    Cpu,
    Gauge,
    Github,
    Globe,
    Layout,
    Lock,
    Server,
    Shield,
    Terminal,
    Zap,
} from 'lucide-react';
import Image from 'next/image';

const ecosystem = [
    {
        title: 'BACKEND',
        description: 'Encrypted file serving via FastAPI & RustFS.',
        icon: Server,
        path: 'src/backend',
    },
    {
        title: 'TUI',
        description: 'Terminal-based vault management.',
        icon: Terminal,
        path: 'src/tui',
    },
    {
        title: 'FRONTEND',
        description: 'SvelteKit interface for file operations.',
        icon: Layout,
        path: 'src/frontend',
    },
];
const data = [
    {
        title: 'Quick Start',
        desc: 'Deploy via Docker Compose in seconds.',
        icon: Zap,
        href: 'https://docs.chithi.dev/deployments/docker/basic/traefik/',
    },
    // {
    //     title: 'Configuration',
    //     desc: 'Environment variables & database setup.',
    //     icon: Settings,
    //     href: '#',
    // },
    {
        title: 'API Reference',
        desc: 'OpenAPI/Swagger documentation.',
        icon: Code,
        href: 'https://prod.chithi.dev/docs',
    },
    {
        title: 'Architecture',
        desc: 'Deep dive into Chithi.',
        icon: Cpu,
        href: 'https://docs.chithi.dev/architecture/',
    },
];
const _PROD_URL = 'https://chithi.dev';

export default function Home() {
    const [release, setRelease] = useState<{tag_name:string}|null>(null);
    const [copied, setCopied] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const images = [
        '/images/chithi-dev.avif',
        '/images/chithi-(dev).avif',
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prev) => (prev + 1) % images.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        AOS.init({
            duration: 600,
            once: true,
            easing: 'ease-out-quad',
        });

        fetch('https://api.github.com/repos/chithi-dev/chithi/releases/latest')
            .then((res) => res.json())
            .then((data) => setRelease(data))
            .catch(() => {});
    }, []);

    const copyCommand = () => {
        navigator.clipboard.writeText('docker compose up --build');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen overflow-x-hidden bg-[#050505] font-mono text-zinc-300 selection:bg-white selection:text-black">
            {/* --- GRID BACKGROUND --- */}
            <div
                className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
                style={{
                    backgroundImage:
                        'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                }}
            ></div>

            {/* --- NAV --- */}
            <nav className="relative z-50 border-zinc-900 border-b bg-[#050505]/80 backdrop-blur-sm">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-white font-bold text-black">
                            <Lock size={16} />
                        </div>
                        <span className="font-bold text-white tracking-tighter">
                            CHITHI
                        </span>
                    </div>

                    <div className="flex items-center gap-6 font-medium text-xs tracking-wide">
                        <a
                            href="https://public.chithi.dev"
                            className="transition-colors hover:text-white"
                        >
                            PUBLIC_INSTANCES
                        </a>
                        <a
                            href="https://docs.chithi.dev"
                            className="transition-colors hover:text-white"
                        >
                            DOCS
                        </a>
                        <a
                            href="https://github.com/chithi-dev/chithi"
                            className="flex items-center gap-2 text-white"
                        >
                            <Github size={14} />
                            GITHUB{' '}
                            {release?.tag_name && (
                                <span className="opacity-50">
                                    /{release.tag_name}
                                </span>
                            )}
                        </a>
                    </div>
                </div>
            </nav>

            <main className="relative z-10">
                {/* --- HERO SECTION --- */}
                <section className="border-zinc-900 border-b px-6 pt-24 pb-20">
                    <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 lg:grid-cols-2">
                        <div data-aos="fade-right">
                            <div className="mb-8 flex items-center gap-2 text-purple-400 text-xs uppercase tracking-widest">
                                <div className="h-2 w-2 animate-pulse rounded-full bg-purple-500"></div>
                                End-to-End Encryption
                            </div>

                            <h1 className="mb-8 font-bold text-5xl text-white leading-[0.9] tracking-tight md:text-7xl">
                                SECURE
                                <br />
                                FILE SHARING
                                <br />
                                <span className="text-zinc-600">
                                    FOR HUMANS.
                                </span>
                            </h1>

                            <p className="mb-10 max-w-md text-lg text-zinc-500 leading-relaxed">
                                Self-hostable, open-source, and encrypted by
                                default. Built with RustFS for speed and FastAPI
                                for reliability.
                            </p>

                            <div className="flex gap-4">
                                <a
                                    href="https://public.chithi.dev"
                                    className="flex h-12 items-center gap-2 rounded-sm bg-white px-6 font-bold text-black text-sm transition-colors hover:bg-zinc-200"
                                >
                                    <Globe size={16} />
                                    PUBLIC INSTANCES
                                </a>
                                <a
                                    href="https://github.com/chithi-dev/chithi"
                                    className="flex h-12 items-center gap-2 rounded-sm border border-zinc-800 px-6 text-sm text-white transition-colors hover:bg-zinc-900"
                                >
                                    <Github size={16} />
                                    SOURCE CODE
                                </a>
                            </div>
                        </div>

                        {/* --- TERMINAL PREVIEW --- */}
                        <div className="relative" data-aos="fade-left">
                            <div className="absolute -inset-1 bg-linear-to-r from-purple-500/20 to-orange-500/20 opacity-50 blur-xl"></div>
                            <div className="relative overflow-hidden rounded-md border border-zinc-800 bg-[#0a0a0a] font-mono text-xs shadow-2xl md:text-sm">
                                <div className="flex items-center justify-between border-zinc-800 border-b bg-zinc-900/50 px-4 py-2">
                                    <div className="flex gap-1.5">
                                        <div className="h-3 w-3 rounded-full bg-zinc-700"></div>
                                        <div className="h-3 w-3 rounded-full bg-zinc-700"></div>
                                        <div className="h-3 w-3 rounded-full bg-zinc-700"></div>
                                    </div>
                                    <div className="text-[10px] text-zinc-500">
                                        user@server:~
                                    </div>
                                </div>
                                <div className="space-y-4 p-6">
                                    <div className="group flex items-center justify-between">
                                        <code className="text-zinc-400">
                                            <span className="text-purple-400">
                                                $
                                            </span>{' '}
                                            docker compose up --build
                                        </code>
                                        <button
                                            onClick={copyCommand}
                                            className="text-zinc-600 transition-colors hover:text-white"
                                        >
                                            {copied ? (
                                                <Check size={14} />
                                            ) : (
                                                <Copy size={14} />
                                            )}
                                        </button>
                                    </div>
                                    <div className="space-y-1 text-zinc-500">
                                        <div>
                                            [+] Building 5.4s (12/12) FINISHED
                                        </div>
                                        <div>[+] Running 4/4</div>
                                        <div className="text-green-500">
                                            {' '}
                                            ✔ Container chithi-db Started
                                        </div>
                                        <div className="text-green-500">
                                            {' '}
                                            ✔ Container chithi-redis Started
                                        </div>
                                        <div className="text-green-500">
                                            {' '}
                                            ✔ Container chithi-backend Started
                                        </div>
                                        <div className="text-green-500">
                                            {' '}
                                            ✔ Container chithi-web Started
                                        </div>
                                    </div>
                                    <div className="border-zinc-800/50 border-t pt-2">
                                        <div className="text-white">
                                            <span className="text-blue-400">
                                                ➜
                                            </span>{' '}
                                            Local:{' '}
                                            <span className="text-white underline">
                                                http://localhost:5173
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- FEATURES GRID --- */}
                <section className="border-zinc-900 border-b px-6 py-24">
                    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 md:grid-cols-3">
                        {[
                            {
                                title: 'ZERO KNOWLEDGE',
                                desc: 'Files are encrypted client-side using AES-256-GCM before transmission. The server never sees your raw data.',
                                icon: Shield,
                            },
                            {
                                title: 'RUST PERFORMANCE',
                                desc: 'Storage backend implemented in Rust handles high-throughput I/O with minimal memory footprint.',
                                icon: Cpu,
                            },
                            {
                                title: 'OPEN SOURCE',
                                desc: 'Auditable code licensed under MPL-2.0. No tracking, no analytics, complete data sovereignty.',
                                icon: Github,
                            },
                        ].map((feat, i) => (
                            <div key={i} className="group">
                                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/50 text-zinc-400 transition-all duration-300 group-hover:border-white group-hover:bg-white group-hover:text-black">
                                    <feat.icon size={20} />
                                </div>
                                <h3 className="mb-3 font-bold text-lg text-white transition-colors group-hover:text-purple-400">
                                    {feat.title}
                                </h3>
                                <p className="text-sm text-zinc-500 leading-relaxed">
                                    {feat.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* --- SPEEDTEST SECTION --- */}
                <section className="border-zinc-900 border-b bg-[#050505] px-6 py-24">
                    <div className="mx-auto flex max-w-7xl flex-col items-center gap-16 lg:flex-row">
                        <div className="flex-1">
                            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/50 text-zinc-400">
                                <Gauge size={20} />
                            </div>
                            <h2 className="mb-6 font-bold text-3xl text-white">
                                BUILT-IN SPEEDTEST
                            </h2>
                            <p className="mb-8 text-lg text-zinc-500 leading-relaxed">
                                Diagnose your network capabilities directly from
                                the interface. Measure throughput to the server
                                to ensure optimal file transfer rates before you
                                start.
                            </p>
                        </div>
                        <div className="w-full flex-1">
                            <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-[#090909] p-6 shadow-2xl md:p-8">
                                {/* Header */}
                                <div className="relative z-10 mb-8 flex items-start justify-between">
                                    <div>
                                        <div className="mb-1 flex items-center gap-2">
                                            <Activity
                                                className="text-zinc-400"
                                                size={20}
                                            />
                                            <h3 className="font-bold text-lg text-white">
                                                Speedtest
                                            </h3>
                                        </div>
                                        <p className="text-[10px] text-zinc-500 md:text-xs">
                                            Check your internet connection speed
                                            to the server.
                                        </p>
                                    </div>
                                    <div className="animate-pulse font-bold text-[10px] text-zinc-600 tracking-widest">
                                        UPLOADING...
                                    </div>
                                </div>

                                {/* Gauges Grid */}
                                <div className="relative z-10 mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {/* Download Card */}
                                    <div className="group relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-lg border border-zinc-900/50 bg-[#111] p-6">
                                        <div className="absolute top-4 flex items-center gap-1 font-bold text-[10px] text-cyan-400">
                                            <ArrowDown size={12} /> Download
                                            Speed
                                        </div>
                                        <div className="relative mt-4 mb-2 h-16 w-32">
                                            <svg
                                                viewBox="0 0 100 50"
                                                className="h-full w-full transform overflow-visible"
                                            >
                                                <path
                                                    d="M 10 50 A 40 40 0 0 1 90 50"
                                                    fill="none"
                                                    stroke="#27272a"
                                                    strokeWidth="8"
                                                    strokeLinecap="round"
                                                />
                                                <path
                                                    d="M 10 50 A 40 40 0 0 1 90 50"
                                                    fill="none"
                                                    stroke="#22d3ee"
                                                    strokeWidth="8"
                                                    strokeLinecap="round"
                                                    strokeDasharray="125.6"
                                                    strokeDashoffset="30"
                                                    className="drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                                                />
                                            </svg>
                                        </div>
                                        <div className="-mt-2.5 text-center">
                                            <div className="font-bold text-2xl text-white tracking-tight">
                                                622.5
                                            </div>
                                            <div className="font-medium text-[10px] text-zinc-500">
                                                Mbps
                                            </div>
                                        </div>
                                    </div>

                                    {/* Upload Card */}
                                    <div className="group relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-lg border border-zinc-900/50 bg-[#111] p-6">
                                        <div className="absolute top-4 flex items-center gap-1 font-bold text-[10px] text-purple-500">
                                            <ArrowUp size={12} /> Upload Speed
                                        </div>
                                        <div className="relative mt-4 mb-2 h-16 w-32">
                                            <svg
                                                viewBox="0 0 100 50"
                                                className="h-full w-full transform overflow-visible"
                                            >
                                                <path
                                                    d="M 10 50 A 40 40 0 0 1 90 50"
                                                    fill="none"
                                                    stroke="#27272a"
                                                    strokeWidth="8"
                                                    strokeLinecap="round"
                                                />
                                                <path
                                                    d="M 10 50 A 40 40 0 0 1 90 50"
                                                    fill="none"
                                                    stroke="#a855f7"
                                                    strokeWidth="8"
                                                    strokeLinecap="round"
                                                    strokeDasharray="125.6"
                                                    strokeDashoffset="80"
                                                    className="drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                                                />
                                            </svg>
                                        </div>
                                        <div className="-mt-2.5 text-center">
                                            <div className="font-bold text-2xl text-white tracking-tight">
                                                396.6
                                            </div>
                                            <div className="font-medium text-[10px] text-zinc-500">
                                                Mbps
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress */}
                                <div className="relative z-10 mb-8 space-y-2">
                                    <div className="flex justify-between font-bold text-[10px] text-zinc-500 uppercase tracking-wider">
                                        <span>Progress</span>
                                        <span>21%</span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                                        <div className="h-full w-[21%] rounded-full bg-zinc-400"></div>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="relative z-10 space-y-6">
                                    <div className="flex flex-col gap-3">
                                        <label className="flex items-center gap-2 font-bold text-[10px] text-zinc-500 uppercase tracking-wide">
                                            <Clock size={12} /> Test Duration
                                            (seconds)
                                        </label>
                                        <div className="flex h-10 items-center justify-between rounded border border-zinc-800 bg-[#111] px-4 font-mono text-xs text-zinc-400">
                                            10
                                            <div className="flex flex-col gap-0.5 opacity-50">
                                                <ChevronUp size={10} />
                                                <ChevronDown size={10} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-center">
                                        <button className="flex h-10 items-center gap-2 rounded-full border border-zinc-800 bg-[#151515] px-6 font-bold text-xs text-zinc-400 transition-colors hover:bg-zinc-800">
                                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300"></div>{' '}
                                            Testing...
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- ARCHITECTURE --- */}
                <section className="border-zinc-900 border-b bg-[#080808] px-6 py-24">
                    <div className="mx-auto max-w-7xl">
                        <div className="mb-12 flex items-end justify-between">
                            <h2 className="font-bold text-2xl text-white">
                                SYSTEM ARCHITECTURE
                            </h2>
                            <span className="text-xs text-zinc-600">
                                SRC/ STRUCTURE
                            </span>
                        </div>

                        <div className="grid grid-cols-1 gap-1 md:grid-cols-3">
                            {ecosystem.map((item, i) => (
                                <div
                                    key={i}
                                    className="group border border-zinc-800 bg-[#050505] p-6 transition-colors hover:border-zinc-600"
                                >
                                    <div className="mb-8 flex items-start justify-between">
                                        <item.icon
                                            size={24}
                                            className="text-zinc-400 transition-colors group-hover:text-white"
                                        />
                                        <span className="rounded-sm border border-zinc-800 px-2 py-1 font-mono text-[10px] text-zinc-600">
                                            {item.path}
                                        </span>
                                    </div>
                                    <h3 className="mb-2 font-bold text-white">
                                        {item.title}
                                    </h3>
                                    <p className="text-xs text-zinc-500">
                                        {item.description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* --- DOCUMENTATION --- */}
                <section
                    id="docs"
                    className="border-zinc-900 border-b bg-[#050505] px-6 py-24"
                >
                    <div className="mx-auto max-w-7xl">
                        <div className="mb-16">
                            <h2 className="mb-6 font-bold text-3xl text-white">
                                DOCUMENTATION
                            </h2>
                            <p className="max-w-2xl text-zinc-500">
                                Detailed guides for administrators, developers,
                                and integrators. Everything you need to get
                                Chithi up and running.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                            {data.map((doc, i) => (
                                <a
                                    key={i}
                                    href={doc.href}
                                    className="group block rounded-sm border border-zinc-800 p-6 transition-all hover:bg-zinc-900/40"
                                >
                                    <div className="mb-4 flex items-start justify-between">
                                        <doc.icon
                                            className="text-zinc-600 transition-colors group-hover:text-white"
                                            size={24}
                                        />
                                        <BookOpen
                                            size={14}
                                            className="text-zinc-700 transition-colors group-hover:text-purple-400"
                                        />
                                    </div>
                                    <h3 className="mb-2 flex items-center gap-2 font-bold text-white">
                                        {doc.title}
                                        <ArrowRight
                                            size={14}
                                            className="-ml-2 text-purple-400 opacity-0 transition-all group-hover:ml-0 group-hover:opacity-100"
                                        />
                                    </h3>
                                    <p className="text-xs text-zinc-500 leading-relaxed">
                                        {doc.desc}
                                    </p>
                                </a>
                            ))}
                        </div>
                    </div>
                </section>

                {/* --- PUBLIC INSTANCE --- */}
                <section id="public" className="px-6 py-24">
                    <div className="mx-auto max-w-5xl text-center">
                        <h2 className="mb-6 font-bold text-3xl text-white">
                            GLOBAL NETWORK
                        </h2>
                        <p className="mx-auto mb-10 max-w-2xl text-zinc-500">
                            Choose from a variety of community-hosted public
                            instances to start sharing files securely. Find the
                            server closest to you for optimal performance.
                        </p>

                        <a
                            href="https://public.chithi.dev"
                            className="group relative inline-block w-full max-w-250"
                        >
                            <div className="relative aspect-3750/2004 w-full overflow-hidden rounded bg-black">
                                <div className="relative h-full w-full overflow-hidden rounded">
                                    {images.map((src, index) => (
                                        <Image
                                            key={src}
                                            src={src}
                                            alt="Chithi Interface"
                                            fill
                                            sizes="(max-width: 1000px) 100vw, 1000px"
                                            className={`object-contain transition-all duration-1000 ${
                                                index === currentImageIndex
                                                    ? 'z-10 opacity-80 grayscale group-hover:opacity-100 group-hover:grayscale-0'
                                                    : 'z-0 opacity-0'
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="mt-4 flex items-center justify-center gap-2 font-bold text-sm text-white transition-colors group-hover:text-purple-400">
                                BROWSE INSTANCES <ArrowRight size={16} />
                            </div>
                        </a>
                    </div>
                </section>

                {/* --- FOOTER --- */}
                <footer className="border-zinc-900 border-t bg-[#050505] px-6 py-12 text-xs">
                    <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
                        <div className="font-bold text-white">
                            CHITHI PROJECT
                        </div>
                        <div className="flex gap-8 text-zinc-600">
                            <a
                                href="#"
                                className="transition-colors hover:text-white"
                            >
                                PRIVACY
                            </a>
                            <a
                                href="#"
                                className="transition-colors hover:text-white"
                            >
                                SECURITY
                            </a>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}
