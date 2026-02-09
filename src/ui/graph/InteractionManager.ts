import { GraphNode, InteractionState, ViewTransform, GRAPH_CONSTANTS } from './types';
import { screenToGraph } from './utils';

/**
 *
 */
export class InteractionManager {
  public state: InteractionState = { type: 'idle' };
  public lastMousePos: { x: number; y: number } = { x: 0, y: 0 };
  private touches: Map<number, { x: number; y: number; startTime: number }> = new Map();
  private eventHandlers: Array<{
    element: HTMLElement | Document | Window;
    event: string;
    handler: EventListener;
  }> = [];

  /**
   *
   * @param canvas
   * @param transform
   * @param onUpdate
   * @param getNodeAtPosition
   * @param resetNode
   */
  constructor(
    private canvas: HTMLCanvasElement,
    private transform: ViewTransform,
    private onUpdate: () => void,
    private getNodeAtPosition: (x: number, y: number) => GraphNode | null,
    private resetNode: (node: GraphNode) => void,
  ) {}

  /**
   *
   */
  public setup(): void {
    this.add(this.canvas, 'wheel', this.handleWheel, { passive: false });
    this.add(this.canvas, 'mousemove', this.handleMouseMove);
    this.add(this.canvas, 'mousedown', this.handleMouseDown);
    this.add(this.canvas, 'mouseup', this.handleMouseUp);
    this.add(this.canvas, 'mouseleave', this.handleMouseUp);
    this.add(this.canvas, 'dblclick', this.handleDblClick);
    this.setupTouch();
    this.setupKeyboard();
  }

  /**
   *
   * @param el
   * @param event
   * @param handler
   * @param opt
   */
  private add(
    el: HTMLElement | Document | Window,
    event: string,
    handler: EventListener,
    opt?: boolean | AddEventListenerOptions,
  ) {
    el.addEventListener(event, handler, opt);
    this.eventHandlers.push({ element: el, event, handler });
  }

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta =
      e.deltaY < 0 ? GRAPH_CONSTANTS.ZOOM_INCREMENT : 1 / GRAPH_CONSTANTS.ZOOM_INCREMENT;
    const newScale = Math.max(
      GRAPH_CONSTANTS.MIN_ZOOM,
      Math.min(GRAPH_CONSTANTS.MAX_ZOOM, this.transform.scale * delta),
    );

    if (newScale !== this.transform.scale) {
      this.transform.offsetX -=
        (mouseX - this.transform.offsetX) * (newScale / this.transform.scale - 1);
      this.transform.offsetY -=
        (mouseY - this.transform.offsetY) * (newScale / this.transform.scale - 1);
      this.transform.scale = newScale;
      this.onUpdate();
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const pos = screenToGraph(screenX, screenY, this.transform);
    this.lastMousePos = pos;

    if (this.state.type === 'panning') {
      this.transform.offsetX = e.clientX - this.state.startX;
      this.transform.offsetY = e.clientY - this.state.startY;
      this.onUpdate();
    } else if (this.state.type === 'dragging-node') {
      const pos = screenToGraph(screenX, screenY, this.transform);
      this.state.node.x = pos.x;
      this.state.node.y = pos.y;
      this.onUpdate();
    } else {
      const pos = screenToGraph(screenX, screenY, this.transform);
      this.canvas.style.cursor = this.getNodeAtPosition(pos.x, pos.y) ? 'pointer' : 'default';
    }
  };

