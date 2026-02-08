import { GraphNode } from './types';

export class TooltipManager {
  private el: HTMLDivElement | null = null;
  private hovered: GraphNode | null = null;

  constructor(private container: HTMLElement) {}

  public setup(): void {
    this.el = this.container.createDiv({ cls: 'graph-tooltip graph-tooltip-hidden' });
  }

  public update(node: GraphNode | null, x: number, y: number): void {
    if (!this.el) return;
    if (node && node !== this.hovered) {
      this.hovered = node;
      this.show(node, x, y);
    } else if (!node && this.hovered) {
      this.el.classList.add('graph-tooltip-hidden');
      this.hovered = null;
    }
  }

  private show(node: GraphNode, x: number, y: number): void {
    if (!this.el) return;
    this.el.empty();
    const statusIcon =
      { idle: '○', resolving: '◐', complete: '●', error: '✗', cached: '◉', 'cycle-detected': '↻' }[
        node.data.status
      ] || '○';

    const header = this.el.createDiv({ cls: 'tooltip-header' });
    header.createSpan({ cls: 'tooltip-icon', text: statusIcon });
    header.createSpan({ cls: 'tooltip-title', text: node.id.split('/').pop() || node.id });

    const body = this.el.createDiv({ cls: 'tooltip-body' });
    const rows = [
      ['Path:', node.id],
      ['Status:', node.data.status],
      ['Depth:', node.data.depth.toString()],
    ];
    rows.forEach(([l, v]) => {
      const row = body.createDiv({ cls: 'tooltip-row' });
      row.createSpan({ cls: 'tooltip-label', text: l });
      row.createSpan({ cls: 'tooltip-value', text: v });
    });

    if (node.data.isPendingChat) body.createDiv({ cls: 'tooltip-badge', text: 'Pending Chat' });
    if (node.data.error) body.createDiv({ cls: 'tooltip-error', text: node.data.error });
    body.createDiv({ cls: 'tooltip-hint', text: 'Click to open file' });

    this.el.style.left = `${x + 15}px`;
    this.el.style.top = `${y + 15}px`;
    this.el.classList.remove('graph-tooltip-hidden');
  }

  public destroy(): void {
    this.el?.remove();
  }
}
