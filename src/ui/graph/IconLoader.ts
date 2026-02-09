import { getIcon } from 'obsidian';
import { PURE_CHAT_LLM_ICON_NAME, PURE_CHAT_LLM_ICON_SVG } from '../../types';
import { GraphNode, IconLoadingState } from './types';
import { getFileIconId } from './utils';

/**
 *
 */
export class IconLoader {
  private cache: Map<string, HTMLImageElement> = new Map();
  public loadingState: IconLoadingState = 'loading';

  /**
   *
   */
  async preload(): Promise<void> {
    const iconTypes = ['folder', PURE_CHAT_LLM_ICON_NAME, 'file-text', 'image', 'file'];
    try {
      await Promise.all(iconTypes.map(id => this.load(id)));
      this.loadingState = 'loaded';
    } catch {
      this.loadingState = 'error';
    }
  }

  /**
   *
   * @param id
   */
  get(id: string): HTMLImageElement | undefined {
    return this.cache.get(id);
  }

  /**
   *
   * @param node
   */
  getNodeIconId(node: GraphNode): string {
    return getFileIconId(node.id, node.data.isChatFile, node.data.depth);
  }

  /**
   *
   * @param iconId
   */
  private async load(iconId: string): Promise<HTMLImageElement | null> {
    if (this.cache.has(iconId)) return this.cache.get(iconId)!;

    let svgElement: SVGSVGElement | null = null;
    if (iconId === PURE_CHAT_LLM_ICON_NAME) {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${PURE_CHAT_LLM_ICON_SVG}</svg>`,
        'image/svg+xml',
      );
      svgElement = svgDoc.documentElement as unknown as SVGSVGElement;
    } else {
      svgElement = getIcon(iconId);
    }

    if (!svgElement) return null;

    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgElement.outerHTML], { type: 'image/svg+xml' }));

    return new Promise(resolve => {
      img.onload = () => {
        URL.revokeObjectURL(url);
        this.cache.set(iconId, img);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  /**
   *
   */
  destroy(): void {
    this.cache.clear();
  }
}
