const Bowser = await import('bowser');

type CaniuseStats = Record<string, Record<string, string>>;

type CaniuseFeature = {
	stats: CaniuseStats;
};

type SupportStatus = 'supported' | 'unsupported' | 'unknown';

export type ImageSupportInfo = {
	status: SupportStatus;
	message: string | null;
};

let featurePromise: Promise<(data: unknown) => CaniuseFeature> | null = null;

const loadFeature = async () => {
	if (!featurePromise) {
		featurePromise = (async () => {
			// @ts-expect-error: type is not available
			const { default: feature } = await import('caniuse-lite/dist/unpacker/feature');
			return (data: unknown) => feature(data as never) as CaniuseFeature;
		})();
	}

	return featurePromise;
};

const featureCache = new Map<string, CaniuseFeature>();
const featureInflight = new Map<string, Promise<CaniuseFeature>>();

const loadFeatureForMime = async (featurePath: string | null, mime: string) => {
	if (!featurePath) return null;

	const cached = featureCache.get(mime);
	if (cached) return cached;

	const inflight = featureInflight.get(mime);
	if (inflight) return inflight;

	const promise = (async () => {
		const toFeature = await loadFeature();
		const data = await import(`caniuse-lite/data/features/${featurePath}`);
		const feature = toFeature(data.default);
		featureCache.set(mime, feature);
		featureInflight.delete(mime);
		return feature;
	})().catch((error) => {
		featureInflight.delete(mime);
		throw error;
	});

	featureInflight.set(mime, promise);
	return promise;
};

const mimeFeatureMap: Record<string, string> = {
	'image/avif': 'avif',
	'image/heif': 'heif',
	'image/heic': 'heif',
	'image/webp': 'webp',
	'image/jxl': 'jpegxl',
	'image/jxr': 'jpegxr'
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
	samsung: 'Samsung Internet',
	ie: 'Internet Explorer',
	op_mini: 'Opera Mini',
	android: 'Android Browser',
	bb: 'BlackBerry Browser',
	op_mob: 'Opera Mobile',
	ie_mob: 'IE Mobile',
	and_uc: 'UC Browser for Android',
	and_qq: 'QQ Browser',
	baidu: 'Baidu Browser',
	kaios: 'KaiOS Browser'
} as const;

type AgentKey = keyof typeof agentLabels;

const isSupported = (value: string) => value.includes('y') || value.includes('a');

const parseVersion = (value: string | null) => {
	if (!value) return null;
	const parsed = Number.parseFloat(value);
	return Number.isNaN(parsed) ? null : parsed;
};

const mobileBrowserMap: Record<string, AgentKey | undefined> = {
	Chrome: 'and_chr',
	Firefox: 'and_ff',
	'UC Browser': 'and_uc',
	'QQ Browser': 'and_qq',
	Baidu: 'baidu',
	'Android Browser': 'android',
	BlackBerry: 'bb',
	'Opera Mini': 'op_mob',
	Opera: 'op_mob',
	'Internet Explorer': 'ie_mob'
};

const desktopBrowserMap: Record<string, AgentKey | undefined> = {
	Chrome: 'chrome',
	Firefox: 'firefox',
	'Microsoft Edge': 'edge',
	Opera: 'opera',
	Safari: 'safari',
	'Samsung Internet for Android': 'samsung',
	'Internet Explorer': 'ie'
};

const resolveBrowserAgent = (browserName: string, platformType: string): AgentKey | undefined => {
	const maps =
		platformType === 'mobile' || platformType === 'tablet' ? mobileBrowserMap : desktopBrowserMap;
	return maps[browserName];
};

const getBrowserInfo = () => {
	if (typeof navigator === 'undefined') return null;

	const parser = Bowser.getParser(navigator.userAgent);
	const browser = parser.getBrowser();
	const os = parser.getOS();
	const platform = parser.getPlatform();

	// iOS always uses Safari engine
	if (os.name === 'iOS') {
		const version = parseVersion(browser.version ?? null);
		return version ? { agent: 'ios_saf' as AgentKey, version } : null;
	}

	const name = browser.name;
	if (!name) return null;

	const agent = resolveBrowserAgent(name, platform.type ?? 'browser');
	if (!agent) return null;

	const version = parseVersion(browser.version ?? null);
	return version ? { agent, version } : null;
};

const getMinSupportedVersion = (stats: Record<string, string>) =>
	Object.entries(stats)
		.filter(([, support]) => isSupported(support))
		.map(([version]) => parseVersion(version.split('-')[0]))
		.toSorted()
		.findLast(Boolean);

const supportedAgentsSet = new Set(Object.keys(agentLabels));

const getSupportedAgents = (stats: CaniuseStats) =>
	Object.entries(stats)
		.filter(
			([agent, versions]) =>
				supportedAgentsSet.has(agent) && Object.values(versions).some(isSupported)
		)
		.map(([agent]) => agent as AgentKey);

const unknown = { status: 'unknown' as const, message: null } as const;

export const getImageSupportInfo = async (mime: string): Promise<ImageSupportInfo> => {
	const featureData = await loadFeatureForMime(mimeFeatureMap[mime], mime).catch(() => null);
	if (!featureData) return unknown;

	const supportedAgents = getSupportedAgents(featureData.stats).map((agent) => agentLabels[agent]);
	const message = supportedAgents.length ? `Supported in: ${supportedAgents.join(', ')}.` : null;

	const browser = getBrowserInfo();
	if (!browser) return { status: 'unknown' as const, message };

	const agentStats = featureData.stats[browser.agent];
	if (!agentStats) return { status: 'unknown' as const, message };

	const minVersion = getMinSupportedVersion(agentStats);
	if (!minVersion) return { status: 'unsupported' as const, message };

	return {
		status: browser.version >= minVersion ? 'supported' : 'unsupported',
		message
	};
};
