import { ItemView, WorkspaceLeaf, Setting, Notice } from 'obsidian';
import { VoiceCall } from '../realtime/VoiceCall';
import { OpenAIRealtimeProvider } from '../realtime/providers/OpenAIRealtimeProvider';
import { OpenAIRealtimeProviderWithTools } from '../realtime/providers/OpenAIRealtimeProviderWithTools';
import { PureChatLLMChat } from '../core/Chat';
import { CallState, VOICE_CALL_VIEW_TYPE } from '../types';
import PureChatLLM from '../main';

/**
 * Side panel view for managing voice calls in Obsidian.
 * Provides UI controls for starting/ending calls, muting, and displaying call status.
 * Integrates with PureChatLLMChat to enable tool access during voice conversations.
 */
export class VoiceCallSideView extends ItemView {
  private voiceCall: VoiceCall | null = null;
  private chat: PureChatLLMChat | null = null;
  private callState: CallState = {
    status: 'idle',
    isMuted: false,
    isLocalAudioEnabled: false,
    remoteParticipants: [],
  };
  private remoteAudioElement: HTMLAudioElement | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private plugin: PureChatLLM,
  ) {
    super(leaf);
    this.icon = 'phone';
    this.navigation = false;
  }

  getViewType(): string {
    return VOICE_CALL_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Voice call';
  }

  async onOpen(): Promise<void> {
    this.renderView();
  }

  /**
   * Renders the main view UI
   */
  private renderView(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('voice-call-view');

    // Header section
    this.renderHeader(contentEl);

    // Status section
    this.renderStatus(contentEl);

    // Controls section
    this.renderControls(contentEl);

    // Remote audio element (hidden) - create early so it's ready for playback
    this.createRemoteAudioElement(contentEl);

    // Instructions
    if (this.callState.status === 'idle') {
      this.renderInstructions(contentEl);
    }
  }

  /**
   * Renders the header with title and settings
   */
  private renderHeader(container: HTMLElement): void {
    new Setting(container)
      .setName('Voice call')
      .setHeading()
      .addExtraButton(btn =>
        btn
          .setIcon('settings')
          .setTooltip('Open settings')
          .onClick(() => this.plugin.openSettings()),
      );
  }

  /**
   * Renders the call status display
   */
  private renderStatus(container: HTMLElement): void {
    const statusContainer = container.createDiv({ cls: 'voice-call-status' });

    const statusIcon = this.getStatusIcon(this.callState.status);
    const statusText = this.getStatusText(this.callState.status);

    statusContainer.createEl('div', { cls: 'status-indicator' }, el => {
      el.createEl('span', { cls: `status-icon status-${this.callState.status}`, text: statusIcon });
      el.createEl('span', { cls: 'status-text', text: statusText });
    });

    if (this.callState.error) {
      statusContainer.createEl('div', {
        cls: 'status-error',
        text: `Error: ${this.callState.error}`,
      });
    }

    // Participants
    if (this.callState.remoteParticipants.length > 0) {
      statusContainer.createEl('div', { cls: 'participants' }, el => {
        el.createEl('strong', { text: 'Participants: ' });
        el.createEl('span', { text: this.callState.remoteParticipants.join(', ') });
      });
    }
  }

  /**
   * Renders the control buttons
   */
  private renderControls(container: HTMLElement): void {
    const controlsContainer = container.createDiv({ cls: 'voice-call-controls' });

    // Start/Join Call button
    if (this.callState.status === 'idle' || this.callState.status === 'disconnected') {
      new Setting(controlsContainer)
        .addButton(btn =>
          btn
            .setButtonText('Start call')
            .setCta()
            .onClick(() => {
              void this.startCall();
            }),
        )
        .addButton(btn =>
          btn.setButtonText('Join call').onClick(() => {
            void this.joinCall();
          }),
        );
    }

    // Error state - show retry button
    if (this.callState.status === 'error') {
      new Setting(controlsContainer).addButton(btn =>
        btn
          .setButtonText('Try again')
          .setCta()
          .setIcon('refresh-cw')
          .onClick(() => {
            this.resetCallState();
          }),
      );
    }

    // Active call controls
    if (this.callState.status === 'connected' || this.callState.status === 'connecting') {
      new Setting(controlsContainer).addButton(btn =>
        btn
          .setButtonText(this.callState.isMuted ? 'Unmute' : 'Mute')
          .setIcon(this.callState.isMuted ? 'mic-off' : 'mic')
          .onClick(() => this.toggleMute()),
      );

      new Setting(controlsContainer).addButton(btn =>
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
   * Renders usage instructions
   */
  private renderInstructions(container: HTMLElement): void {
    const instructionsEl = container.createDiv({ cls: 'voice-call-instructions' });

    new Setting(instructionsEl).setName('How to use').setHeading();

    instructionsEl.createEl('p', {
      text: '1. Click "start call" to initiate a new voice call',
    });
    instructionsEl.createEl('p', {
      text: '2. Click "join call" to join an existing call',
    });
    instructionsEl.createEl('p', {
      text: '3. Use "mute" to toggle your microphone',
    });
    instructionsEl.createEl('p', {
      text: '4. Click "end call" to disconnect',
    });

    // Show tool information if agent mode is enabled
    if (this.plugin.settings.agentMode) {
      instructionsEl.createEl('p', {
        cls: 'tool-info',
        text: '🛠️ Agent mode enabled: The AI can access tools for file management, search, and other operations.',
      });
    }

    instructionsEl.createEl('p', {
      cls: 'voice-call-note',
      text: 'Note: microphone permissions are required for voice calls.',
    });
  }

  /**
   * Creates hidden audio element for remote stream playback
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

      // Add error listener for debugging playback issues
      this.remoteAudioElement.addEventListener('error', e => {
        console.error('Audio playback error:', e);
      });
    }
  }

  /**
   * Starts a new voice call
   */
  private async startCall(): Promise<void> {
    try {
      // Ensure audio element is created before starting call
      if (!this.remoteAudioElement) {
        this.createRemoteAudioElement(this.contentEl);
      }

      // Get API endpoint from settings
      const endpoint = this.plugin.settings.endpoints[this.plugin.settings.endpoint];
      const apiKey = endpoint.apiKey;

      // Use the OpenAI Realtime API endpoint directly
      const sessionEndpoint = 'https://api.openai.com/v1/realtime/calls';

      // Initialize chat for tool access if agent mode is enabled
      let provider;
      if (this.plugin.settings.agentMode) {
        this.chat = new PureChatLLMChat(this.plugin);
        provider = new OpenAIRealtimeProviderWithTools(this.chat);
        new Notice('Initializing voice call with tool access...');
      } else {
        provider = new OpenAIRealtimeProvider();
        new Notice('Initializing voice call...');
      }

      // Create voice call with provider
      this.voiceCall = new VoiceCall(
        provider,
        {
          apiKey,
          endpoint: sessionEndpoint,
          model: 'gpt-4o-realtime-preview-2024-12-17',
          instructions: this.plugin.settings.agentMode
            ? 'You are a helpful AI assistant with access to tools for file management, search, and other operations in Obsidian. Use these tools when needed to help the user.'
            : 'You are a helpful assistant.',
        },
        state => this.onCallStateChange(state),
        undefined,
        stream => this.handleRemoteStream(stream),
      );

      await this.voiceCall.startCall();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to start call:', errorMsg);
      new Notice('Failed to start voice call');
    }
  }

  /**
   * Handles incoming remote audio stream
   */
  private handleRemoteStream(stream: MediaStream): void {
    if (this.remoteAudioElement) {
      this.remoteAudioElement.srcObject = stream;

      // Try to play explicitly in case autoplay doesn't work
      this.remoteAudioElement
        .play()
        .then(() => {
          new Notice('Audio playback started');
        })
        .catch(err => {
          console.error('Failed to start audio playback:', err);
          new Notice('Failed to start audio playback. Click to enable audio.');
        });
    }
  }

  /**
   * Joins an existing voice call
   */
  private async joinCall(): Promise<void> {
    // Join is similar to start for now
    await this.startCall();
  }

  /**
   * Toggles microphone mute
   */
  private toggleMute(): void {
    if (this.voiceCall) {
      this.voiceCall.toggleMute();
    }
  }

  /**
   * Ends the current voice call
   */
  private async endCall(): Promise<void> {
    if (this.voiceCall) {
      try {
        await this.voiceCall.endCall();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to end call:', errorMsg);
      }
      this.voiceCall = null;
    }
  }

  /**
   * Handles call state changes
   */
  private onCallStateChange(state: CallState): void {
    this.callState = state;

    // Re-render the view
    this.renderView();
  }

  /**
   * Resets the call state to idle, clearing any errors
   */
  private resetCallState(): void {
    // Clean up any existing voice call
    if (this.voiceCall) {
      this.voiceCall.endCall().catch(err => {
        console.error('Error during cleanup:', err);
      });
      this.voiceCall = null;
    }

    // Reset state to idle
    this.callState = {
      status: 'idle',
      isMuted: false,
      isLocalAudioEnabled: false,
      remoteParticipants: [],
    };

    // Re-render the view
    this.renderView();
  }

  /**
   * Gets status icon for display
   */
  private getStatusIcon(status: CallState['status']): string {
    switch (status) {
      case 'idle':
        return '⚪';
      case 'connecting':
        return '🟡';
      case 'connected':
        return '🟢';
      case 'disconnected':
        return '🔴';
      case 'error':
        return '❌';
      default:
        return '⚪';
    }
  }

  /**
   * Gets human-readable status text
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

  async onClose(): Promise<void> {
    // Clean up voice call if active
    if (this.voiceCall) {
      try {
        await this.voiceCall.endCall();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to cleanup voice call:', errorMsg);
      }
      this.voiceCall = null;
    }

    // Clean up audio element
    if (this.remoteAudioElement) {
      this.remoteAudioElement.srcObject = null;
      this.remoteAudioElement = null;
    }
  }
}
