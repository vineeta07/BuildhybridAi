import { getGenerativeModel, InferenceMode, type AI, type ModelParams } from 'firebase/ai';
import { analysisSchema } from './schema';
import { DEFAULT_CLOUD_MODEL, ON_DEVICE_MODEL_NAME } from './defaults';
import type { SdkMode, Source } from './types';

/** The only file that calls the Firebase AI Logic SDK. */
const MODE: Record<SdkMode, InferenceMode> = {
  PREFER_ON_DEVICE: InferenceMode.PREFER_ON_DEVICE,
  ONLY_ON_DEVICE: InferenceMode.ONLY_ON_DEVICE,
  PREFER_IN_CLOUD: InferenceMode.PREFER_IN_CLOUD,
  ONLY_IN_CLOUD: InferenceMode.ONLY_IN_CLOUD,
};

export interface RunResult { json: string; source: Source; latencyMs: number; model: string }
export type RunModel = (sdkMode: SdkMode, prompt: string, cloudModel?: string) => Promise<RunResult>;

export async function runModel(
  ai: AI, sdkMode: SdkMode, prompt: string, cloudModel?: string,
): Promise<RunResult> {
  // A new instance per request: config lives as long as the instance.
  // The SDK requires a model name even in hybrid mode (AI/no-model), so an empty
  // Remote Config value means the documented default, passed explicitly.
  const inCloudParams: ModelParams = {
    model: cloudModel || DEFAULT_CLOUD_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: analysisSchema,
      temperature: 0.2,
    },
  };
  const model = getGenerativeModel(ai, {
    mode: MODE[sdkMode],
    inCloudParams,
    // createOptions is omitted on purpose: in extensions the Prompt API wants
    // topK AND temperature together, or neither.
    onDeviceParams: { promptOptions: { responseConstraint: analysisSchema } },
  });

  const t0 = performance.now();
  const result = await model.generateContent(prompt);
  const latencyMs = Math.round(performance.now() - t0);
  const source = normalizeSource(result.response.inferenceSource);
  return {
    json: result.response.text(),
    source,
    latencyMs,
    model: source === 'cloud' ? cloudModel || DEFAULT_CLOUD_MODEL : ON_DEVICE_MODEL_NAME,
  };
}

/** SDK values are 'on_device' / 'in_cloud'; tolerate either case or spelling. */
export function normalizeSource(s: unknown): Source {
  const v = String(s ?? '').toUpperCase();
  if (v.includes('DEVICE')) return 'on-device';
  if (v.includes('CLOUD')) return 'cloud';
  return 'none';
}

export const bindRunModel = (ai: AI): RunModel =>
  (sdkMode, prompt, cloudModel) => runModel(ai, sdkMode, prompt, cloudModel);
