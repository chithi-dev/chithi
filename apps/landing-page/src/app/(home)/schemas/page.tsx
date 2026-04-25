import { SiScalar } from '@icons-pack/react-simple-icons';
import Link from 'next/link';

const SCHEMA_OPTIONS = [
    {
        id: 'scalar',
        href: '/schemas/scalar',
        icon: SiScalar,
        name: 'Scalar',
        desc: 'Modern, performant, and beautifully designed API documentation.',
        colorClass: 'bg-emerald-500',
    },
];

export default function SchemasPage() {
    return (
        <div className="container mx-auto flex min-h-[70vh] flex-col items-center justify-center px-4 py-24">
            <div className="mb-16 flex max-w-2xl flex-col items-center gap-6 text-center">
                <h1 className="h1 text-balance">API Reference</h1>
                <p className="text-balance text-lg text-surface-600-400 sm:text-xl">
                    Select your preferred interface to interact with the OpenAPI
                    specification.
                </p>
            </div>

            <div className="flex w-full max-w-4xl flex-wrap justify-center gap-8">
                {SCHEMA_OPTIONS.map((schema) => (
                    <Link
                        key={schema.id}
                        href={schema.href}
                        className="group relative flex w-full flex-col items-center rounded-2xl border border-surface-200-800 bg-surface-100-900 p-10 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:w-95"
                    >
                        <div
                            className={`${schema.colorClass} mb-6 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-sm transition-transform group-hover:scale-110`}
                        >
                            <schema.icon className="h-8 w-8 fill-current" />
                        </div>
                        <h2 className="h2 mb-3">{schema.name}</h2>
                        <p className="text-surface-600-400">{schema.desc}</p>
                    </Link>
                ))}
            </div>
        </div>
    );
}
