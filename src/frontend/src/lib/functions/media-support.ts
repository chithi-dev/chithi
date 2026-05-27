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

type FeatureLoader = () => Promise<CaniuseFeature>;

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

const loadAvifFeature: FeatureLoader = async () => {
	const toFeature = await loadFeature();
	// @ts-expect-error: type is not available
	const { default: avifData } = await import('caniuse-lite/data/features/avif');
	return toFeature(avifData);
};

const loadHeifFeature: FeatureLoader = async () => {
	const toFeature = await loadFeature();
	// @ts-expect-error: type is not available
	const { default: heifData } = await import('caniuse-lite/data/features/heif');
	return toFeature(heifData);
};

const loadWebpFeature: FeatureLoader = async () => {
	const toFeature = await loadFeature();
	// @ts-expect-error: type is not available
	const { default: webpData } = await import('caniuse-lite/data/features/webp');
	return toFeature(webpData);
};

const loadJpegxlFeature: FeatureLoader = async () => {
	const toFeature = await loadFeature();
	// @ts-expect-error: type is not available
	const { default: jpegxlData } = await import('caniuse-lite/data/features/jpegxl');
	return toFeature(jpegxlData);
};

const loadJpegxrFeature: FeatureLoader = async () => {
	const toFeature = await loadFeature();
	// @ts-expect-error: type is not available
	const { default: jpegxrData } = await import('caniuse-lite/data/features/jpegxr');
	return toFeature(jpegxrData);
};

const featureLoaders: Record<string, FeatureLoader> = {
	'image/avif': loadAvifFeature,
	'image/heif': loadHeifFeature,
	'image/heic': loadHeifFeature,
	'image/webp': loadWebpFeature,
	'image/jxl': loadJpegxlFeature,
	'image/jxr': loadJpegxrFeature
};

const featureCache = new Map<string, CaniuseFeature>();
const featureInflight = new Map<string, Promise<CaniuseFeature>>();

const loadFeatureForMime = async (mime: string) => {
	const loader = featureLoaders[mime];
	if (!loader) return null;

	const cached = featureCache.get(mime);
	if (cached) return cached;

	const inflight = featureInflight.get(mime);
	if (inflight) return inflight;

	const promise = loader()
		.then((featureData) => {
			featureCache.set(mime, featureData);
			featureInflight.delete(mime);
			return featureData;
		})
		.catch((error) => {
			featureInflight.delete(mime);
			throw error;
		});

	featureInflight.set(mime, promise);
	return promise;
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

type PlatformType = 'browser' | 'mobile' | 'tablet';

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
	const maps = platformType === 'mobile' || platformType === 'tablet' ? mobileBrowserMap : desktopBrowserMap;
	return maps[browserName];
};

const getBrowserInfo = (): BrowserInfo | null => {
	if (typeof navigator === 'undefined') return null;

	const parser = Bowser.getParser(navigator.userAgent);
	const browser = parser.getBrowser();
	const os = parser.getOS();
	const platform = parser.getPlatform();

	const version = parseVersion(browser.version ?? null);
	if (!version) return null;

	if (os.name === 'iOS') return { agent: 'ios_saf', version };

	const name = browser.name;
	if (!name) return null;

	const agent = resolveBrowserAgent(name, platform.type ?? 'browser');
	if (!agent) return null;

	return { agent, version };
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

export const getImageSupportInfo = async (mime: string) => {
	let featureData: CaniuseFeature | null;

	try {
		featureData = await loadFeatureForMime(mime);
	} catch {
		return {
			status: 'unknown',
			message: null
		};
	}

	if (!featureData) {
		return {
			status: 'unknown',
			message: null
		};
	}

	const supportedAgents = getSupportedAgents(featureData.stats).map((agent) => agentLabels[agent]);

	const message = supportedAgents.length ? `Supported in: ${supportedAgents.join(', ')}.` : null;

	const browser = getBrowserInfo();

	if (!browser) {
		return {
			status: 'unknown',
			message
		};
	}

	const agentStats = featureData.stats[browser.agent];

	if (!agentStats) {
		return {
			status: 'unknown',
			message
		};
	}

	const minVersion = getMinSupportedVersion(agentStats);

	if (!minVersion) {
		return { status: 'unsupported' as const, message };
	}

	return {
		status: browser.version >= minVersion ? 'supported' : 'unsupported',
		message
	};
};
