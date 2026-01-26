# Voice Call Provider System

This directory contains the provider abstraction layer for voice call functionality, allowing the plugin to support multiple voice call providers with optional tool integration.

## Architecture

The system uses a provider pattern to decouple voice call logic from specific provider implementations:

- **`IVoiceCallProvider.ts`**: Interface defining the contract for voice call providers
- **`OpenAIRealtimeProvider.ts`**: Implementation for OpenAI's Realtime API (WebRTC) with optional tool integration
- **`GeminiLiveProvider.ts`**: Implementation for Google Gemini Live API (WebSocket) with optional tool integration
- **`index.ts`**: Barrel export for convenient imports

## Supported Providers

### OpenAI Realtime API

- Uses WebRTC with SDP exchange via unified interface
- Direct peer-to-peer audio connection
- Data channel (`oai-events`) for bidirectional events
- Supports tool calling when configured with a `PureChatLLMChat` instance

### Google Gemini Live API

- Uses WebSocket connection for real-time audio streaming
- PCM audio encoding/decoding
- Supports tool calling when configured with a `PureChatLLMChat` instance
- Voice Activity Detection built-in

## Tool Integration

Both providers (`OpenAIRealtimeProvider` and `GeminiLiveProvider`) support AI tool access during voice conversations when initialized with a chat instance:

- Integrates with `PureChatLLMChat` to access the tool registry
- Automatically includes tool definitions in the session configuration if available
- Handles tool calls from the AI in real-time
- Executes tools via the existing tool registry
- Returns tool results to the AI for continued conversation

### Example: OpenAI Voice Call with Tools

```typescript
// Create chat instance for tool access
const chat = new PureChatLLMChat(plugin);

// Create provider with tool integration
const provider = new OpenAIRealtimeProvider(chat);

const voiceCall = new VoiceCall(
  provider,
  {
    apiKey: 'your-openai-api-key',
    endpoint: 'https://api.openai.com/v1/realtime/calls',
    model: 'gpt-realtime',
    instructions: 'You are a helpful AI assistant with tool access.',
  },
  onStateChange,
  onServerEvent,
  onRemoteTrack,
);

await voiceCall.startCall();
```

### Example: Gemini Voice Call with Tools

```typescript
// Create chat instance for tool access
const chat = new PureChatLLMChat(plugin);

// Create provider with tool integration
const provider = new GeminiLiveProvider(chat);

const voiceCall = new VoiceCall(
  provider,
  {
    apiKey: 'your-gemini-api-key',
    model: 'gemini-2.0-flash-exp',
    voice: 'Puck',
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

## Provider Comparison

| Feature         | OpenAI Realtime | Gemini Live          |
| --------------- | --------------- | -------------------- |
| Protocol        | WebRTC (SDP)    | WebSocket            |
| Audio Format    | Automatic       | PCM16 (16kHz)        |
| Data Channel    | RTCDataChannel  | WebSocket messages   |
| Tool Support    | ✅ Yes          | ✅ Yes               |
| Voice Selection | ✅ Yes          | ✅ Yes               |
| Model Options   | gpt-realtime    | gemini-2.0-flash-exp |

## Provider Configuration

The `VoiceCallConfig` interface defines common configuration options:

- `apiKey`: Authentication key for the provider
- `endpoint`: API endpoint URL (optional, uses defaults)
- `model`: Model/service identifier (provider-specific)
- `instructions`: System instructions or prompts
- `voice`: Voice selection (if supported)
- Additional provider-specific options via index signature

## Future Providers

Examples of providers that could be added:

- Azure Cognitive Services (with tool integration)
- AWS Transcribe (with Lambda integration)
- Custom WebRTC services
- On-premise speech services with custom tool frameworks
