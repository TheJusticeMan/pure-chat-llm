import { ExtraButtonComponent } from 'obsidian';
import { ResolutionNodeData, PURE_CHAT_LLM_ICON_NAME } from '../types';

/**
 * Interface representing a node in the tree structure for rendering
 */
interface TreeNode {
  filePath: string;
  fileName: string;
  depth: number;
  status: string;
  isPendingChat: boolean;
  isChatFile?: boolean;
  children: TreeNode[];
  error?: string;
}

/**
 * Pure presentation layer for rendering the Blue File Resolution tree in DOM.
 * Extracted from BlueResolutionTreeView to separate concerns.
 * 
 * This class is responsible ONLY for:
 * - Converting flat tree data to hierarchical structure
 * - Rendering DOM elements for the tree
 * - Managing expand/collapse UI interactions
 * 
 * It does NOT:
 * - Perform any file I/O
 * - Execute business logic
 * - Manage application state
 */
export class ResolutionTreeRenderer {
  constructor(private onFileClick: (filePath: string) => void) {}

  /**
   * Renders the tree structure in the DOM.
   * 
   * @param containerEl - The container element to render into
   * @param treeData - Flat map of node data keyed by file path
   * @param rootPath - Path of the root file to start rendering from
   */
  render(
    containerEl: HTMLElement,
    treeData: Map<string, ResolutionNodeData>,
    rootPath: string,
  ): void {
    // Remove existing tree container if it exists (don't empty the entire container)
    const existingTree = containerEl.querySelector('.resolution-tree-container');
    if (existingTree) {
      existingTree.remove();
    }

    const treeContainer = containerEl.createDiv({ cls: 'resolution-tree-container' });

    // Build tree structure from flat data with cycle detection
    const visited = new Set<string>();
    const rootNode = this.buildTreeNode(rootPath, treeData, visited);

    if (rootNode) {
      this.renderTreeNode(treeContainer, rootNode, 0);
    } else {
      treeContainer.createEl('p', {
        text: 'No resolution data available. Click refresh to scan for links.',
      });
    }
  }

  /**
   * Builds a hierarchical tree node from flat data.
   * Includes cycle detection to prevent infinite recursion.
   * 
   * @param filePath - Path of the file to build a node for
   * @param treeData - Flat map of all node data
   * @param visited - Set of already visited paths (for cycle detection)
   * @returns A TreeNode or null if not found
   */
  private buildTreeNode(
    filePath: string,
    treeData: Map<string, ResolutionNodeData>,
    visited: Set<string>,
  ): TreeNode | null {
    const nodeData = treeData.get(filePath);
    if (!nodeData) {
      return null;
    }

    // Prevent infinite recursion on circular references
    if (visited.has(filePath)) {
      // Return a node without children to break the cycle
      const fileName = filePath.split('/').pop() || filePath;
      return {
        filePath: nodeData.filePath,
        fileName,
        depth: nodeData.depth,
        status: nodeData.status === 'idle' ? 'cycle-detected' : nodeData.status,
        isPendingChat: nodeData.isPendingChat,
        isChatFile: nodeData.isChatFile,
        children: [], // No children to break recursion
        error: nodeData.error,
      };
    }

    visited.add(filePath);
    const fileName = filePath.split('/').pop() || filePath;

    const children: TreeNode[] = [];
    for (const childPath of nodeData.children) {
      const childNode = this.buildTreeNode(childPath, treeData, visited);
      if (childNode) {
        children.push(childNode);
      }
    }

    visited.delete(filePath); // Remove from visited to allow this node in other branches

    return {
      filePath: nodeData.filePath,
      fileName,
      depth: nodeData.depth,
      status: nodeData.status,
      isPendingChat: nodeData.isPendingChat,
      isChatFile: nodeData.isChatFile,
      children,
      error: nodeData.error,
    };
  }

  /**
   * Renders a single tree node and its children recursively.
   * 
   * @param container - Parent DOM element to render into
   * @param node - The tree node to render
   * @param indentLevel - Current indentation level (for visual hierarchy)
   */
  private renderTreeNode(container: HTMLElement, node: TreeNode, indentLevel: number): void {
    const nodeEl = container.createDiv({
      cls: `resolution-node resolution-node-${node.status}`,
    });
    // Don't use inline paddingLeft - let CSS handle indentation via .resolution-node-children

    const contentEl = nodeEl.createDiv({ cls: 'resolution-node-content' });

    // Add data attribute for tree connector styling
    if (indentLevel > 0) {
      contentEl.setAttribute('data-has-connector', 'true');
    }

    // Expand/collapse button for nodes with children
    if (node.children.length > 0) {
      let nodeIsExpanded = true;
      const expandBtn = new ExtraButtonComponent(contentEl).setIcon('chevron-down').onClick(() => {
        // Toggle without re-rendering the whole tree
        if (nodeIsExpanded) {
          // Collapse
          nodeEl.addClass('is-collapsed');
          expandBtn.setIcon('chevron-right');
          nodeIsExpanded = false;
        } else {
          // Expand
          nodeEl.removeClass('is-collapsed');
          expandBtn.setIcon('chevron-down');
          nodeIsExpanded = true;
        }
      });
    }

    // Contextual icon with glow - folder for root/expandable, image for images, file for others
    new ExtraButtonComponent(contentEl)
      .setDisabled(true)
      .setIcon(this.getIconForNode(node, indentLevel))
      .extraSettingsEl.addClass(`status-indicator-${node.status}`);

    // File name (clickable, truncated with ellipsis)
    const nameEl = contentEl.createSpan({
      cls: 'resolution-node-name',
      text: node.fileName,
    });
    nameEl.addEventListener('click', () => this.onFileClick(node.filePath));
    nameEl.title = node.filePath; // Full path on hover

    // Error badge - only show if there's an actual error
    if (node.error) {
      const errorBadge = contentEl.createSpan({
        cls: 'resolution-node-badge error-badge',
        text: 'Error',
      });
      errorBadge.title = node.error;
    }

    // Render children container if children exist
    if (node.children.length > 0) {
      const childrenContainer = nodeEl.createDiv({ cls: 'resolution-node-children' });

      for (const child of node.children) {
        this.renderTreeNode(childrenContainer, child, indentLevel + 1);
      }
    }
  }

  /**
   * Determines the appropriate icon for a tree node based on its properties.
   * 
   * @param node - The tree node to get an icon for
   * @param indentLevel - Current indentation level (root = 0)
   * @returns Icon name string for Obsidian's setIcon()
   */
  private getIconForNode(node: TreeNode, indentLevel: number): string {
    if (indentLevel === 0) return 'folder';
    if (node.isChatFile) return PURE_CHAT_LLM_ICON_NAME;
    if (/\.(png|jpe?g)$/i.test(node.fileName)) return 'image';
    if (node.fileName.endsWith('.md')) return 'file-text';
    return 'file';
  }
}
