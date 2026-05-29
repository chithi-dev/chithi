const Bowser = await import('bowser');

export type ImageSupportInfo = {
  status: 'supported' | 'unsupported' | 'unknown';
  message: string | null;
};

type AgentKey =
  | 'chrome' | 'edge' | 'firefox' | 'safari' | 'ios_saf' | 'and_chr' | 'and_ff'
  | 'opera' | 'samsung' | 'ie' | 'op_mini' | 'android' | 'bb' | 'op_mob' | 'ie_mob'
  | 'and_uc' | 'and_qq' | 'baidu' | 'kaios';

type CaniuseFeature = { stats: Record<string, Record<string, string>> };

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

const makeFeatureLoader = (featPath: string) => async () => {
  const toFeature = await loadFeature();
  const { default: data } = await import(featPath);
  return toFeature(data);
};

const featureLoaders: Record<string, () => Promise<CaniuseFeature>> = {
  'image/avif': makeFeatureLoader('caniuse-lite/data/features/avif'),
  'image/heif': makeFeatureLoader('caniuse-lite/data/features/heif'),
  'image/heic': makeFeatureLoader('caniuse-lite/data/features/heif'),
  'image/webp': makeFeatureLoader('caniuse-lite/data/features/webp'),
  'image/jxl': makeFeatureLoader('caniuse-lite/data/features/jpegxl'),
  'image/jxr': makeFeatureLoader('caniuse-lite/data/features/jpegxr'),
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
  const promise = loader().then((f) => { featureCache.set(mime, f); featureInflight.delete(mime); return f; })
    .catch((e) => { featureInflight.delete(mime); throw e; });
  featureInflight.set(mime, promise);
  return promise;
};

const agentLabels: Record<AgentKey, string> = {
  chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox', safari: 'Safari',
  ios_saf: 'iOS Safari', and_chr: 'Chrome Android', and_ff: 'Firefox Android',
  opera: 'Opera', samsung: 'Samsung Internet', ie: 'Internet Explorer',
  op_mini: 'Opera Mini', android: 'Android Browser', bb: 'BlackBerry Browser',
  op_mob: 'Opera Mobile', ie_mob: 'IE Mobile', and_uc: 'UC Browser for Android',
  and_qq: 'QQ Browser', baidu: 'Baidu Browser', kaios: 'KaiOS Browser',
};

const mobileMap: Record<string, AgentKey | undefined> = {
  Chrome: 'and_chr', Firefox: 'and_ff', 'UC Browser': 'and_uc',
  'QQ Browser': 'and_qq', Baidu: 'baidu', 'Android Browser': 'android',
  BlackBerry: 'bb', 'Opera Mini': 'op_mob', Opera: 'op_mob', 'Internet Explorer': 'ie_mob',
};

const desktopMap: Record<string, AgentKey | undefined> = {
  Chrome: 'chrome', Firefox: 'firefox', 'Microsoft Edge': 'edge',
  Opera: 'opera', Safari: 'safari', 'Samsung Internet for Android': 'samsung',
  'Internet Explorer': 'ie',
};

const resolveAgent = (name: string, platform: string): AgentKey | undefined =>
  (platform === 'mobile' || platform === 'tablet' ? mobileMap : desktopMap)[name];

const parseVersion = (v: string | null) => {
  if (!v) return null;
  const n = Number.parseFloat(v);
  return Number.isNaN(n) ? null : n;
};

const getBrowserInfo = (): { agent: AgentKey; version: number } | null => {
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
  const agent = resolveAgent(name, platform.type ?? 'browser');
  if (!agent) return null;
  return { agent, version };
};

const isSupported = (v: string) => v.includes('y') || v.includes('a');

const getMinSupportedVersion = (stats: Record<string, string>) =>
  Object.entries(stats)
    .filter(([, s]) => isSupported(s))
    .map(([v]) => parseVersion(v.split('-')[0]))
    .toSorted()
    .findLast(Boolean);

const supportedAgentsSet = new Set(Object.keys(agentLabels));

const getSupportedAgents = (stats: CaniuseFeature['stats']) =>
  Object.entries(stats)
    .filter(([a, v]) => supportedAgentsSet.has(a) && Object.values(v).some(isSupported))
    .map(([a]) => a as AgentKey);

const unknownInfo = (msg: string | null): ImageSupportInfo => ({ status: 'unknown', message: msg });

export const getImageSupportInfo = async (mime: string): Promise<ImageSupportInfo> => {
  let featureData: CaniuseFeature | null;
  try {
    featureData = await loadFeatureForMime(mime);
  } catch {
    return unknownInfo(null);
  }
  if (!featureData) return unknownInfo(null);

  const labels = getSupportedAgents(featureData.stats).map((a) => agentLabels[a]);
  const message = labels.length ? `Supported in: ${labels.join(', ')}.` : null;

  const browser = getBrowserInfo();
  if (!browser) return unknownInfo(message);

  const agentStats = featureData.stats[browser.agent];
  if (!agentStats) return unknownInfo(message);

  const minVersion = getMinSupportedVersion(agentStats);
  if (!minVersion) return { status: 'unsupported', message };

  return {
    status: browser.version >= minVersion ? 'supported' : 'unsupported',
    message,
  };
};
