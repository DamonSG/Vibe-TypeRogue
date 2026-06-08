import * as THREE from "three";
import candleSheetUrl from "../../ImageAssets/T_Candle Sprite Sheet.png";

/** Sprite-sheet layout: 4 columns x 2 rows = 8 frames. */
const SHEET_COLS = 4;
const SHEET_ROWS = 2;
/** Which frame to display (0-based index into the 8-frame grid). */
const DISPLAY_FRAME = 0;

/** Layout (CSS pixels) for the bottom-left candle row. */
const CANDLE_HEIGHT = 76;
const MARGIN_LEFT = 30;
const MARGIN_BOTTOM = 22;
const GAP = 6;

type CandleMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

interface CandleEntry {
  mesh: CandleMesh;
  texture: THREE.Texture | null;
  glow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
}

/**
 * CandleHud renders the player's lives as static candle sprites in the
 * bottom-left corner. It uses its own orthographic scene drawn as a second
 * pass over the main 3D frame, so the candles stay pixel-anchored and never
 * inherit the gameplay camera's dolly/shake.
 *
 * A single frame from the sprite sheet is displayed; no animation runs.
 * Lit candles show at full brightness with a warm glow behind them.
 * Extinguished candles are dimmed with no glow.
 */
export class CandleHud {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private candles: CandleEntry[] = [];
  private baseTexture: THREE.Texture | null = null;
  /** Single frame aspect ratio (width / height); ~1 for this sheet. */
  private frameAspect = 1;
  private elapsedMs = 0;
  private maxCandles = 0;
  private litCandles = 0;
  private visible = false;
  private glowTexture: THREE.CanvasTexture;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
    this.camera.position.z = 1;
    this.glowTexture = buildGlowTexture();

    new THREE.TextureLoader().load(candleSheetUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      const img = tex.image as { width: number; height: number };
      this.frameAspect =
        img.width / SHEET_COLS / (img.height / SHEET_ROWS);
      this.baseTexture = tex;
      for (const c of this.candles) this.assignTexture(c);
      this.layout();
    });

    this.layout();
    window.addEventListener("resize", this.handleResize);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
  }

  clear(): void {
    this.visible = false;
    this.litCandles = 0;
  }

  update(deltaMs: number, lit: number, max: number): void {
    if (max !== this.maxCandles) this.rebuild(max);
    this.litCandles = Math.max(0, Math.min(max, Math.round(lit)));
    this.elapsedMs += deltaMs;

    for (let i = 0; i < this.candles.length; i++) {
      const c = this.candles[i];
      const isLit = i < this.litCandles;
      if (isLit) {
        c.mesh.material.color.setHex(0xffffff);
        c.mesh.material.opacity = 1;
        const pulse =
          0.5 + 0.5 * Math.sin((this.elapsedMs + i * 137) * 0.0035);
        c.glow.material.opacity = 0.14 + 0.06 * pulse;
        c.glow.scale.setScalar(CANDLE_HEIGHT * (1.5 + 0.08 * pulse));
        c.glow.visible = true;
      } else {
        c.mesh.material.color.setHex(0x39323f);
        c.mesh.material.opacity = 0.3;
        c.glow.visible = false;
      }
    }
  }

  render(renderer: THREE.WebGLRenderer): void {
    if (!this.visible || this.candles.length === 0) return;
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(this.scene, this.camera);
    renderer.autoClear = prevAutoClear;
  }

  dispose(): void {
    window.removeEventListener("resize", this.handleResize);
    this.disposeCandles();
    this.glowTexture.dispose();
    this.baseTexture?.dispose();
  }

  // ---------- Internals ----------

  private rebuild(max: number): void {
    this.disposeCandles();
    this.maxCandles = max;
    for (let i = 0; i < max; i++) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          transparent: true,
          depthTest: false,
          depthWrite: false,
        }),
      );
      mesh.renderOrder = 2;

      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: this.glowTexture,
          color: 0xffb858,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          opacity: 0.16,
        }),
      );
      glow.renderOrder = 1;

      this.scene.add(glow);
      this.scene.add(mesh);

      const entry: CandleEntry = { mesh, texture: null, glow };
      this.assignTexture(entry);
      this.candles.push(entry);
    }
    this.layout();
  }

  private assignTexture(entry: CandleEntry): void {
    if (!this.baseTexture || entry.texture) return;
    const tex = this.baseTexture.clone();
    tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1 / SHEET_COLS, 1 / SHEET_ROWS);
    const col = DISPLAY_FRAME % SHEET_COLS;
    const row = Math.floor(DISPLAY_FRAME / SHEET_COLS);
    tex.offset.set(col / SHEET_COLS, 1 - (row + 1) / SHEET_ROWS);
    entry.texture = tex;
    entry.mesh.material.map = tex;
    entry.mesh.material.needsUpdate = true;
  }

  private disposeCandles(): void {
    for (const c of this.candles) {
      this.scene.remove(c.mesh);
      this.scene.remove(c.glow);
      c.mesh.geometry.dispose();
      c.mesh.material.dispose();
      c.glow.geometry.dispose();
      c.glow.material.dispose();
      c.texture?.dispose();
    }
    this.candles = [];
  }

  private layout(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.left = 0;
    this.camera.right = w;
    this.camera.top = h;
    this.camera.bottom = 0;
    this.camera.updateProjectionMatrix();

    const candleH = CANDLE_HEIGHT;
    const candleW = candleH * this.frameAspect;
    const cy = MARGIN_BOTTOM + candleH / 2;
    for (let i = 0; i < this.candles.length; i++) {
      const c = this.candles[i];
      const cx = MARGIN_LEFT + candleW / 2 + i * (candleW + GAP);
      c.mesh.scale.set(candleW, candleH, 1);
      c.mesh.position.set(cx, cy, 0);
      c.glow.position.set(cx, cy, 0);
      c.glow.scale.setScalar(candleH * 1.5);
    }
  }

  private handleResize = (): void => {
    this.layout();
  };
}

function buildGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.4, "rgba(255, 200, 120, 0.6)");
  grad.addColorStop(1, "rgba(255, 180, 90, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
