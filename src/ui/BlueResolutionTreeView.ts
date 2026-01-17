import {
  ItemView,
  WorkspaceLeaf,
  Setting,
  TFile,
  MarkdownView,
  Notice,
  ExtraButtonComponent,
} from 'obsidian';
import PureChatLLM from '../main';
import {
  BLUE_RESOLUTION_VIEW_TYPE,
  PURE_CHAT_LLM_ICON_NAME,
  ResolutionEvent,
  ResolutionNodeData,
  ResolutionStatus,
} from '../types';
import { BrowserConsole } from '../utils/BrowserConsole';
import { ResolutionGraphRenderer } from './ResolutionGraphRenderer';
import { ResolutionTreeRenderer } from './ResolutionTreeRenderer';

/**
 * Side panel view for displaying the Blue File Resolution execution tree.
 * Shows the resolution tree/DAG for the currently active markdown file.
 * 
 * This view acts as a container/orchestrator that:
 * - Requests data from the business logic layer (BlueFileResolver)
 * - Delegates rendering to specialized renderers (ResolutionTreeRenderer, ResolutionGraphRenderer)
 * - Handles user events and state management
 */
export class BlueResolutionTreeView extends ItemView {
  private console: BrowserConsole;
  private currentRootFile: TFile | null = null;
  private lastActiveFile: TFile | null = null;
  private treeData: Map<string, ResolutionNodeData> = new Map();
  private showLegend: boolean = false;
  private isAnalyzing: boolean = false;
  private boundResolutionEventHandler: (event: ResolutionEvent) => void;
  private _locked: boolean = false;
  private viewMode: 'tree' | 'graph' = 'tree';
  private graphRenderer: ResolutionGraphRenderer | null = null;
  private treeRenderer: ResolutionTreeRenderer | null = null;
  private renderContainer: HTMLElement | null = null; // Dedicated container for renderers

  get locked(): boolean {
    return this._locked;
  }

  set locked(value: boolean) {
    if (this._locked === value) return; // No change
    this._locked = value;

    // Store the current active file for unlocking reference
    this.lastActiveFile =
      this.lastActiveFile ||
      this.currentRootFile ||
      this.app.workspace.getActiveViewOfType(MarkdownView)?.file ||
      null;

    // ONLY update the header, don't re-render the entire view
    this.updateHeaderLockState();

    // When unlocking, check if we need to switch to a different file
    if (!this._locked) {
      const currentFile = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
      if (currentFile && currentFile.path !== this.currentRootFile?.path) {
        this.onActiveFileChange(currentFile);
      }
    }
  }

  constructor(
    leaf: WorkspaceLeaf,
    private plugin: PureChatLLM,
  ) {
    super(leaf);
    this.console = new BrowserConsole(plugin.settings.debug, 'BlueResolutionTreeView');
    this.icon = 'list-tree';
    this.navigation = false;
    this.plugin.blueView = this;
    this.boundResolutionEventHandler = this.handleResolutionEvent.bind(this) as (
      event: ResolutionEvent,
    ) => void;
  }

  getViewType(): string {
    return BLUE_RESOLUTION_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Blue resolution tree';
  }

