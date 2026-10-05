import { definePageMetaTags } from 'svelte-meta-tags';

export interface PageInfo {
  subtitle: string;
  title: string;
  description: string;
  ogLabel: string;
}

/** Build the common page response for information pages */
export function buildInfoPage(
  url: URL,
  info: PageInfo,
  prefetch?: () => Promise<void>
) {
  const ogUrl = new URL('/og/info', url.origin);
  ogUrl.searchParams.set('label', info.ogLabel);
  ogUrl.searchParams.set('title', info.title);
  ogUrl.searchParams.set('description', info.description);

  const pageTags = definePageMetaTags({
    title: info.title,
    description: info.description,
    openGraph: {
      title: info.title,
      description: info.description,
      images: [{ url: ogUrl.toString(), width: 1200, height: 630, alt: info.title }]
    }
  });

  return {
    prefetch,
    response: { ...pageTags, header: info }
  };
}
