'use client';

import { ProgressProvider } from '@bprogress/next/app';

const Providers = ({ children }: Readonly<{ children: React.ReactNode }>) => {
    return (
        <ProgressProvider
            height="4px"
            color="var(--color-purple-500)"
            options={{ showSpinner: false }}
            shallowRouting
        >
            {children}
        </ProgressProvider>
    );
};

export default Providers;