  async onOpen(): Promise<void> {
    // Restore saved view mode if available
    if (this.plugin.settings.blueResolutionViewMode) {
      this.viewMode = this.plugin.settings.blueResolutionViewMode;
    }

    // Initialize tree renderer (doesn't need container in constructor anymore)
    this.treeRenderer = new ResolutionTreeRenderer((filePath) => this.openFile(filePath));

    // Listen to resolution events
    this.plugin.blueFileResolver.onResolutionEvent(this.boundResolutionEventHandler);

    // Listen to workspace events for active file changes
    // Only update when a MarkdownView becomes active (not when this view becomes active)
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
        if (!file) return;
        this.onActiveFileChange(file);
      }),
    );

    this.registerEvent(
      this.app.workspace.on('file-open', () => {
        const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
        if (!file) return this.renderNoFileMessage();
        this.onActiveFileChange(file);
      }),
    );

    this.renderView();
    const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
    if (!file) return;
    this.onActiveFileChange(file);
  }

  async onClose(): Promise<void> {
    // Unregister resolution event listener
    this.plugin.blueFileResolver.offResolutionEvent(this.boundResolutionEventHandler);
  }

  private handleResolutionEvent(event: ResolutionEvent): void {
    this.console.log('Resolution event received:', event);

    // Update tree data
    const nodeData = this.treeData.get(event.filePath) || {
      filePath: event.filePath,
      depth: event.depth,
      status: event.status,
      isPendingChat: event.isPendingChat,
      children: [],
      error: event.error,
    };

    nodeData.status = event.status;
    nodeData.isPendingChat = event.isPendingChat;
    if (event.isChatFile !== undefined) {
      nodeData.isChatFile = event.isChatFile;
    }
    if (event.error) {
      nodeData.error = event.error;
    }

    this.treeData.set(event.filePath, nodeData);

    // Add edge from parent to child
    if (event.parentPath && event.type === 'start') {
      const parentNode = this.treeData.get(event.parentPath);
      if (parentNode && !parentNode.children.includes(event.filePath)) {
        parentNode.children.push(event.filePath);
      }
    }

    // Notify graph renderer if in graph mode
    if (this.viewMode === 'graph' && this.graphRenderer) {
      this.graphRenderer.onNodeStatusChange(event.filePath, event.status);
    }

    // Re-render the tree
    this.renderTree();
  }

  private onActiveFileChange(file: TFile): void {
    this.lastActiveFile = file;
    if (this.locked) return;

    if (file && file.extension === 'md') {
      // Only update if the file has changed
      if (this.currentRootFile?.path !== file.path) {
        this.currentRootFile = file;
        this.clearTreeData();
        this.renderView();
      }
    } else {
      this.currentRootFile = null;
      this.renderView();
    }
  }

  private clearTreeData(): void {
    this.treeData.clear();

    // Initialize root node
    if (this.currentRootFile) {
      this.treeData.set(this.currentRootFile.path, {
        filePath: this.currentRootFile.path,
        depth: 0,
        status: 'idle',
        isPendingChat: false,
        children: [],
      });
    }
  }

  private renderView(): void {
    // Ensure view mode is synchronized with settings
    if (this.plugin.settings.blueResolutionViewMode) {
      this.viewMode = this.plugin.settings.blueResolutionViewMode;
    }
    
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('blue-resolution-view');

    this.renderHeader(contentEl);

    if (!this.currentRootFile) {
      this.renderNoFileMessage();
      return;
    }

    if (this.plugin.settings.blueFileResolution.enabled === false) {
      new Setting(contentEl)
        .addToggle(toggle =>
          toggle.setValue(false).onChange(async value => {
            this.plugin.settings.blueFileResolution.enabled = value;
            await this.plugin.saveSettings();
            this.renderView();
          }),
        )
        .setDesc('Blue file resolution is currently disabled.');
      return;
    }

    // Create dedicated render container that renderers can safely empty
    this.renderContainer = contentEl.createDiv({ cls: 'resolution-render-container' });

    if (this.treeData.size <= 1 && !this.isAnalyzing) {
      void this.analyzeCurrentFile();
    }

    // Render based on view mode
    if (this.viewMode === 'graph') {
      this.renderGraphView();
    } else {
      this.renderTree();
    }

    if (this.showLegend) {
      this.renderLegend(contentEl);
    }
  }

  /**
   * Update only the header lock state without re-rendering the entire view
   */
  private updateHeaderLockState(): void {
    const header = this.contentEl.querySelector('.PUREfloattop');
    if (!header) return;

    const lockButton = header.querySelector('[data-lock-button="true"]') as HTMLElement;

    if (this._locked) {
      header.addClass('locked-view');
      if (lockButton) {
        lockButton.setAttribute('aria-label', 'Unlock view from current file');
      }
    } else {
      header.removeClass('locked-view');
      if (lockButton) {
        lockButton.setAttribute('aria-label', 'Lock view to current file');
      }
    }
  }

  private renderHeader(container: HTMLElement): void {
    new Setting(container)
      .setName('Blue resolution tree')
      .setClass('PUREfloattop')
      .setHeading()
      .then(setting => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const editor = view?.editor;
        if (editor && view)
          setting.addExtraButton(btn =>
            btn
              .setIcon('send')
              .setTooltip('Send chat message to linked chats')
              .onClick(() => {
                this.plugin.completeChatResponse(editor, view);
              }),
          );
        if (this.currentRootFile) {
          setting
            .addExtraButton(btn =>
              btn
                .setIcon('refresh-cw')
                .setTooltip('Refresh tree')
                .onClick(() => {
                  this.clearTreeData();
                  void this.renderView();
                }),
            )
            .addExtraButton(btn =>
              btn
                .setIcon(this.viewMode === 'tree' ? 'git-branch' : 'list-tree')
                .setTooltip(this.viewMode === 'tree' ? 'Switch to graph view' : 'Switch to tree view')
                .onClick(async () => {
                  this.viewMode = this.viewMode === 'tree' ? 'graph' : 'tree';
                  // Save view mode to settings for persistence
                  this.plugin.settings.blueResolutionViewMode = this.viewMode;
                  await this.plugin.saveSettings();
                  this.renderView();
                }),
            )
            .addExtraButton(btn =>
              btn
                .setIcon(this.showLegend ? 'eye-off' : 'eye')
                .setTooltip(this.showLegend ? 'Hide legend' : 'Show legend')
                .onClick(() => {
                  this.showLegend = !this.showLegend;
                  this.renderView();
                }),
            );

          // Add graph-specific controls when in graph mode
          if (this.viewMode === 'graph') {
            setting
              .addExtraButton(btn =>
                btn
                  .setIcon('zoom-in')
                  .setTooltip('Zoom in (Ctrl+Plus)')
                  .onClick(() => this.graphRenderer?.zoomIn()),
              )
              .addExtraButton(btn =>
                btn
                  .setIcon('zoom-out')
                  .setTooltip('Zoom out (Ctrl+Minus)')
                  .onClick(() => this.graphRenderer?.zoomOut()),
              )
              .addExtraButton(btn =>
                btn
                  .setIcon('rotate-ccw')
                  .setTooltip('Reset view (Ctrl+0)')
                  .onClick(() => this.graphRenderer?.resetView()),
              )
              .addExtraButton(btn =>
                btn
                  .setIcon('map')
                  .setTooltip('Toggle minimap')
                  .onClick(() => {
                    if (this.graphRenderer) {
                      this.graphRenderer.showMinimap = !this.graphRenderer.showMinimap;
                      this.graphRenderer.render();
                    }
                  }),
              )
              .addExtraButton(btn =>
                btn
                  .setIcon('refresh-ccw')
                  .setTooltip('Reset node positions')
                  .onClick(() => this.graphRenderer?.resetNodePositions()),
              );
          }
        }
        if (this.locked) setting.settingEl.addClass('locked-view');
      })
      .addExtraButton(btn =>
        btn
          .setIcon(this.locked ? 'lock' : 'unlock')
          .setTooltip(this.locked ? 'Unlock view from current file' : 'Lock view to current file')
          .onClick(() => {
            this.locked = !this.locked;
            // Manually update button icon since we're not re-rendering
            btn.setIcon(this.locked ? 'lock' : 'unlock');
            btn.setTooltip(
              this.locked ? 'Unlock view from current file' : 'Lock view to current file',
            );
          })
          .then(btnSetting => {
            // Add data attribute for reliable selection
            btnSetting.extraSettingsEl.setAttribute('data-lock-button', 'true');
            if (this.locked) btnSetting.extraSettingsEl.addClass('locked-view');
          }),
      )
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
      )
      .addExtraButton(btn =>
        btn
          .setIcon('phone')
          .setTooltip('Open voice call view')
          .onClick(() => this.plugin.activateVoiceCallView()),
      );
  }

  private renderNoFileMessage(): void {
    if (this.locked) return;
    this.contentEl.empty();
    this.currentRootFile = null;

    this.renderHeader(this.contentEl);
    const messageEl = this.contentEl.createDiv({ cls: 'resolution-tree-no-file' });
    messageEl.createEl('p', {
      text: 'No markdown file is currently open.',
    });
    messageEl.createEl('p', {
      text: 'Open a markdown file to see its resolution tree.',
    });
  }

  private renderLegend(container: HTMLElement): void {
    const legendEl = container.createDiv({ cls: 'resolution-legend' });
    legendEl.createEl('h3', { text: 'Status legend' });

    // Status indicators with icons
    const statuses: Array<{ status: ResolutionStatus; label: string }> = [
      { status: 'idle', label: 'Idle' },
      { status: 'resolving', label: 'Resolving' },
      { status: 'complete', label: 'Complete' },
      { status: 'error', label: 'Error' },
      { status: 'cached', label: 'Cached' },
      { status: 'cycle-detected', label: 'Cycle Detected' },
    ];

    statuses.forEach(({ status, label }) => {
      const itemEl = legendEl.createDiv({ cls: `legend-item legend-${status}` });
      // Create icon indicator
      new ExtraButtonComponent(itemEl)
        .setDisabled(true)
        .setIcon(PURE_CHAT_LLM_ICON_NAME)
        .extraSettingsEl.addClass(`status-indicator-${status}`);
      itemEl.createSpan({ cls: 'legend-label', text: label });
    });

    // Icon types
    legendEl.createEl('h3', { text: 'Icons', attr: { style: 'margin-top: 1em;' } });

    const iconTypes = [
      { icon: 'folder', label: 'Folder / Root' },
      { icon: 'pure-chat-llm', label: 'Chat' },
      { icon: 'file-text', label: 'Markdown file' },
      { icon: 'image', label: 'Image file' },
      { icon: 'file', label: 'Other file' },
    ];

    iconTypes.forEach(({ icon, label }) => {
      const itemEl = legendEl.createDiv({ cls: 'legend-item' });
      new ExtraButtonComponent(itemEl).setDisabled(true).setIcon(icon);
      itemEl.createSpan({ cls: 'legend-label', text: label });
    });
  }

  private renderTree(): void {
    if (!this.currentRootFile || !this.renderContainer) {
      return;
    }

    // Delegate rendering to ResolutionTreeRenderer - it can safely empty the render container
    if (this.treeRenderer) {
      this.treeRenderer.render(this.renderContainer, this.treeData, this.currentRootFile.path);
    } else {
      // Fallback if renderer not initialized
      this.renderContainer.createDiv({ cls: 'resolution-tree-container' }).createEl('p', {
        text: 'Tree renderer not initialized.',
      });
    }
  }

  private renderGraphView(): void {
    if (!this.currentRootFile || !this.renderContainer) {
      return;
    }

    // Create graph container in the dedicated render container
    const graphContainer = this.renderContainer.createDiv({ cls: 'resolution-graph-container' });

    // Create canvas
    const canvas = graphContainer.createEl('canvas', { cls: 'resolution-graph-canvas' });

    // Create zoom level indicator
    const zoomIndicator = graphContainer.createDiv({ cls: 'graph-zoom-indicator' });
    zoomIndicator.textContent = '100%';

    // Set canvas size to match container
    const updateCanvasSize = () => {
      // Calculate available height by subtracting header height
      const headerEl = this.contentEl.querySelector('.PUREfloattop') as HTMLElement;
      const headerHeight = headerEl ? headerEl.clientHeight : 0;
      const availableHeight = this.contentEl.clientHeight - headerHeight;
      const availableWidth = this.contentEl.clientWidth;
      
      const dpr = window.devicePixelRatio || 1;
      canvas.width = availableWidth * dpr;
      canvas.height = availableHeight * dpr;
      canvas.style.width = `${availableWidth}px`;
      canvas.style.height = `${availableHeight}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      // Recreate and re-render graph with new size
      if (this.treeData.size > 0) {
        this.graphRenderer = new ResolutionGraphRenderer(canvas, this.treeData);
        this.graphRenderer.setupTooltips(graphContainer);
        this.graphRenderer.setupKeyboardShortcuts();
        // Don't call render here - it will be called after icons are preloaded
        zoomIndicator.textContent = this.graphRenderer.getZoomLevel();

        // Update zoom indicator on render
        const originalRender = this.graphRenderer.render.bind(this.graphRenderer);
        this.graphRenderer.render = () => {
          originalRender();
          zoomIndicator.textContent = this.graphRenderer!.getZoomLevel();
        };
      } else {
        if (ctx) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('No resolution data available.', availableWidth / 2, availableHeight / 2);
        }
      }
    };

    // Initial size setup
    setTimeout(() => {
      updateCanvasSize();
    }, 50);

    // Handle window resize
    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
    });
    resizeObserver.observe(graphContainer);

    // Add click handler for node navigation
    canvas.addEventListener('click', (event: MouseEvent) => {
      if (!this.graphRenderer) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const node = this.graphRenderer.getNodeAtScreenPosition(x, y);
      if (node) {
        this.openFile(node.id);
      }
    });
    
    // Add touch handler for node navigation
    canvas.addEventListener('nodeclick', ((event: CustomEvent<{ nodeId: string }>) => {
      const nodeId = event.detail?.nodeId;
      if (nodeId) {
        this.openFile(nodeId);
      }
    }) as EventListener);
  }

  private openFile(filePath: string): void {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
      this.lockViewToFile(this.currentRootFile);
      void this.app.workspace.getLeaf(false).openFile(file);
    } else {
      new Notice(`File not found: ${filePath}`);
    }
  }

  lockViewToFile(currentRootFile: TFile | null) {
    if (currentRootFile) {
      this.currentRootFile = currentRootFile;
    }
    this.locked = true;
  }

  private async analyzeCurrentFile(): Promise<void> {
    if (!this.currentRootFile) {
      new Notice('No file to analyze');
      return;
    }

    if (this.isAnalyzing) {
      new Notice('Analysis already in progress');
      return;
    }

    this.isAnalyzing = true;
    this.clearTreeData();

    try {
      /* new Notice('Analyzing file links...'); */
      // Delegate to BlueFileResolver for business logic
      this.treeData = await this.plugin.blueFileResolver.scanFileLinks(this.currentRootFile);
      this.renderTree();
      /* new Notice('Analysis complete'); */
    } catch (error) {
      this.console.error('Error analyzing file:', error);
      new Notice(
        'Error analyzing file: ' + (error instanceof Error ? error.message : 'Unknown error'),
      );
    } finally {
      this.isAnalyzing = false;
    }
  }
}
