'use client';

import { AppBar, Progress, Carousel } from '@skeletonlabs/skeleton-react';
import {
    Activity,
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    Code,
    Command,
    Cpu,
    Layout,
    Server,
    Terminal,
    Zap,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { PUBLIC_INSTANCE_URL } from '@/consts/urls';
import { GithubIcon as Github } from '@/icons/github';
import { useEffect } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';

type Release = { tag_name?: string } | null;

const ecosystem = [
    {
        title: 'BACKEND',
        description: 'Encrypted file serving via FastAPI & RustFS.',
        icon: Server,
        path: 'src/backend',
    },
    {
        title: 'CLI',
        description: 'Command-line interface for automation and scripting.',
        icon: Command,
        path: 'src/cli',
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
        href: 'https://docs.chithi.dev/en/latest/deployments/docker/basic/traefik/',
    },
    {
        title: 'API Reference',
        desc: 'OpenAPI/Swagger documentation.',
        icon: Code,
        href: '/scalar',
    },
    {
        title: 'Architecture',
        desc: 'Deep dive into Chithi.',
        icon: Cpu,
        href: 'https://docs.chithi.dev/en/latest/architecture/',
    },
];

const instances = [
    {
        title: 'chithi.dev',
        url: 'https://chithi.dev',
        web_src: '/public_instances/desktop/chithi.png',
        mobile_src: '/public_instances/mobile/chithi.png',
    },
    {
        title: 'valhalla.chithi.dev',
        url: 'https://valhalla.chithi.dev',
        web_src: '/public_instances/desktop/valhalla.png',
        mobile_src: '/public_instances/mobile/valhalla.png',
    },
];

const steps = [
    {
        step: '1',
        title: 'Spin it up',
        desc: 'Grab our pre-configured Docker Compose file or integrate directly with your existing Traefik proxy setup.',
    },
    {
        step: '2',
        title: 'Mount your storage',
        desc: 'Map your local volumes, generate your encryption keys, and instantly create your personal file vault.',
    },
    {
        step: '3',
        title: 'Share securely',
        desc: 'Send files to anyone. Password-protect links, set expiration dates, and own your traffic end-to-end.',
    },
];
export default function HomeClient({ release }: { release: Release }) {
    useEffect(() => {
        AOS.init({
            duration: 800,
            once: true,
        });
    }, []);

    return (
        <div className="min-h-screen overflow-x-hidden font-sans text-surface-900-100">
            {/* App Bar Navigation */}
            <div className="sticky top-0 z-50 border-surface-200-800/50 border-b bg-transparent backdrop-blur-md">
                <AppBar className="mx-auto w-full max-w-7xl bg-transparent">
                    <AppBar.Toolbar className="grid-cols-[auto_1fr_auto]">
                        <AppBar.Lead>
                            <div className="flex items-center gap-3">
                                <Image
                                    width={28}
                                    height={28}
                                    alt="logo"
                                    src="/favicon.svg"
                                    className="dark:invert-0"
                                />
                                <span className="font-bold text-base tracking-tight">
                                    CHITHI
                                </span>
                            </div>
                        </AppBar.Lead>
                        <AppBar.Headline></AppBar.Headline>
                        <AppBar.Trail>
                            <a
                                href="https://github.com/chithi-dev/chithi"
                                className="btn btn-sm hover:preset-tonal flex items-center gap-2 rounded-full border border-surface-200-800 px-4 transition-colors"
                            >
                                <Github size={16} />
                                {release?.tag_name && (
                                    <span className="opacity-50">
                                        {release.tag_name}
                                    </span>
                                )}
                            </a>
                        </AppBar.Trail>
                    </AppBar.Toolbar>
                </AppBar>
            </div>

            <main className="relative z-10 mx-auto w-full max-w-7xl px-6">
                {/* HERO SECTION */}
                <section className="relative flex flex-col items-center justify-center pt-24 pb-20 text-center md:pt-40 md:pb-32">
                    {/* Ambient Background Glow (Sedna-style) */}
                    <div className="pointer-events-none absolute left-1/2 top-1/4 -z-10 h-75 w-150 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface-900-100 opacity-10 blur-[100px] md:opacity-15 md:blur-[150px]" />

                    <div className="max-w-4xl" data-aos="fade-up">
                        <div className="badge preset-outlined-surface-200-800 mb-8 rounded-full font-medium tracking-wide">
                            End-to-End Encryption
                        </div>

                        <h1 className="mb-6 font-bold text-5xl leading-tight tracking-tighter md:text-7xl lg:text-[5rem] lg:leading-[1.1]">
                            Stop leaking files. <br />
                            <span className="text-surface-600-400">
                                Share securely.
                            </span>
                        </h1>

                        <p className="mx-auto mb-10 max-w-2xl font-light text-surface-600-400 text-xl leading-relaxed">
                            Self-hostable, open-source, and encrypted by
                            default. Built with RustFS for speed and FastAPI for
                            reliability. Take back control of your data.
                        </p>

                        <div className="flex flex-wrap items-center justify-center gap-4">
                            <a
                                href={PUBLIC_INSTANCE_URL}
                                className="btn preset-filled-primary-500 rounded-full px-8 py-3 font-bold"
                            >
                                Try a Public Instance
                            </a>
                            <a
                                href="https://github.com/chithi-dev/chithi"
                                className="btn hover:preset-tonal rounded-full border border-surface-200-800 px-8 py-3 font-bold transition-all"
                            >
                                View Documentation
                            </a>
                        </div>
                    </div>
                </section>

                {/* DEPLOYMENT / NUMBERED FEATURES SECTION */}
                <section className="py-24 md:py-32">
                    <div
                        className="mx-auto mb-16 max-w-3xl text-center"
                        data-aos="fade-up"
                    >
                        <h2 className="h2 mb-4 font-bold tracking-tight">
                            Self-host in minutes
                        </h2>
                        <p className="font-light text-lg text-surface-600-400 leading-relaxed">
                            Simple, flexible deployment for your home lab or
                            VPS. Spin up our Docker containers and take back
                            ownership of your files.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
                        {steps.map((feat, i) => (
                            <div
                                key={i}
                                data-aos="fade-up"
                                data-aos-delay={i * 100}
                                className="group flex flex-col space-y-4 rounded-2xl border border-surface-200-800 bg-surface-100-900/30 p-8 transition-all hover:bg-surface-100-900/80"
                            >
                                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/10 font-bold font-mono text-lg text-primary-500">
                                    {feat.step}
                                </div>
                                <h3 className="font-bold text-xl">
                                    {feat.title}
                                </h3>
                                <p className="font-light text-base text-surface-600-400 leading-relaxed">
                                    {feat.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* SPEEDTEST */}
                <section className="border-surface-200-800/50 border-t py-24 md:py-32">
                    <div className="flex flex-col items-center gap-16 lg:flex-row">
                        <div className="flex-1 space-y-6" data-aos="fade-right">
                            <h2 className="h2 font-bold tracking-tight">
                                Built-in Speedtest
                            </h2>
                            <p className="font-light text-lg text-surface-600-400 leading-relaxed">
                                Diagnose your network capabilities directly from
                                the interface. Measure throughput to the server
                                to ensure optimal file transfer rates before you
                                start, all within the Chithi dashboard.
                            </p>
                            <ul className="space-y-4 pt-4 font-light text-sm text-surface-600-400">
                                <li className="flex items-center gap-3">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary-500"></div>
                                    Real-time bandwidth assessment
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary-500"></div>
                                    Continuous connection evaluation
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary-500"></div>
                                    Server to client latency tracking
                                </li>
                            </ul>
                        </div>
                        <div className="w-full flex-1" data-aos="fade-left">
                            <div className="card relative space-y-8 overflow-hidden rounded-3xl border border-surface-200-800 bg-surface-100-900/50 p-8">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="mb-2 flex items-center gap-3">
                                            <Activity
                                                className="text-primary-500"
                                                size={24}
                                            />
                                            <h3 className="h3 font-bold text-lg">
                                                Network Status
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="badge preset-soft-primary-500 rounded-full font-bold tracking-wider">
                                        EVALUATING
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <div className="flex flex-col items-start justify-center rounded-2xl border border-surface-200-800 bg-surface-50-950/80 p-6">
                                        <div className="mb-4 flex items-center gap-2 font-medium text-surface-600-400 text-xs uppercase tracking-widest">
                                            <ArrowDown
                                                size={14}
                                                className="text-secondary-500"
                                            />{' '}
                                            Download
                                        </div>
                                        <div className="mb-1 font-bold text-3xl tracking-tight">
                                            622.5{' '}
                                            <span className="font-light text-sm text-surface-600-400">
                                                Mbps
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-start justify-center rounded-2xl border border-surface-200-800 bg-surface-50-950/80 p-6">
                                        <div className="mb-4 flex items-center gap-2 font-medium text-surface-600-400 text-xs uppercase tracking-widest">
                                            <ArrowUp
                                                size={14}
                                                className="text-tertiary-500"
                                            />{' '}
                                            Upload
                                        </div>
                                        <div className="mb-1 font-bold text-3xl tracking-tight">
                                            396.6{' '}
                                            <span className="font-light text-sm text-surface-600-400">
                                                Mbps
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2">
                                    <div className="flex justify-between font-medium text-surface-500-400 text-xs uppercase tracking-widest">
                                        <span>Test Progress</span>
                                        <span className="text-primary-500">
                                            21%
                                        </span>
                                    </div>
                                    <Progress
                                        value={21}
                                        max={100}
                                        className="h-1.5"
                                    >
                                        <Progress.Track className="h-1.5 rounded-full bg-surface-200-800">
                                            <Progress.Range className="rounded-full bg-primary-500" />
                                        </Progress.Track>
                                    </Progress>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ARCHITECTURE SECTION */}
                <section className="border-surface-200-800/50 border-t py-24 md:py-32">
                    <div className="mb-16" data-aos="fade-up">
                        <div className="badge preset-outlined-surface-200-800 mb-6 rounded-full font-medium uppercase tracking-widest">
                            Architecture
                        </div>
                        <h2 className="h2 mb-4 font-bold tracking-tight">
                            Full coverage across all systems
                        </h2>
                        <p className="max-w-2xl font-light text-lg text-surface-600-400 leading-relaxed">
                            Chithi comes with modular components supported out
                            of the box, ensuring seamless integration whether
                            you need a rich web UI, an embedded TUI, or a
                            high-performance backend serving API traffic.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                        {ecosystem.map((item, i) => (
                            <div
                                key={i}
                                data-aos="fade-up"
                                data-aos-delay={i * 100}
                                className="group flex flex-col space-y-4 rounded-2xl border border-surface-200-800 bg-surface-100-900/40 p-8 transition-colors hover:border-surface-300-700"
                            >
                                <div className="mb-4 flex items-center justify-between">
                                    <item.icon
                                        size={28}
                                        className="text-surface-600-400 transition-colors group-hover:text-primary-500"
                                    />
                                </div>
                                <h3 className="h3 font-bold text-lg">
                                    {item.title}
                                </h3>
                                <p className="font-light text-base text-surface-600-400 leading-relaxed">
                                    {item.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* DOCUMENTATION */}
                <section
                    id="docs"
                    className="border-surface-200-800/50 border-t py-24 md:py-32"
                >
                    <div className="mb-16 grid grid-cols-1 gap-8 md:grid-cols-2 md:items-end">
                        <div data-aos="fade-right">
                            <h2 className="h2 mb-4 font-bold tracking-tight">
                                Open Source & Fully Documented
                            </h2>
                            <p className="font-light text-lg text-surface-600-400 leading-relaxed">
                                Detailed guides for self-hosting, contributing,
                                and hacking on the API. Everything you need to
                                run Chithi your way.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        {data.map((doc, i) => (
                            <Link
                                key={i}
                                href={doc.href}
                                data-aos="fade-up"
                                data-aos-delay={i * 100}
                                className="group flex flex-col rounded-2xl border border-surface-200-800 bg-surface-100-900/30 p-8 transition-all hover:bg-surface-100-900/80"
                            >
                                <div className="mb-6">
                                    <doc.icon
                                        size={24}
                                        className="text-surface-500-400"
                                    />
                                </div>
                                <h3 className="h3 mb-2 flex items-center gap-2 font-bold text-lg">
                                    {doc.title}
                                    <ArrowRight
                                        size={18}
                                        className="-translate-x-2 text-primary-500 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                                    />
                                </h3>
                                <p className="font-light text-base text-surface-600-400 leading-relaxed">
                                    {doc.desc}
                                </p>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* GLOBAL NETWORK / IFRAMES */}
                <section className="border-surface-200-800/50 border-t py-24 md:py-32">
                    <div
                        className="mx-auto mb-12 max-w-3xl text-center"
                        data-aos="fade-up"
                    >
                        <h2 className="h2 mb-4 font-bold tracking-tight">
                            Try the Public Instances
                        </h2>
                        <p className="font-light text-lg text-surface-600-400 leading-relaxed">
                            Not ready to self-host? Experience Chithi
                            immediately by interacting with our community-hosted
                            public instances directly from your browser.
                        </p>
                    </div>

                    <div className="mx-auto max-w-5xl px-6">
                        <div
                            className="relative aspect-3/6 md:aspect-video w-full overflow-hidden rounded-2xl border border-surface-200-800 bg-surface-100-900/30 p-2 shadow-xl"
                            data-aos="fade-up"
                        >
                            <div className="relative h-full w-full overflow-hidden rounded-xl border border-surface-200-800 bg-surface-900-100">
                                <Carousel
                                    autoplay={{ delay: 3500 }}
                                    loop={true}
                                    className="group flex h-full w-full flex-col"
                                    slideCount={0}
                                >
                                    <div className="relative h-full w-full overflow-hidden">
                                        <Carousel.ItemGroup className="flex h-full w-full touch-pan-x snap-x snap-mandatory">
                                            {instances.map((instance, i) => (
                                                <Carousel.Item
                                                    index={i}
                                                    className="h-full min-w-full shrink-0 grow-0 snap-center"
                                                >
                                                    <a
                                                        href={instance.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="group relative block h-full w-full"
                                                    >
                                                        <Image
                                                            src={
                                                                instance.web_src
                                                            }
                                                            alt={`${instance.title} Desktop`}
                                                            fill
                                                            className="hidden object-cover transition-transform duration-500 group-hover:scale-105 group-hover:opacity-40 md:block"
                                                        />
                                                        <Image
                                                            src={
                                                                instance.mobile_src
                                                            }
                                                            alt={`${instance.title} Mobile`}
                                                            fill
                                                            className="block object-cover transition-transform duration-500 group-hover:scale-105 group-hover:opacity-40 md:hidden"
                                                        />

                                                        {/* Hover Overlay */}
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:opacity-100">
                                                            <div className="btn preset-filled-primary-500 rounded-full font-bold shadow-2xl">
                                                                Visit{' '}
                                                                {instance.title}{' '}
                                                                <ArrowRight
                                                                    size={16}
                                                                    className="ml-2 inline-block"
                                                                />
                                                            </div>
                                                        </div>
                                                    </a>
                                                </Carousel.Item>
                                            ))}
                                        </Carousel.ItemGroup>

                                        {/* Overlapping controls */}
                                        <Carousel.Control className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full border border-surface-200-800 bg-surface-50-950/80 px-4 py-2 opacity-0 shadow-lg backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
                                            <Carousel.PrevTrigger className="btn-icon btn-icon-sm hover:preset-tonal text-surface-500-400 transition-colors hover:text-primary-500">
                                                <ArrowLeft size={16} />
                                            </Carousel.PrevTrigger>
                                            <Carousel.IndicatorGroup className="mt-0">
                                                <Carousel.Context>
                                                    {(carousel) =>
                                                        carousel.pageSnapPoints.map(
                                                            (_, i) => (
                                                                <Carousel.Indicator
                                                                    className="h-2 w-2 cursor-pointer rounded-full bg-surface-300-700 transition-colors hover:bg-primary-500/50 data-current:bg-primary-500"
                                                                    index={i}
                                                                />
                                                            ),
                                                        )
                                                    }
                                                </Carousel.Context>
                                            </Carousel.IndicatorGroup>
                                            <Carousel.NextTrigger className="btn-icon btn-icon-sm hover:preset-tonal text-surface-500-400 transition-colors hover:text-primary-500">
                                                <ArrowRight size={16} />
                                            </Carousel.NextTrigger>
                                        </Carousel.Control>
                                    </div>
                                </Carousel>
                            </div>
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section
                    id="public"
                    className="border-surface-200-800/50 border-t py-24 text-center md:py-32"
                >
                    <div
                        className="mx-auto max-w-4xl space-y-8 rounded-3xl border border-surface-200-800 bg-surface-100-900/30 px-6 py-20 text-center"
                        data-aos="zoom-in-up"
                    >
                        <h2 className="h1 mx-auto max-w-2xl font-bold tracking-tighter">
                            Take back ownership of your files.
                        </h2>
                        <p className="mx-auto max-w-2xl font-light text-lg text-surface-600-400 leading-relaxed">
                            Join the open-source community protecting their data
                            from big tech, analytics tracking, and opaque
                            privacy policies.
                        </p>

                        <div className="flex flex-col items-center justify-center gap-6 pt-8 sm:flex-row">
                            <Link
                                href={PUBLIC_INSTANCE_URL}
                                className="btn preset-filled-primary-500 btn-lg rounded-full px-10 font-bold"
                            >
                                Try a Public Instance
                            </Link>
                            <Link
                                href="#docs"
                                className="font-medium text-surface-600-400 transition-colors hover:text-white"
                            >
                                Read the Docs &rarr;
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            {/* FOOTER */}
            <footer className="border-surface-200-800 border-t bg-surface-50-950 px-6 py-12">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
                    <div className="font-bold text-sm text-surface-600-400 tracking-widest">
                        CHITHI PROJECT
                    </div>
                    <div className="flex gap-8 font-medium text-sm text-surface-500-400">
                        <Link
                            href="#"
                            className="transition-colors hover:text-primary-500"
                        >
                            Updates
                        </Link>
                        <Link
                            href="#"
                            className="transition-colors hover:text-primary-500"
                        >
                            Privacy Policy
                        </Link>
                        <Link
                            href="#"
                            className="transition-colors hover:text-primary-500"
                        >
                            Terms of Service
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
