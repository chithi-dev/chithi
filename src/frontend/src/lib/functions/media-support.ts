const Bowser = await import('bowser');
const { feature } = await import('caniuse-lite');

// @ts-expect-error: type is not available
const { default: avifData } = await import('caniuse-lite/data/features/avif');

// @ts-expect-error: type is not available
const { default: heifData } = await import('caniuse-lite/data/features/heif');

// @ts-expect-error: type is not available
const { default: webpData } = await import('caniuse-lite/data/features/webp');

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

	const name = browser.name;

	if (os.name === 'iOS') {
		return {
			agent: 'ios_saf',
			version
		};
	}

	if (platform.type === 'mobile' || platform.type === 'tablet') {
		if (name === 'Chrome') {
			return {
				agent: 'and_chr',
				version
			};
		}
		if (name === 'Firefox') {
			return {
				agent: 'and_ff',
				version
			};
		}
		if (name === 'UC Browser') {
			return {
				agent: 'and_uc',
				version
			};
		}
		if (name === 'QQ Browser') {
			return {
				agent: 'and_qq',
				version
			};
		}
		if (name === 'Baidu') {
			return {
				agent: 'baidu',
				version
			};
		}
		if (name === 'Android Browser') {
			return {
				agent: 'android',
				version
			};
		}
		if (name === 'BlackBerry') {
			return {
				agent: 'bb',
				version
			};
		}
		if (name === 'Opera Mini') {
			return {
				agent: 'op_mini',
				version
			};
		}
		if (name === 'Opera') {
			return {
				agent: 'op_mob',
				version
			};
		}
		if (name === 'Internet Explorer') {
			return {
				agent: 'ie_mob',
				version
			};
		}
	}

	if (name === 'Chrome') {
		return {
			agent: 'chrome',
			version
		};
	}

	if (name === 'Firefox') {
		return {
			agent: 'firefox',
			version
		};
	}

	if (name === 'Microsoft Edge') {
		return {
			agent: 'edge',
			version
		};
	}

	if (name === 'Opera') {
		return {
			agent: 'opera',
			version
		};
	}

	if (name === 'Safari') {
		return {
			agent: 'safari',
			version
		};
	}

	if (name === 'Samsung Internet for Android') {
		return {
			agent: 'samsung',
			version
		};
	}

	if (name === 'Internet Explorer') {
		return {
			agent: 'ie',
			version
		};
	}

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

		if (Object.values(versions).some(isSupported)) {
			supported.push(agent as AgentKey);
		}
	}

	return supported;
};

export const getImageSupportInfo = (mime: string): ImageSupportInfo => {
	const featureData = featureByMime[mime];

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
