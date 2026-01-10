# Voice Call Provider System

This directory contains the provider abstraction layer for voice call functionality, allowing the plugin to support multiple voice call providers with optional tool integration.

## Architecture

The system uses a provider pattern to decouple voice call logic from specific provider implementations:

- **`IVoiceCallProvider.ts`**: Interface defining the contract for voice call providers
- **`OpenAIRealtimeProvider.ts`**: Base implementation for OpenAI's Realtime API
- **`OpenAIRealtimeProviderWithTools.ts`**: Extended OpenAI provider with PureChatLLMChat tool integration
- **`index.ts`**: Barrel export for convenient imports

## Tool Integration

The `OpenAIRealtimeProviderWithTools` extends the base provider to enable AI tool access during voice conversations:

- Integrates with `PureChatLLMChat` to access the tool registry
- Automatically includes tool definitions in the session configuration
- Handles tool calls from the AI in real-time
- Executes tools via the existing tool registry
- Returns tool results to the AI for continued conversation

### Example: Voice Call with Tools

```typescript
// Create chat instance for tool access
const chat = new PureChatLLMChat(plugin);

// Create provider with tool integration
const provider = new OpenAIRealtimeProviderWithTools(chat);

const voiceCall = new VoiceCall(
  provider,
  {
    apiKey: 'your-api-key',
    endpoint: 'https://api.openai.com/v1/realtime/calls',
    model: 'gpt-4o-realtime-preview-2024-12-17',
    instructions: 'You are a helpful AI assistant with tool access.',
  },
  onStateChange,
  onServerEvent,
  onRemoteTrack,
);

await voiceCall.startCall();
```

The AI can now use tools like:
- `create_note`: Create new notes
- `read_file`: Read file contents
- `search_vault`: Search across the vault
- `glob_files`: Find files by pattern
- `patch_note`: Update note content
- And many more from the tool registry

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
- Azure Cognitive Services (with tool integration)
- Google Cloud Speech (with function calling)
- AWS Transcribe (with Lambda integration)
- Custom WebRTC services
- On-premise speech services with custom tool frameworks
