import { ItemView, WorkspaceLeaf, Setting, TFile, MarkdownView, Notice } from 'obsidian';
import PureChatLLM from '../main';
import { BLUE_RESOLUTION_TREE_VIEW_TYPE, ResolutionEvent, ResolutionNodeData, ResolutionStatus } from '../types';
import { BrowserConsole } from '../utils/BrowserConsole';

interface TreeNode {
  filePath: string;
  fileName: string;
  depth: number;
  status: ResolutionStatus;
  isPendingChat: boolean;
  children: TreeNode[];
  error?: string;
  isExpanded: boolean;
}

/**
 * Side panel view for displaying the Blue File Resolution execution tree.
 * Shows the resolution tree/DAG for the currently active markdown file.
 */
export class BlueResolutionTreeView extends ItemView {
  private console: BrowserConsole;
  private currentRootFile: TFile | null = null;
  private treeData: Map<string, ResolutionNodeData> = new Map();
  private showLegend: boolean = true;
  private isAnalyzing: boolean = false;

  constructor(
    leaf: WorkspaceLeaf,
    private plugin: PureChatLLM,
  ) {
    super(leaf);
    this.console = new BrowserConsole(plugin.settings.debug, 'BlueResolutionTreeView');
    this.icon = 'git-branch';
    this.navigation = false;
  }

  getViewType(): string {
    return BLUE_RESOLUTION_TREE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Blue Resolution Tree';
  }

