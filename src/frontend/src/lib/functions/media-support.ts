import { feature } from 'caniuse-lite';

// @ts-expect-error: type is not available
import avifData from 'caniuse-lite/data/features/avif';

// @ts-expect-error: type is not available
import heifData from 'caniuse-lite/data/features/heif';

// @ts-expect-error: type is not available
import webpData from 'caniuse-lite/data/features/webp';

type CaniuseStats = Record<string, Record<string, string>>;

type CaniuseFeature = {
	stats: CaniuseStats;
};

type SupportStatus = 'supported' | 'unsupported' | 'unknown';

export type ImageSupportInfo = {
	status: SupportStatus;
	message: string | null;
};

const toFeature = (data: unknown) => feature(data as never) as CaniuseFeature;

const featureByMime: Record<string, CaniuseFeature> = {
	'image/avif': toFeature(avifData),
	'image/heif': toFeature(heifData),
	'image/heic': toFeature(heifData),
	'image/webp': toFeature(webpData)
};

const agentLabels = {
	chrome: 'Chrome',
	edge: 'Edge',
	firefox: 'Firefox',
	safari: 'Safari',
	ios_saf: 'iOS Safari',
	and_chr: 'Chrome Android',
	and_ff: 'Firefox Android',
	opera: 'Opera',
	samsung: 'Samsung Internet'
} as const;

type AgentKey = keyof typeof agentLabels;

type BrowserInfo = {
	agent: AgentKey;
	version: number;
};

const isSupported = (value: string) => value.includes('y') || value.includes('a');

const parseVersion = (value: string | null) => {
	if (!value) return null;
	const parsed = Number.parseFloat(value);
	return Number.isNaN(parsed) ? null : parsed;
};

const parseIosVersion = (ua: string) => {
	const match = ua.match(/OS (\d+)(?:[_.](\d+))?/);
	if (!match) return null;
	const major = match[1];
	const minor = match[2] ?? '0';
	return parseVersion(`${major}.${minor}`);
};

const getBrowserInfo = (): BrowserInfo | null => {
	if (typeof navigator === 'undefined') return null;
	const ua = navigator.userAgent;
	const isiOS = /iPad|iPhone|iPod/.test(ua);
	const isAndroid = /Android/.test(ua);

	if (isiOS) {
		const version = parseIosVersion(ua);
		if (!version) return null;
		return { agent: 'ios_saf', version };
	}

	const edgeVersion = parseVersion(ua.match(/Edg\/(\d+(?:\.\d+)?)/)?.[1] ?? null);
	if (edgeVersion) return { agent: 'edge', version: edgeVersion };

	const operaVersion = parseVersion(ua.match(/OPR\/(\d+(?:\.\d+)?)/)?.[1] ?? null);
	if (operaVersion) return { agent: 'opera', version: operaVersion };

	const firefoxVersion = parseVersion(ua.match(/Firefox\/(\d+(?:\.\d+)?)/)?.[1] ?? null);
	if (firefoxVersion) return { agent: isAndroid ? 'and_ff' : 'firefox', version: firefoxVersion };

	const chromeVersion = parseVersion(ua.match(/Chrome\/(\d+(?:\.\d+)?)/)?.[1] ?? null);
	if (chromeVersion) return { agent: isAndroid ? 'and_chr' : 'chrome', version: chromeVersion };

	const safariVersion = parseVersion(ua.match(/Version\/(\d+(?:\.\d+)?)/)?.[1] ?? null);
	if (safariVersion && /Safari\//.test(ua)) return { agent: 'safari', version: safariVersion };

	return null;
};

const getMinSupportedVersion = (stats: Record<string, string>) => {
	let minVersion: number | null = null;

	for (const [version, support] of Object.entries(stats)) {
		if (!isSupported(support)) continue;
		const numeric = parseVersion(version.split('-')[0]);
		if (numeric === null) continue;
		minVersion = minVersion === null ? numeric : Math.min(minVersion, numeric);
	}

	return minVersion;
};

const getSupportedAgents = (stats: CaniuseStats) => {
	const supported: AgentKey[] = [];

	for (const [agent, versions] of Object.entries(stats)) {
		if (!Object.hasOwn(agentLabels, agent)) continue;
		if (Object.values(versions).some(isSupported)) supported.push(agent as AgentKey);
	}

	return supported;
};

export const getImageSupportInfo = (mime: string): ImageSupportInfo => {
	const featureData = featureByMime[mime];
	if (!featureData) return { status: 'unknown', message: null };

	const supportedAgents = getSupportedAgents(featureData.stats).map((agent) => agentLabels[agent]);
	const message = supportedAgents.length ? `Supported in: ${supportedAgents.join(', ')}.` : null;
	const browser = getBrowserInfo();
	if (!browser) return { status: 'unknown', message };

	const agentStats = featureData.stats[browser.agent];
	if (!agentStats) return { status: 'unknown', message };

	const minVersion = getMinSupportedVersion(agentStats);
	if (minVersion === null) return { status: 'unsupported', message };
	return { status: browser.version >= minVersion ? 'supported' : 'unsupported', message };
};
