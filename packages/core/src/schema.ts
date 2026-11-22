import { Schema } from 'firebase/ai';
import { CATEGORIES, SEVERITIES, VERDICTS } from './types';

/** One schema, passed to both inCloudParams and onDeviceParams. */
export const analysisSchema = Schema.object({
  properties: {
    verdict: Schema.enumString({ enum: [...VERDICTS] }),
    headline: Schema.string(),
    summary: Schema.string(),
    reasons: Schema.array({
      items: Schema.object({
        properties: {
          category: Schema.enumString({ enum: [...CATEGORIES] }),
          severity: Schema.enumString({ enum: [...SEVERITIES] }),
          explanation: Schema.string(),
          quote: Schema.string(),
        },
      }),
    }),
    advice: Schema.array({ items: Schema.string() }),
  },
});
