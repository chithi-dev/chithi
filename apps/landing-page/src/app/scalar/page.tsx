import { ApiReferenceReact } from '@scalar/api-reference-react';
import { OPENAPI_URL, OPENAPI_SERVER } from '@/consts/urls';
import '@scalar/api-reference-react/style.css';

export default async function References() {
    let contents = null;
    try {
        const res = await fetch(OPENAPI_URL, { next: { revalidate: 3600 } });
        if (res.ok) contents = await res.json();
    } catch {
        contents = null;
    }

    return (
        <ApiReferenceReact
            configuration={{
                content: contents,
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
