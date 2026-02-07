'use client';

import { useEffect, useState } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';
import {
    Server,
    Terminal,
    Layout,
    ArrowRight,
    Github,
    Shield,
    Lock,
    Copy,
    Check,
    Zap,
    Cpu,
    ExternalLink,
} from 'lucide-react';

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

export default function Home() {
    const [release, setRelease] = useState<any>(null);
    const [copied, setCopied] = useState(false);

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
        <div className="min-h-screen bg-[#050505] text-zinc-300 font-mono selection:bg-white selection:text-black overflow-x-hidden">
            {/* --- GRID BACKGROUND --- */}
            <div
                className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]"
                style={{
                    backgroundImage:
                        'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                }}
            ></div>

            {/* --- NAV --- */}
            <nav className="relative z-50 border-b border-zinc-900 bg-[#050505]/80 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white text-black flex items-center justify-center font-bold rounded-sm">
                            <Lock size={16} />
                        </div>
                        <span className="font-bold tracking-tighter text-white">
                            CHITHI
                        </span>
                    </div>

                    <div className="flex items-center gap-6 text-xs font-medium tracking-wide">
                        <a
                            href="https://chithi.dev"
                            className="hover:text-white transition-colors"
                        >
                            PUBLIC_INSTANCE
                        </a>
                        <a
                            href="#docs"
                            className="hover:text-white transition-colors"
                        >
                            DOCS
                        </a>
                        <a
                            href="https://github.com/chithi-dev/chithi"
                            className="text-white flex items-center gap-2"
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
                <section className="pt-24 pb-20 px-6 border-b border-zinc-900">
                    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div data-aos="fade-right">
                            <div className="flex items-center gap-2 mb-8 text-xs text-purple-400 uppercase tracking-widest">
                                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                                End-to-End Encryption
                            </div>

                            <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-8 leading-[0.9]">
                                SECURE
                                <br />
                                FILE SHARING
                                <br />
                                <span className="text-zinc-600">
                                    FOR HUMANS.
                                </span>
                            </h1>

                            <p className="text-lg text-zinc-500 mb-10 max-w-md leading-relaxed">
                                Self-hostable, open-source, and encrypted by
                                default. Built with RustFS for speed and FastAPI
                                for reliability.
                            </p>

                            <div className="flex gap-4">
                                <a
                                    href="https://chithi.dev"
                                    className="h-12 px-6 bg-white text-black font-bold flex items-center gap-2 hover:bg-zinc-200 transition-colors rounded-sm text-sm"
                                >
                                    <Zap size={16} />
                                    TRY LIVE DEMO
                                </a>
                                <a
                                    href="https://github.com/chithi-dev/chithi"
                                    className="h-12 px-6 border border-zinc-800 text-white flex items-center gap-2 hover:bg-zinc-900 transition-colors rounded-sm text-sm"
                                >
                                    <Github size={16} />
                                    SOURCE CODE
                                </a>
                            </div>
                        </div>

                        {/* --- TERMINAL PREVIEW --- */}
                        <div className="relative" data-aos="fade-left">
                            <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/20 to-orange-500/20 blur-xl opacity-50"></div>
                            <div className="relative bg-[#0a0a0a] border border-zinc-800 rounded-md shadow-2xl overflow-hidden font-mono text-xs md:text-sm">
                                <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
                                    <div className="flex gap-1.5">
                                        <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
                                        <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
                                        <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
                                    </div>
                                    <div className="text-zinc-500 text-[10px]">
                                        user@server:~
                                    </div>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="flex justify-between items-center group">
                                        <code className="text-zinc-400">
                                            <span className="text-purple-400">
                                                $
                                            </span>{' '}
                                            docker compose up --build
                                        </code>
                                        <button
                                            onClick={copyCommand}
                                            className="text-zinc-600 hover:text-white transition-colors"
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
                                    <div className="pt-2 border-t border-zinc-800/50">
                                        <div className="text-white">
                                            <span className="text-blue-400">
                                                ➜
                                            </span>{' '}
                                            Local:{' '}
                                            <span className="text-white underline">
                                                http://localhost:3000
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- FEATURES GRID --- */}
                <section className="grid grid-cols-1 md:grid-cols-3 border-b border-zinc-900">
                    <div className="p-12 border-b md:border-b-0 md:border-r border-zinc-900 hover:bg-zinc-900/20 transition-colors">
                        <Shield className="text-white mb-6" size={32} />
                        <h3 className="text-lg font-bold text-white mb-2">
                            ZERO KNOWLEDGE
                        </h3>
                        <p className="text-zinc-500 text-sm leading-relaxed">
                            Files are encrypted client-side using AES-256-GCM
                            before transmission. The server never sees your raw
                            data.
                        </p>
                    </div>
                    <div className="p-12 border-b md:border-b-0 md:border-r border-zinc-900 hover:bg-zinc-900/20 transition-colors">
                        <Cpu className="text-white mb-6" size={32} />
                        <h3 className="text-lg font-bold text-white mb-2">
                            RUST PERFORMANCE
                        </h3>
                        <p className="text-zinc-500 text-sm leading-relaxed">
                            Storage backend implemented in Rust handles
                            high-throughput I/O with minimal memory footprint.
                        </p>
                    </div>
                    <div className="p-12 hover:bg-zinc-900/20 transition-colors">
                        <Github className="text-white mb-6" size={32} />
                        <h3 className="text-lg font-bold text-white mb-2">
                            OPEN SOURCE
                        </h3>
                        <p className="text-zinc-500 text-sm leading-relaxed">
                            Auditable code licensed under MPL-2.0. No tracking,
                            no analytics, complete data sovereignty.
                        </p>
                    </div>
                </section>

                {/* --- ARCHITECTURE --- */}
                <section className="py-24 px-6 border-b border-zinc-900 bg-[#080808]">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex items-end justify-between mb-12">
                            <h2 className="text-2xl font-bold text-white">
                                SYSTEM ARCHITECTURE
                            </h2>
                            <span className="text-xs text-zinc-600">
                                SRC/ STRUCTURE
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
                            {ecosystem.map((item, i) => (
                                <div
                                    key={i}
                                    className="group border border-zinc-800 bg-[#050505] p-6 hover:border-zinc-600 transition-colors"
                                >
                                    <div className="flex justify-between items-start mb-8">
                                        <item.icon
                                            size={24}
                                            className="text-zinc-400 group-hover:text-white transition-colors"
                                        />
                                        <span className="text-[10px] text-zinc-600 border border-zinc-800 px-2 py-1 rounded-sm">
                                            {item.path}
                                        </span>
                                    </div>
                                    <h3 className="text-white font-bold mb-2">
                                        {item.title}
                                    </h3>
                                    <p className="text-zinc-500 text-xs">
                                        {item.description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* --- PUBLIC INSTANCE --- */}
                <section id="public" className="py-24 px-6">
                    <div className="max-w-5xl mx-auto text-center">
                        <h2 className="text-3xl font-bold text-white mb-6">
                            READY FOR PRODUCTION
                        </h2>
                        <p className="text-zinc-500 mb-10 max-w-2xl mx-auto">
                            We maintain a public instance for demonstration
                            purposes. It runs the `main` branch and resets data
                            periodically.
                        </p>

                        <a
                            href="https://chithi.dev"
                            className="inline-block relative group"
                        >
                            <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-orange-500 rounded blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
                            <div className="relative bg-black border border-zinc-800 rounded p-1">
                                <img
                                    src="https://github.com/chithi-dev/chithi/raw/main/assets/chithi-dev.avif"
                                    alt="Chithi Interface"
                                    className="rounded opacity-80 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0 duration-500"
                                />
                            </div>
                            <div className="mt-4 flex items-center justify-center gap-2 text-white text-sm font-bold group-hover:text-purple-400 transition-colors">
                                LAUNCH CHITHI.DEV <ArrowRight size={16} />
                            </div>
                        </a>
                    </div>
                </section>

                {/* --- FOOTER --- */}
                <footer className="py-12 px-6 border-t border-zinc-900 bg-[#050505] text-xs">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="font-bold text-white">
                            CHITHI PROJECT
                        </div>
                        <div className="flex gap-8 text-zinc-600">
                            <a
                                href="#"
                                className="hover:text-white transition-colors"
                            >
                                PRIVACY
                            </a>
                            <a
                                href="#"
                                className="hover:text-white transition-colors"
                            >
                                SECURITY
                            </a>
                            <a
                                href="https://github.com/chithi-dev/chithi"
                                className="hover:text-white transition-colors"
                            >
                                GITHUB
                            </a>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}
