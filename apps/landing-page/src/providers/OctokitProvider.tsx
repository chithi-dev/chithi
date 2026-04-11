'use client';

import { createContext, useContext } from 'react';
import { Octokit } from 'octokit';

// Module-level singleton Octokit instance
const octokitSingleton = new Octokit({
    auth: process.env.GITHUB_TOKEN || undefined,
});

// export the singleton for server-side modules that cannot use hooks
export const octokit = octokitSingleton;

export const OctokitContext = createContext<Octokit | null>(octokitSingleton);

export function OctokitProvider({ children }: { children: React.ReactNode }) {
    return (
        <OctokitContext.Provider value={octokitSingleton}>
            {children}
        </OctokitContext.Provider>
    );
}

export function useOctokit(): Octokit {
    const octokit = useContext(OctokitContext);
    if (!octokit) {
        throw new Error('useOctokit must be used within an OctokitProvider');
    }
    return octokit;
}

export default OctokitProvider;

import React, { createContext, useContext } from 'react';
import { Octokit } from 'octokit';

// Module-level singleton Octokit instance
const octokitSingleton = new Octokit({
    auth: process.env.GITHUB_TOKEN || undefined,
});

// export the singleton for server-side modules that cannot use hooks
export const octokit = octokitSingleton;

export const OctokitContext = createContext<Octokit | null>(octokitSingleton);

export function OctokitProvider({ children }: { children: React.ReactNode }) {
    return (
        <OctokitContext.Provider value={octokitSingleton}>
            {children}
        </OctokitContext.Provider>
    );
}

export function useOctokit(): Octokit {
    const octokit = useContext(OctokitContext);
    if (!octokit) {
        throw new Error('useOctokit must be used within an OctokitProvider');
    }
    return octokit;
}

export default OctokitProvider;
