import Link from 'next/link';
import { SiScalar } from '@icons-pack/react-simple-icons';

const SCHEMA_OPTIONS = [
    {
        id: 'scalar',
        href: '/schemas/scalar',
        icon: SiScalar,
        name: 'Scalar',
        desc: 'Modern, performant, and beautifully designed API documentation.',
        colorClass: 'bg-emerald-500', // updated for visibility
    },
];

export default function SchemasPage() {
    return (
        <div className="container mx-auto px-4 py-24 flex flex-col items-center justify-center min-h-[70vh]">
            <div className="text-center max-w-2xl mb-16 gap-6 flex flex-col items-center">
                <h1 className="h1 text-balance">API Reference</h1>
                <p className="text-surface-600-400 text-lg sm:text-xl text-balance">
                    Select your preferred interface to interact with the OpenAPI
                    specification.
                </p>
            </div>

            <div className="flex flex-wrap justify-center gap-8 w-full max-w-4xl">
                {SCHEMA_OPTIONS.map((schema) => (
                    <Link
                        key={schema.id}
                        href={schema.href}
                        className="group relative flex flex-col items-center text-center p-10 bg-surface-100-900 border border-surface-200-800 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg w-full sm:w-95"
                    >
                        <div
                            className={`${schema.colorClass} rounded-2xl w-16 h-16 flex items-center justify-center text-white mb-6 shadow-sm transition-transform group-hover:scale-110`}
                        >
                            <schema.icon className="w-8 h-8 fill-current" />
                        </div>
                        <h2 className="h2 mb-3">{schema.name}</h2>
                        <p className="text-surface-600-400">{schema.desc}</p>
                    </Link>
                ))}
            </div>
        </div>
    );
}
