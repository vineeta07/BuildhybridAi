// The default entry has no Firebase code. The model call lives behind '@satark/core/ai'
// so apps can load Firebase only when a check actually runs.
export * from './pure';
export type { RunModel, RunResult } from './ai-adapter';
