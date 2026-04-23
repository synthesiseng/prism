import { Engine, type EngineSystem, type FrameTime } from "@prism/core";
import { InputSystem } from "@prism/input";
import type { RectLike } from "@prism/math";
import { WebGlRenderer, type Rgba } from "@prism/renderer";
import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Demo app root was not found.");
}

app.innerHTML = `
  <section class="stage" aria-label="Prism cockpit demo">
    <canvas id="prism-canvas" aria-hidden="true"></canvas>
    <article
      id="ship-panel"
      class="dom-panel"
      data-prism-title="ORBITAL PANEL"
      data-prism-body="HTML cockpit controls remain as accessible DOM while the WebGL scene stays separate in this legacy demo."
      data-prism-accent="#5eead4"
      aria-label="Orbital cockpit controls"
    >
      <button id="boost-button" type="button">Boost</button>
      <button id="dock-button" type="button">Dock</button>
    </article>
    <p class="status">Arrow keys move the craft. Tab reaches the accessible DOM controls in the overlay panel.</p>
  </section>
`;

const canvas = requiredElement("#prism-canvas") as HTMLCanvasElement;
const stage = requiredElement(".stage") as HTMLElement;
const panel = requiredElement("#ship-panel") as HTMLElement;
const boostButton = requiredElement("#boost-button") as HTMLButtonElement;
const dockButton = requiredElement("#dock-button") as HTMLButtonElement;

const renderer = new WebGlRenderer(canvas);
const input = new InputSystem();
const engine = new Engine();

input.attach(stage);

function requiredElement(selector: string): Element {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

class CockpitDemo implements EngineSystem {
  private shipX = 180;
  private shipY = 160;
  private boost = false;
  private dockingRequests = 0;
  private starPhase = 0;

  constructor(
    private readonly renderer: WebGlRenderer,
    private readonly input: InputSystem,
    private readonly panelElement: HTMLElement
  ) {}

  update(time: FrameTime): void {
    const speed = this.boost ? 280 : 140;
    const dx = axis(this.input.isKeyDown("ArrowRight"), this.input.isKeyDown("ArrowLeft"));
    const dy = axis(this.input.isKeyDown("ArrowDown"), this.input.isKeyDown("ArrowUp"));
    this.shipX = clamp(this.shipX + dx * speed * time.delta, 52, 720);
    this.shipY = clamp(this.shipY + dy * speed * time.delta, 84, 420);
    this.starPhase += time.delta * (this.boost ? 2.2 : 0.7);
  }

  render(time: FrameTime): void {
    this.renderer.beginFrame([0.006, 0.018, 0.04, 1]);
    this.drawStarfield();
    this.drawCockpitFrame();
    this.drawShip(time);
  }

  toggleBoost(): void {
    this.boost = !this.boost;
    this.updatePanelCopy();
  }

  requestDocking(): void {
    this.dockingRequests += 1;
    this.updatePanelCopy();
  }

  private drawStarfield(): void {
    const dpr = globalThis.devicePixelRatio || 1;
    const width = this.renderer.width / dpr;
    const height = this.renderer.height / dpr;

    for (let index = 0; index < 48; index += 1) {
      const x = (index * 97 + this.starPhase * 28) % width;
      const y = (index * 53 + Math.sin(index) * 80 + height) % height;
      const size = index % 7 === 0 ? 2.2 : 1.2;
      this.drawCssQuad(
        { x, y, width: size, height: size },
        [0.7, 0.95, 1, index % 5 === 0 ? 0.75 : 0.38]
      );
    }
  }

  private drawCockpitFrame(): void {
    const dpr = globalThis.devicePixelRatio || 1;
    const cssWidth = this.renderer.width / dpr;
    const cssHeight = this.renderer.height / dpr;

    this.drawCssQuad(
      { x: 0, y: cssHeight - 104, width: cssWidth, height: 104 },
      [0.018, 0.042, 0.068, 0.96]
    );
    this.drawCssQuad(
      { x: 32, y: cssHeight - 94, width: cssWidth - 64, height: 2 },
      [0.37, 0.91, 0.83, 0.42]
    );
    this.drawCssQuad(
      { x: cssWidth - 206, y: 42, width: 160, height: 82 },
      [0.07, 0.14, 0.21, 0.62]
    );
  }

  private drawShip(time: FrameTime): void {
    const pulse = 0.5 + Math.sin(time.now * 9) * 0.5;
    this.drawCssQuad(
      { x: this.shipX - 22, y: this.shipY - 12, width: 44, height: 24 },
      [0.78, 0.96, 1, 1]
    );
    this.drawCssQuad(
      { x: this.shipX - 9, y: this.shipY - 26, width: 18, height: 52 },
      [0.18, 0.48, 0.62, 0.88]
    );
    this.drawCssQuad(
      { x: this.shipX - 4, y: this.shipY + 24, width: 8, height: this.boost ? 46 : 24 },
      [0.35, 0.94, 0.88, this.boost ? 0.82 : 0.44 + pulse * 0.2]
    );
  }

  private drawCssQuad(rect: RectLike, color: Rgba): void {
    const dpr = globalThis.devicePixelRatio || 1;
    this.renderer.drawQuad({
      rect: {
        x: rect.x * dpr,
        y: rect.y * dpr,
        width: rect.width * dpr,
        height: rect.height * dpr
      },
      color
    });
  }

  private updatePanelCopy(): void {
    this.panelElement.dataset.prismBody = `Boost ${this.boost ? "online" : "idle"}. Docking requests: ${String(
      this.dockingRequests
    )}. This panel remains real DOM for interaction while the renderer stays focused on the scene.`;
  }
}

const cockpit = new CockpitDemo(renderer, input, panel);

boostButton.addEventListener("click", () => cockpit.toggleBoost());
dockButton.addEventListener("click", () => cockpit.requestDocking());

engine.use(cockpit).start();

function axis(positive: boolean, negative: boolean): number {
  if (positive === negative) {
    return 0;
  }
  return positive ? 1 : -1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
