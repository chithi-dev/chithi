import { Octokit } from 'octokit';

// Server-only Octokit singleton. Import from '@/lib/octokit.server' in server components.
export const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN || undefined });