  async onOpen(): Promise<void> {
    // Listen to resolution events
    this.plugin.blueFileResolver.onResolutionEvent(this.handleResolutionEvent.bind(this));

    // Listen to workspace events for active file changes
    // Only update when a MarkdownView becomes active (not when this view becomes active)
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        if (!leaf) return;
        const view = leaf.view;
        if (!(view instanceof MarkdownView)) return;
        this.onActiveFileChange();
      }),
    );

    this.registerEvent(
      this.app.workspace.on('file-open', () => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;
        this.onActiveFileChange();
      }),
    );

    this.renderView();
    this.onActiveFileChange();
  }

  async onClose(): Promise<void> {
    // Unregister resolution event listener
    this.plugin.blueFileResolver.offResolutionEvent(this.handleResolutionEvent.bind(this));
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

    // Re-render the tree
    this.renderTree();
  }

  private onActiveFileChange(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = view?.file;

    if (file && file.extension === 'md') {
      this.currentRootFile = file;
      this.clearTreeData();
      this.renderView();
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
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('blue-resolution-view');

    this.renderHeader(contentEl);

    if (!this.currentRootFile) {
      this.renderNoFileMessage(contentEl);
      return;
    }

    if (this.showLegend) {
      this.renderLegend(contentEl);
    }

    this.renderTree();
  }

  private renderHeader(container: HTMLElement): void {
    new Setting(container)
      .setName('Blue Resolution Tree')
      .setHeading()
      .addExtraButton(btn =>
        btn
          .setIcon('refresh-cw')
          .setTooltip('Refresh tree')
          .onClick(() => {
            this.clearTreeData();
            this.analyzeCurrentFile();
          }),
      )
      .addExtraButton(btn =>
        btn
          .setIcon('search')
          .setTooltip('Analyze file (dry-run)')
          .onClick(() => this.analyzeCurrentFile()),
      )
      .addExtraButton(btn =>
        btn
          .setIcon(this.showLegend ? 'eye-off' : 'eye')
          .setTooltip(this.showLegend ? 'Hide legend' : 'Show legend')
          .onClick(() => {
            this.showLegend = !this.showLegend;
            this.renderView();
          }),
      )
      .addExtraButton(btn =>
        btn
          .setIcon('settings')
          .setTooltip('Open settings')
          .onClick(() => this.plugin.openSettings()),
      );
  }

  private renderNoFileMessage(container: HTMLElement): void {
    const messageEl = container.createDiv({ cls: 'resolution-tree-no-file' });
    messageEl.createEl('p', {
      text: 'No markdown file is currently open.',
    });
    messageEl.createEl('p', {
      text: 'Open a markdown file to see its resolution tree.',
    });
  }

  private renderLegend(container: HTMLElement): void {
    const legendEl = container.createDiv({ cls: 'resolution-legend' });
    legendEl.createEl('h3', { text: 'Status Legend' });

    const statuses: Array<{ icon: string; status: ResolutionStatus; label: string }> = [
      { icon: '⚪', status: 'idle', label: 'Idle' },
      { icon: '⏳', status: 'resolving', label: 'Resolving' },
      { icon: '✅', status: 'complete', label: 'Complete' },
      { icon: '❌', status: 'error', label: 'Error' },
      { icon: '📦', status: 'cached', label: 'Cached' },
      { icon: '🔄', status: 'cycle-detected', label: 'Cycle Detected' },
    ];

    statuses.forEach(({ icon, status, label }) => {
      const itemEl = legendEl.createDiv({ cls: `legend-item legend-${status}` });
      itemEl.createSpan({ cls: 'legend-icon', text: icon });
      itemEl.createSpan({ cls: 'legend-label', text: label });
    });
  }

  private renderTree(): void {
    const { contentEl } = this;
    
    // Remove existing tree container if it exists
    const existingTree = contentEl.querySelector('.resolution-tree-container');
    if (existingTree) {
      existingTree.remove();
    }

    if (!this.currentRootFile) {
      return;
    }

    const treeContainer = contentEl.createDiv({ cls: 'resolution-tree-container' });

    // Build tree structure from flat data
    const rootNode = this.buildTreeNode(this.currentRootFile.path);
    
    if (rootNode) {
      this.renderTreeNode(treeContainer, rootNode, 0);
    } else {
      treeContainer.createEl('p', {
        text: 'No resolution data available. Click "Analyze file" to scan for links.',
      });
    }
  }

  private buildTreeNode(filePath: string): TreeNode | null {
    const nodeData = this.treeData.get(filePath);
    if (!nodeData) {
      return null;
    }

    const fileName = filePath.split('/').pop() || filePath;
    
    const children: TreeNode[] = [];
    for (const childPath of nodeData.children) {
      const childNode = this.buildTreeNode(childPath);
      if (childNode) {
        children.push(childNode);
      }
    }

    return {
      filePath: nodeData.filePath,
      fileName,
      depth: nodeData.depth,
      status: nodeData.status,
      isPendingChat: nodeData.isPendingChat,
      children,
      error: nodeData.error,
      isExpanded: true, // Start expanded
    };
  }

  private renderTreeNode(container: HTMLElement, node: TreeNode, indentLevel: number): void {
    const nodeEl = container.createDiv({
      cls: `resolution-node resolution-node-${node.status}`,
    });
    nodeEl.style.paddingLeft = `${indentLevel * 1.5}em`;

    const contentEl = nodeEl.createDiv({ cls: 'resolution-node-content' });

    // Expand/collapse button for nodes with children
    if (node.children.length > 0) {
      const expandBtn = contentEl.createSpan({
        cls: 'resolution-node-expand',
        text: node.isExpanded ? '▼' : '▶',
      });
      expandBtn.addEventListener('click', () => {
        node.isExpanded = !node.isExpanded;
        this.renderTree();
      });
    } else {
      contentEl.createSpan({ cls: 'resolution-node-expand', text: '  ' });
    }

    // Status icon
    const statusIcon = this.getStatusIcon(node.status);
    contentEl.createSpan({ cls: 'resolution-node-status', text: statusIcon });

    // File name (clickable)
    const nameEl = contentEl.createSpan({
      cls: 'resolution-node-name',
      text: node.fileName,
    });
    nameEl.addEventListener('click', () => this.openFile(node.filePath));
    nameEl.title = node.filePath;

    // Depth badge
    contentEl.createSpan({
      cls: 'resolution-node-depth',
      text: `d:${node.depth}`,
    });

    // Pending chat badge
    if (node.isPendingChat) {
      contentEl.createSpan({
        cls: 'resolution-node-badge pending-chat',
        text: 'Pending',
      });
    }

    // Error badge
    if (node.error) {
      const errorBadge = contentEl.createSpan({
        cls: 'resolution-node-badge error-badge',
        text: '⚠',
      });
      errorBadge.title = node.error;
    }

    // Render children if expanded
    if (node.isExpanded && node.children.length > 0) {
      const childrenContainer = nodeEl.createDiv({ cls: 'resolution-node-children' });
      for (const child of node.children) {
        this.renderTreeNode(childrenContainer, child, indentLevel + 1);
      }
    }
  }

  private getStatusIcon(status: ResolutionStatus): string {
    switch (status) {
      case 'idle':
        return '⚪';
      case 'resolving':
        return '⏳';
      case 'complete':
        return '✅';
      case 'error':
        return '❌';
      case 'cached':
        return '📦';
      case 'cycle-detected':
        return '🔄';
      default:
        return '⚪';
    }
  }

  private openFile(filePath: string): void {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
      void this.app.workspace.getLeaf(false).openFile(file);
    } else {
      new Notice(`File not found: ${filePath}`);
    }
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
      new Notice('Analyzing file links...');
      await this.scanFileLinks(this.currentRootFile, null, 0, new Set());
      this.renderTree();
      new Notice('Analysis complete');
    } catch (error) {
      this.console.error('Error analyzing file:', error);
      new Notice('Error analyzing file: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      this.isAnalyzing = false;
    }
  }

  private async scanFileLinks(
    file: TFile,
    parentPath: string | null,
    depth: number,
    visited: Set<string>,
  ): Promise<void> {
    // Prevent infinite loops
    if (visited.has(file.path)) {
      // Mark as cycle
      const nodeData = this.treeData.get(file.path);
      if (nodeData) {
        nodeData.status = 'cycle-detected';
      }
      return;
    }

    visited.add(file.path);

    // Check depth limit
    const maxDepth = this.plugin.settings.blueFileResolution.maxDepth;
    if (depth >= maxDepth) {
      return;
    }

    // Read file content
    const content = await this.app.vault.cachedRead(file);

    // Check if it's a pending chat
    const chat = new (await import('../core/Chat')).PureChatLLMChat(this.plugin);
    chat.setMarkdown(content);
    const isPending = chat.validChat && chat.messages.length > 0 && chat.messages[chat.messages.length - 1].role === 'user';

    // Update or create node
    const nodeData: ResolutionNodeData = this.treeData.get(file.path) || {
      filePath: file.path,
      depth,
      status: 'idle',
      isPendingChat: isPending,
      children: [],
    };
    nodeData.isPendingChat = isPending;
    this.treeData.set(file.path, nodeData);

    // Add to parent's children
    if (parentPath) {
      const parentNode = this.treeData.get(parentPath);
      if (parentNode && !parentNode.children.includes(file.path)) {
        parentNode.children.push(file.path);
      }
    }

    // Find all [[link]] patterns
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    const matches = Array.from(content.matchAll(linkRegex));

    // Recursively scan linked files
    for (const match of matches) {
      const linkText = match[1];
      const linkedFile = this.app.metadataCache.getFirstLinkpathDest(linkText, file.path);
      
      if (linkedFile instanceof TFile) {
        if (!nodeData.children.includes(linkedFile.path)) {
          nodeData.children.push(linkedFile.path);
        }
        
        // Create a new visited set for this branch
        const branchVisited = new Set(visited);
        await this.scanFileLinks(linkedFile, file.path, depth + 1, branchVisited);
      }
    }
  }
}
