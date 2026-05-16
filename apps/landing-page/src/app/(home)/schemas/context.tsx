'use client';

import { createContext, ReactNode, useContext } from 'react';

const ApiSpecContext = createContext<object | null>(null);

export function ApiSpecProvider({
    spec,
    children,
}: {
    spec: object;
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
