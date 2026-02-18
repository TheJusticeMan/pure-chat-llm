import { ItemView, Setting, WorkspaceLeaf } from 'obsidian';
import { EmptyApiKey } from 'src/assets/constants';
import { PureChatLLMChat } from '../core/Chat';
import PureChatLLM from '../main';
import { ChatToolExecutor } from '../realtime/ChatToolExecutor';
import { VoiceCall } from '../realtime/VoiceCall';
import { GeminiLiveProvider } from '../realtime/providers/GeminiLiveProvider';
import { VoiceCallConfig } from '../realtime/providers/IVoiceCallProvider';
import { OpenAIRealtimeProvider } from '../realtime/providers/OpenAIRealtimeProvider';
import { CallState, PURE_CHAT_LLM_ICON_NAME, ToolDefinition, VOICE_CALL_VIEW_TYPE } from '../types';

type VoiceProvider = 'openai' | 'gemini';

/**
 * Side panel view for managing voice calls in Obsidian.
 */
export class VoiceCallSideView extends ItemView {
  private voiceCall: VoiceCall | null = null;
  private chat: PureChatLLMChat | null = null;
  private toolExecutor: ChatToolExecutor | null = null;
  private selectedProvider: VoiceProvider = 'openai';
  private callState: CallState = {
    status: 'idle',
    isMuted: false,
    isLocalAudioEnabled: false,
    remoteParticipants: [],
  };
  private remoteAudioElement: HTMLAudioElement | null = null;

  /**
   * Creates a new voice call side view instance.
   *
   * @param leaf - The workspace leaf to render in
   * @param plugin - The PureChatLLM plugin instance
   */
  constructor(
    leaf: WorkspaceLeaf,
    private plugin: PureChatLLM,
  ) {
    super(leaf);
    this.icon = 'phone';
    this.navigation = false;
  }

  /**
   * Gets the view type identifier.
   *
   * @returns The view type string
   */
  getViewType(): string {
    return VOICE_CALL_VIEW_TYPE;
  }

  /**
   * Gets the display text for the view.
   *
   * @returns The view display text
   */
  getDisplayText(): string {
    return 'Voice call';
  }

  /**
   * Called when the view is opened.
   *
   * @returns A promise that resolves when initialization is complete
   */
  async onOpen(): Promise<void> {
    this.renderView();
  }

  /**
   * Renders the main view interface including header, controls, and instructions.
   */
  private renderView(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('voice-call-view');

    this.renderHeader(contentEl);
    this.renderControls(contentEl);
    this.createRemoteAudioElement(contentEl);
  }

  /**
   * Renders the view header with navigation buttons.
   *
   * @param container - The container element to render into
   */
  private renderHeader(container: HTMLElement): void {
    new Setting(container)
      .setName('Voice call')
      .setClass('headerfloattop')
      .setHeading()
      .addExtraButton(btn =>
        btn
          .setIcon('settings')
          .setTooltip('Open settings')
          .onClick(() => this.plugin.openSettings()),
      )
      .addExtraButton(btn =>
        btn
          .setIcon(PURE_CHAT_LLM_ICON_NAME)
          .setTooltip('Open conversation view')
          .onClick(() => this.plugin.activateChatView()),
      );
  }

  /**
   * Renders the call control buttons based on current call state.
   *
   * @param container - The container element to render into
   */
  private renderControls(container: HTMLElement): void {
    const controlsContainer = container.createDiv({ cls: 'voice-call-controls' });

    if (this.callState.status === 'idle' || this.callState.status === 'disconnected') {
      new Setting(controlsContainer)
        .setName(this.getStatusText(this.callState.status))
        .addDropdown(dropdown =>
          dropdown
            .addOption('openai', 'OpenAI realtime')
            .addOption('gemini', 'Gemini live')
            .setValue(this.selectedProvider)
            .onChange(value => {
              this.selectedProvider = value as VoiceProvider;
            }),
        )
        .addButton(btn =>
          btn
            .setButtonText('Start call')
            .setCta()
            .onClick(() => this.startCall()),
        );
    }

    if (this.callState.status === 'error') {
      new Setting(controlsContainer)
        .setName(this.getStatusText(this.callState.status))
        .addButton(btn =>
          btn
            .setButtonText('Try again')
            .setCta()
            .setIcon('refresh-cw')
            .onClick(() => this.resetCallState()),
        );
    }

    if (this.callState.status === 'connected' || this.callState.status === 'connecting') {
      new Setting(controlsContainer)
        .setName(this.getStatusText(this.callState.status))
        .addButton(btn =>
          btn
            .setButtonText(this.callState.isMuted ? 'Unmute' : 'Mute')
            .setIcon(this.callState.isMuted ? 'mic-off' : 'mic')
            .onClick(() => this.toggleMute()),
        )
        .addButton(btn =>
          btn
            .setButtonText('End call')
            .setWarning()
            .setIcon('phone-off')
            .onClick(() => this.endCall()),
        );
    }
  }

  /**
   * Creates and initializes the audio element for remote audio playback.
   *
   * @param container - The container element to append the audio element to
   */
  private createRemoteAudioElement(container: HTMLElement): void {
    if (!this.remoteAudioElement) {
      this.remoteAudioElement = container.createEl('audio', {
        attr: { autoplay: 'true', playsinline: 'true' },
      });
      this.remoteAudioElement.setCssProps({ display: 'none' });
      this.remoteAudioElement.addEventListener('error', e =>
        console.error('Audio playback error:', e),
      );
    }
  }

