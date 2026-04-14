'use client';

import '@scalar/api-reference-react/style.css';
import { ApiReferenceReact } from '@scalar/api-reference-react';
import { OPENAPI_SERVER } from '@/consts/urls';
import { useApiSpec } from '../ApiSpecContext';

export default function References() {
    const spec = useApiSpec();

    return (
        <ApiReferenceReact
            configuration={{
                content: spec,
                servers: [
                    {
                        url: OPENAPI_SERVER,
                        description: 'Production Server',
                    },
                ],
            }}
        />
    );
}
