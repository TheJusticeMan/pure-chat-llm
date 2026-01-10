# Voice Call Provider System

This directory contains the provider abstraction layer for voice call functionality, allowing the plugin to support multiple voice call providers.

## Architecture

The system uses a provider pattern to decouple voice call logic from specific provider implementations:

- **`IVoiceCallProvider.ts`**: Interface defining the contract for voice call providers
- **`OpenAIRealtimeProvider.ts`**: Implementation for OpenAI's Realtime API
- **`index.ts`**: Barrel export for convenient imports

## Adding a New Provider

To add support for a new voice call provider:

1. Create a new file implementing `IVoiceCallProvider` interface
2. Implement the required methods:
   - `startSession()`: Handle provider-specific session initialization
   - `setupDataChannel()`: Configure provider-specific data channel
   - `sendEvent()`: Send events through the provider's channel
   - `cleanup()`: Clean up provider-specific resources
   - `getName()`: Return the provider name

3. Export from `index.ts`
4. Update the UI to allow provider selection

## Example: OpenAI Realtime Provider

```typescript
const provider = new OpenAIRealtimeProvider();
const voiceCall = new VoiceCall(
  provider,
  {
    apiKey: 'your-api-key',
    endpoint: 'https://api.openai.com/v1/realtime/calls',
    model: 'gpt-realtime',
    instructions: 'You are a helpful assistant.',
  },
  onStateChange,
  onServerEvent,
  onRemoteTrack,
);

await voiceCall.startCall();
```

## Provider Configuration

The `VoiceCallConfig` interface defines common configuration options:
- `apiKey`: Authentication key for the provider
- `endpoint`: API endpoint URL
- `model`: Model/service identifier (provider-specific)
- `instructions`: System instructions or prompts
- `voice`: Voice selection (if supported)
- Additional provider-specific options via index signature

## Future Providers

Examples of providers that could be added:
- Azure Cognitive Services
- Google Cloud Speech
- AWS Transcribe
- Custom WebRTC services
- On-premise speech services
