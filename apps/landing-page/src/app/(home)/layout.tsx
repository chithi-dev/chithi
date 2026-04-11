import HomeLayoutClient from './layout.client';

export default async function HomeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Fetch latest release to show the tag version in the navbar
    let release = null;
    try {
        const response = await fetch(
            'https://api.github.com/repos/chithi-dev/chithi/releases/latest',
            {
                headers: {
                    ...(process.env.GITHUB_TOKEN && {
                        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
                    }),
                },
                next: { revalidate: 3600 },
            },
        );
        if (response.ok) {
            release = await response.json();
        }
    } catch (error) {
        console.error('Failed to fetch latest release', error);
    }

    return <HomeLayoutClient release={release}>{children}</HomeLayoutClient>;
}
