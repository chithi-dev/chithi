'use client';

import { createContext, useContext, ReactNode } from 'react';

const ApiSpecContext = createContext<any>(null);

export function ApiSpecProvider({
    spec,
    children,
}: {
    spec: any;
    children: ReactNode;
}) {
    return (
        <ApiSpecContext.Provider value={spec}>
            {children}
        </ApiSpecContext.Provider>
    );
}

export function useApiSpec() {
    return useContext(ApiSpecContext);
}