  /**
   * Get default system prompt based on agent mode.
   *
   * @returns The default system prompt string
   */
  private getDefaultSystemPrompt(): string {
    return this.plugin.settings.agentMode
      ? 'You are a helpful AI assistant with access to tools in Obsidian.'
      : 'You are a helpful assistant.';
  }

  /**
   * Read system prompt from configured file or return default.
   *
   * @returns A promise that resolves to the system prompt string
   */
  private async getRealtimeSystemPrompt(): Promise<string> {
    const filePath = this.plugin.settings.realtimeSystemPromptFile.trim();

    // If no file path configured, use default based on agent mode
    if (!filePath) return '';

    // Try to read the file
    try {
      const file = this.plugin.app.vault.getFileByPath(filePath);
      if (!file) return '';

      const content = (await this.plugin.app.vault.cachedRead(file)).trim();

      // If file is empty, use default
      if (!content) return '';
      return content;
    } catch {
      return '';
    }
  }

  /**
   * Starts a new voice call with the selected provider and configuration.
   *
   * @returns A promise that resolves when the call is started
   */
  private async startCall(): Promise<void> {
    try {
      if (!this.remoteAudioElement) {
        this.createRemoteAudioElement(this.contentEl);
      }

      // 1. Get API Key
      let providerEndpoint = this.plugin.settings.endpoints.find(
        ep => ep.name === (this.selectedProvider === 'openai' ? 'OpenAI' : 'Gemini'),
      );
      if (!providerEndpoint) {
        providerEndpoint = this.plugin.settings.endpoints[this.plugin.settings.endpoint];
      }

      if (!providerEndpoint?.apiKey || providerEndpoint.apiKey === EmptyApiKey) {
        throw new Error(`No API key for ${this.selectedProvider}. Check settings.`);
      }

      // 2. Setup Tool Executor if Agent Mode
      let tools: ToolDefinition[] = [];
      if (this.plugin.settings.agentMode) {
        this.chat = new PureChatLLMChat(this.plugin);
        this.toolExecutor = new ChatToolExecutor(this.chat);
        tools = this.toolExecutor.getToolDefinitions();
      } else {
        this.chat = null;
        this.toolExecutor = null;
      }

      // 3. Configure Provider - Read system prompt from file
      const instructions = (await this.getRealtimeSystemPrompt()) || this.getDefaultSystemPrompt();

      let provider;
      const config: VoiceCallConfig = {
        apiKey: providerEndpoint.apiKey,
        instructions,
        tools: tools,
      };

      if (this.selectedProvider === 'openai') {
        provider = new OpenAIRealtimeProvider(this.toolExecutor || undefined);
        config.endpoint = 'https://api.openai.com/v1/realtime/calls';
        config.model = 'gpt-realtime';
      } else {
        provider = new GeminiLiveProvider(this.toolExecutor || undefined);
        config.model = 'models/gemini-2.0-flash-exp';
        config.voice = 'Puck';
      }

      // 4. Create Voice Call
      this.voiceCall = new VoiceCall(
        provider,
        config,
        state => this.onCallStateChange(state),
        undefined,
        stream => this.handleRemoteStream(stream),
      );

      await this.voiceCall.startCall();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Failed to start call:', msg);

      this.callState.error = msg;
      this.renderView();
    }
  }

  /**
   * Handles incoming remote audio stream from the call.
   *
   * @param stream - The media stream to play
   */
  private handleRemoteStream(stream: MediaStream): void {
    if (this.remoteAudioElement) {
      this.remoteAudioElement.srcObject = stream;
      this.remoteAudioElement.play().catch(err => console.error('Auto-play failed:', err));
    }
  }

  /**
   * Toggles the microphone mute state for the active call.
   */
  private toggleMute(): void {
    this.voiceCall?.toggleMute();
  }

  /**
   * Ends the active voice call and cleans up resources.
   *
   * @returns A promise that resolves when the call is ended
   */
  private async endCall(): Promise<void> {
    if (this.voiceCall) {
      await this.voiceCall.endCall();
      this.voiceCall = null;
    }
  }

  /**
   * Called when the call state changes. Updates the UI accordingly.
   *
   * @param state - The new call state
   */
  private onCallStateChange(state: CallState): void {
    this.callState = state;
    this.renderView();
  }

  /**
   * Resets the call state to idle and cleans up resources.
   */
  private resetCallState(): void {
    if (this.voiceCall) {
      void this.voiceCall.endCall();
      this.voiceCall = null;
    }
    this.callState = {
      status: 'idle',
      isMuted: false,
      isLocalAudioEnabled: false,
      remoteParticipants: [],
    };
    this.renderView();
  }

  /**
   * Called when the view is closed. Cleans up active calls and resources.
   *
   * @returns A promise that resolves when cleanup is complete
   */
  async onClose(): Promise<void> {
    await this.endCall();
    if (this.remoteAudioElement) {
      this.remoteAudioElement.srcObject = null;
      this.remoteAudioElement = null;
    }
  }

  /**
   * Gets the display text for a call status.
   *
   * @param status - The call status
   * @returns The human-readable status text
   */
  private getStatusText(status: CallState['status']): string {
    switch (status) {
      case 'idle':
        return 'Ready to call';
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Call active';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Connection error';
      default:
        return 'Unknown';
    }
  }
}
