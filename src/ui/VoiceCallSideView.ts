import { ItemView, WorkspaceLeaf, Setting, Notice, TFile } from 'obsidian';
import { VoiceCall } from '../realtime/VoiceCall';
import { OpenAIRealtimeProvider } from '../realtime/providers/OpenAIRealtimeProvider';
import { GeminiLiveProvider } from '../realtime/providers/GeminiLiveProvider';
import { PureChatLLMChat } from '../core/Chat';
import { CallState, VOICE_CALL_VIEW_TYPE, ToolDefinition, PURE_CHAT_LLM_ICON_NAME } from '../types';
import { VoiceCallConfig } from '../realtime/providers/IVoiceCallProvider';
import PureChatLLM from '../main';
import { EmptyApiKey } from 'src/assets/constants';
import { ChatToolExecutor } from '../realtime/ChatToolExecutor';

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
   *
   * @param leaf
   * @param plugin
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
   *
   */
  getViewType(): string {
    return VOICE_CALL_VIEW_TYPE;
  }

  /**
   *
   */
  getDisplayText(): string {
    return 'Voice call';
  }

  /**
   *
   */
  async onOpen(): Promise<void> {
    this.renderView();
  }

  /**
   *
   */
  private renderView(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('voice-call-view');

    this.renderHeader(contentEl);
    this.renderControls(contentEl);
    this.createRemoteAudioElement(contentEl);

    if (this.callState.status === 'idle') {
      this.renderInstructions(contentEl);
    }
  }

  /**
   *
   * @param container
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
   *
   * @param container
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
            .onClick(() => {
              void this.startCall();
            }),
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
            .onClick(() => {
              this.resetCallState();
            }),
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
            .onClick(() => {
              void this.endCall();
            }),
        );
    }
  }

  /**
   *
   * @param container
   */
  private renderInstructions(container: HTMLElement): void {
    const instructionsEl = container.createDiv({ cls: 'voice-call-instructions' });
    new Setting(instructionsEl).setName('How to use').setHeading();
    instructionsEl.createEl('p', { text: '1. Click "start call" to initiate a new voice call' });
    instructionsEl.createEl('p', { text: '2. Use "mute" to toggle your microphone' });
    instructionsEl.createEl('p', { text: '3. Click "end call" to disconnect' });

    if (this.plugin.settings.agentMode) {
      instructionsEl.createEl('p', {
        cls: 'tool-info',
        text: 'Agent mode enabled: AI can access tools.',
      });
    }
  }

  /**
   *
   * @param container
   */
  private createRemoteAudioElement(container: HTMLElement): void {
    if (!this.remoteAudioElement) {
      this.remoteAudioElement = container.createEl('audio', {
        attr: {
          autoplay: 'true',
          playsinline: 'true',
        },
      });
      this.remoteAudioElement.setCssProps({ display: 'none' });
      this.remoteAudioElement.addEventListener('error', e => {
        console.error('Audio playback error:', e);
      });
    }
  }

  /**
   * Get default system prompt based on agent mode
   */
  private getDefaultSystemPrompt(): string {
    return this.plugin.settings.agentMode
      ? 'You are a helpful AI assistant with access to tools in Obsidian.'
      : 'You are a helpful assistant.';
  }

  /**
   * Read system prompt from configured file or return default
   */
  private async getRealtimeSystemPrompt(): Promise<string> {
    const filePath = this.plugin.settings.realtimeSystemPromptFile;

    // If no file path configured, use default based on agent mode
    if (!filePath || filePath.trim() === '') {
      return this.getDefaultSystemPrompt();
    }

    // Try to read the file
    try {
      const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
      if (!file || !(file instanceof TFile)) {
        // File not found - use default and notify user
        new Notice(`Realtime prompt file not found: ${filePath}. Using default.`);
        return this.getDefaultSystemPrompt();
      }

      const content = await this.plugin.app.vault.cachedRead(file);

      // If file is empty, use default
      if (!content || content.trim() === '') {
        new Notice(`Realtime prompt file is empty: ${filePath}. Using default.`);
        return this.getDefaultSystemPrompt();
      }

      return content.trim();
    } catch (error) {
      // Error reading file - use default and notify user
      const msg = error instanceof Error ? error.message : String(error);
      new Notice(`Error reading realtime prompt file: ${msg}. Using default.`);
      return this.getDefaultSystemPrompt();
    }
  }

  /**
   *
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
        new Notice('Initializing with tool access');
      } else {
        this.chat = null;
        this.toolExecutor = null;
        new Notice('Initializing voice call');
      }

      // 3. Configure Provider - Read system prompt from file
      const instructions = await this.getRealtimeSystemPrompt();

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
      new Notice(`Failed to start call: ${msg}`);
      this.callState.error = msg;
      this.renderView();
    }
  }

  /**
   *
   * @param stream
   */
  private handleRemoteStream(stream: MediaStream): void {
    if (this.remoteAudioElement) {
      this.remoteAudioElement.srcObject = stream;
      this.remoteAudioElement.play().catch(err => {
        console.error('Auto-play failed:', err);
        new Notice('Click to enable audio.');
      });
    }
  }

  /**
   *
   */
  private toggleMute(): void {
    this.voiceCall?.toggleMute();
  }

  /**
   *
   */
  private async endCall(): Promise<void> {
    if (this.voiceCall) {
      await this.voiceCall.endCall();
      this.voiceCall = null;
    }
  }

  /**
   *
   * @param state
   */
  private onCallStateChange(state: CallState): void {
    this.callState = state;
    this.renderView();
  }

  /**
   *
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
   *
   */
  async onClose(): Promise<void> {
    await this.endCall();
    if (this.remoteAudioElement) {
      this.remoteAudioElement.srcObject = null;
      this.remoteAudioElement = null;
    }
  }

  /**
   *
   * @param status
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
