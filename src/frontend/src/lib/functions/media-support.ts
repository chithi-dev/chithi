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

const loadFeatureForMime = async (mime: string): Promise<CaniuseFeature | null> => {
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

const getBrowserInfo = (): BrowserInfo | null => {
	if (typeof navigator === 'undefined') return null;

	const parser = Bowser.getParser(navigator.userAgent);
	const browser = parser.getBrowser();
	const os = parser.getOS();
	const platform = parser.getPlatform();

	const version = parseVersion(browser.version ?? null);
	if (version === null) return null;

	const isMobile = platform.type === 'mobile' || platform.type === 'tablet';
	const name = browser.name;

	let agent: AgentKey | null = os.name === 'iOS' ? 'ios_saf'
		: isMobile && name === 'Chrome' ? 'and_chr'
		: isMobile && name === 'Firefox' ? 'and_ff'
		: isMobile && name === 'UC Browser' ? 'and_uc'
		: isMobile && name === 'QQ Browser' ? 'and_qq'
		: isMobile && name === 'Baidu' ? 'baidu'
		: isMobile && name === 'Android Browser' ? 'android'
		: isMobile && name === 'BlackBerry' ? 'bb'
		: isMobile && name === 'Opera Mini' ? 'op_mini'
		: isMobile && name === 'Opera' ? 'op_mob'
		: isMobile && name === 'Internet Explorer' ? 'ie_mob'
		: name === 'Chrome' ? 'chrome'
		: name === 'Firefox' ? 'firefox'
		: name === 'Microsoft Edge' ? 'edge'
		: name === 'Opera' ? 'opera'
		: name === 'Safari' ? 'safari'
		: name === 'Samsung Internet for Android' ? 'samsung'
		: name === 'Internet Explorer' ? 'ie'
		: null;

	if (!agent) return null;
	return { agent, version };
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

		if (Object.values(versions).some(isSupported)) {
			supported.push(agent as AgentKey);
		}
	}

	return supported;
};

export const getImageSupportInfo = async (mime: string): Promise<ImageSupportInfo> => {
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

	if (minVersion === null) {
		return {
			status: 'unsupported',
			message
		};
	}

	return {
		status: browser.version >= minVersion ? 'supported' : 'unsupported',
		message
	};
};
