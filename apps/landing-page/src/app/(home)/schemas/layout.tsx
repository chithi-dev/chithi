import { ReactNode } from 'react';
import { OPENAPI_URL } from '@/consts/urls';
import { ApiSpecProvider } from './ApiSpecContext';

export default async function SchemasLayout({
    children,
}: {
    children: ReactNode;
}) {
    const res = await fetch(OPENAPI_URL);
    if (!res.ok) {
        throw new Error(`Failed to fetch OpenAPI spec: ${res.status}`);
    }
    const spec = await res.json();

    return (
        <ApiSpecProvider spec={spec}>
            <div className="w-full h-full">{children}</div>
        </ApiSpecProvider>
    );
}
