/**
 * Voice Call Provider System
 *
 * Export all provider-related types and implementations
 */

export type { IVoiceCallProvider, VoiceCallConfig, IToolExecutor } from './IVoiceCallProvider';
export { OpenAIRealtimeProvider } from './OpenAIRealtimeProvider';
export { GeminiLiveProvider } from './GeminiLiveProvider';