  private handleMouseDown = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const pos = screenToGraph(screenX, screenY, this.transform);

    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      this.state = {
        type: 'panning',
        startX: e.clientX - this.transform.offsetX,
        startY: e.clientY - this.transform.offsetY,
      };
    } else if (e.button === 0) {
      const node = this.getNodeAtPosition(pos.x, pos.y);
      if (node) this.state = { type: 'dragging-node', node, startTime: Date.now() };
    }
  };

  private handleMouseUp = () => {
    this.state = { type: 'idle' };
  };

  private handleDblClick = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const pos = screenToGraph(e.clientX - rect.left, e.clientY - rect.top, this.transform);
    const node = this.getNodeAtPosition(pos.x, pos.y);
    if (node) this.resetNode(node);
  };

  /**
   *
   */
  private setupTouch() {
    this.add(
      this.canvas,
      'touchstart',
      ((e: TouchEvent) => {
        e.preventDefault();
        for (let i = 0; i < e.touches.length; i++) {
          const t = e.touches[i];
          this.touches.set(t.identifier, { x: t.clientX, y: t.clientY, startTime: Date.now() });
        }
        if (e.touches.length === 1) {
          const rect = this.canvas.getBoundingClientRect();
          const node = this.getNodeAtPosition(
            ...(Object.values(
              screenToGraph(
                e.touches[0].clientX - rect.left,
                e.touches[0].clientY - rect.top,
                this.transform,
              ),
            ) as [number, number]),
          );
          if (node) this.state = { type: 'dragging-node', node, startTime: Date.now() };
        } else if (e.touches.length === 2) {
          this.state = {
            type: 'pinch-zooming',
            initialDistance: this.getDist(e.touches[0], e.touches[1]),
            initialScale: this.transform.scale,
          };
        }
      }) as EventListener,
      { passive: false },
    );

    this.add(
      this.canvas,
      'touchmove',
      ((e: TouchEvent) => {
        e.preventDefault();
        if (e.touches.length === 1 && this.touches.has(e.touches[0].identifier)) {
          const t = e.touches[0];
          const prev = this.touches.get(t.identifier)!;
          if (this.state.type === 'dragging-node') {
            const rect = this.canvas.getBoundingClientRect();
            const pos = screenToGraph(t.clientX - rect.left, t.clientY - rect.top, this.transform);
            this.state.node.x = pos.x;
            this.state.node.y = pos.y;
          } else {
            this.transform.offsetX += t.clientX - prev.x;
            this.transform.offsetY += t.clientY - prev.y;
          }
          this.touches.set(t.identifier, { x: t.clientX, y: t.clientY, startTime: prev.startTime });
          this.onUpdate();
        } else if (e.touches.length === 2 && this.state.type === 'pinch-zooming') {
          const dist = this.getDist(e.touches[0], e.touches[1]);
          this.transform.scale = Math.max(
            GRAPH_CONSTANTS.MIN_ZOOM,
            Math.min(
              GRAPH_CONSTANTS.MAX_ZOOM,
              (dist / this.state.initialDistance) * this.state.initialScale,
            ),
          );
          this.onUpdate();
        }
      }) as EventListener,
      { passive: false },
    );

    this.add(this.canvas, 'touchend', ((e: TouchEvent) => {
      if (
        e.changedTouches.length === 1 &&
        this.state.type !== 'pinch-zooming' &&
        this.touches.size === 1
      ) {
        const t = e.changedTouches[0];
        const prev = this.touches.get(t.identifier);
        if (prev && Date.now() - prev.startTime < GRAPH_CONSTANTS.TAP_MAX_DURATION_MS) {
          const rect = this.canvas.getBoundingClientRect();
          const node = this.getNodeAtPosition(
            ...(Object.values(
              screenToGraph(t.clientX - rect.left, t.clientY - rect.top, this.transform),
            ) as [number, number]),
          );
          if (node)
            this.canvas.dispatchEvent(
              new CustomEvent('nodeclick', { detail: { nodeId: node.id } }),
            );
        }
      }
      for (let i = 0; i < e.changedTouches.length; i++)
        this.touches.delete(e.changedTouches[i].identifier);
      if (e.touches.length < 2) this.state = { type: 'idle' };
    }) as EventListener);
  }

  /**
   *
   */
  private setupKeyboard() {
    this.add(document, 'keydown', ((e: KeyboardEvent) => {
      if (!this.canvas.matches(':hover') || !(e.ctrlKey || e.metaKey)) return;
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        this.zoom(1.2);
      } else if (e.key === '-') {
        e.preventDefault();
        this.zoom(1 / 1.2);
      } else if (e.key === '0') {
        e.preventDefault();
        Object.assign(this.transform, { scale: 1, offsetX: 0, offsetY: 0 });
        this.onUpdate();
      }
    }) as EventListener);
  }

  /**
   *
   * @param factor
   */
  public zoom(factor: number) {
    const cx = this.canvas.width / 2,
      cy = this.canvas.height / 2;
    const newScale = Math.max(
      GRAPH_CONSTANTS.MIN_ZOOM,
      Math.min(GRAPH_CONSTANTS.MAX_ZOOM, this.transform.scale * factor),
    );
    this.transform.offsetX -= (cx - this.transform.offsetX) * (newScale / this.transform.scale - 1);
    this.transform.offsetY -= (cy - this.transform.offsetY) * (newScale / this.transform.scale - 1);
    this.transform.scale = newScale;
    this.onUpdate();
  }

  /**
   *
   * @param t1
   * @param t2
   */
  private getDist(t1: Touch, t2: Touch) {
    return Math.sqrt((t2.clientX - t1.clientX) ** 2 + (t2.clientY - t1.clientY) ** 2);
  }

  /**
   *
   */
  public destroy(): void {
    this.eventHandlers.forEach(({ element, event, handler }) =>
      element.removeEventListener(event, handler),
    );
    this.touches.clear();
  }
}
