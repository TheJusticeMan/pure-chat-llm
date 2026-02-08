import { ExtraButtonComponent } from 'obsidian';
import { ResolutionNodeData } from '../types';
import { TreeNode } from './graph/types';
import { getFileIconId } from './graph/utils';

export class ResolutionTreeRenderer {
  constructor(private onFileClick: (filePath: string) => void) {}

  render(
    containerEl: HTMLElement,
    treeData: Map<string, ResolutionNodeData>,
    rootPath: string,
  ): void {
    containerEl.empty();
    const root = this.build(rootPath, treeData, new Set());
    if (root) this.renderNode(containerEl.createDiv({ cls: 'resolution-tree-container' }), root, 0);
    else containerEl.createEl('p', { text: 'No resolution data available.' });
  }

  private build(
    path: string,
    data: Map<string, ResolutionNodeData>,
    seen: Set<string>,
  ): TreeNode | null {
    const d = data.get(path);
    if (!d) return null;
    if (seen.has(path))
      return {
        ...d,
        fileName: path.split('/').pop() || path,
        children: [],
        status: 'cycle-detected',
      };

    seen.add(path);
    const node = {
      ...d,
      fileName: path.split('/').pop() || path,
      children: d.children.map(c => this.build(c, data, seen)).filter(Boolean) as TreeNode[],
    };
    seen.delete(path);
    return node;
  }

  private renderNode(parent: HTMLElement, node: TreeNode, depth: number): void {
    const el = parent.createDiv({ cls: `resolution-node resolution-node-${node.status}` });
    const content = el.createDiv({ cls: 'resolution-node-content' });
    if (depth > 0) content.setAttribute('data-has-connector', 'true');

    if (node.children.length > 0) {
      let expanded = true;
      const btn = new ExtraButtonComponent(content).setIcon('chevron-down').onClick(() => {
        expanded = !expanded;
        el.toggleClass('is-collapsed', !expanded);
        btn.setIcon(expanded ? 'chevron-down' : 'chevron-right');
      });
    }

    new ExtraButtonComponent(content)
      .setDisabled(true)
      .setIcon(getFileIconId(node.filePath, node.isChatFile, depth))
      .extraSettingsEl.addClass(`status-indicator-${node.status}`);

    const name = content.createSpan({ cls: 'resolution-node-name', text: node.fileName });
    name.addEventListener('click', () => this.onFileClick(node.filePath));
    name.title = node.filePath;

    if (node.error)
      content.createSpan({ cls: 'resolution-node-badge error-badge', text: 'Error' }).title =
        node.error;

    if (node.children.length > 0) {
      const childContainer = el.createDiv({ cls: 'resolution-node-children' });
      node.children.forEach(c => this.renderNode(childContainer, c, depth + 1));
    }
  }
}
