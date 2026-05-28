import * as THREE from "three";

export interface ScreenProjection {
  /** Screen-space x in pixels. */
  x: number;
  /** Screen-space y in pixels. */
  y: number;
  /** Linear depth 0..1 (0 = at camera, 1 = far) */
  depth01: number;
  /** Whether the position is in front of the camera. */
  inFront: boolean;
}

/**
 * SceneRenderer wraps the Three.js renderer + camera + scene. Provides
 * screen projection for HTML overlay UI and a render method for the main loop.
 */
export class SceneRenderer {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Player z position — camera anchor (offset by dolly each frame). */
  cameraBaseZ = 5;
  cameraTargetZ = 0;
  cameraDollyOffset = 0;
  /** Time-varying shake (decays). */
  private shakeAmplitude = 0;
  private shakeDecayPerMs = 0.008;
  private shakeOffset = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x07050d, 0);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x140820, 0.06);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(54, aspect, 0.1, 200);
    this.camera.position.set(0, 0.3, 5);
    this.camera.lookAt(0, 0, -8);

    this.handleResize();
    window.addEventListener("resize", this.handleResize);
  }

  dispose(): void {
    window.removeEventListener("resize", this.handleResize);
    this.renderer.dispose();
  }

  /** Render one frame. */
  render(deltaMs: number): void {
    // Smooth camera dolly toward target z
    const lerpFactor = Math.min(1, deltaMs / 240);
    this.cameraDollyOffset +=
      (this.cameraTargetZ - this.cameraDollyOffset) * lerpFactor;
    // Apply shake
    if (this.shakeAmplitude > 0) {
      this.shakeAmplitude = Math.max(
        0,
        this.shakeAmplitude - this.shakeDecayPerMs * deltaMs,
      );
      const a = this.shakeAmplitude;
      this.shakeOffset.set(
        (Math.random() - 0.5) * a,
        (Math.random() - 0.5) * a,
        0,
      );
    } else {
      this.shakeOffset.set(0, 0, 0);
    }
    this.camera.position.x = this.shakeOffset.x;
    this.camera.position.y = 0.3 + this.shakeOffset.y;
    this.camera.position.z = this.cameraBaseZ - this.cameraDollyOffset;
    this.camera.lookAt(
      this.shakeOffset.x * 0.4,
      0,
      this.cameraBaseZ - this.cameraDollyOffset - 8,
    );

    this.renderer.render(this.scene, this.camera);
  }

  /** Trigger a screen shake of the given amplitude (0.04 light, 0.12 heavy). */
  shake(amount: number): void {
    this.shakeAmplitude = Math.max(this.shakeAmplitude, amount);
  }

  /** Move camera forward by dz (used between encounters). */
  dollyForward(dz: number): void {
    this.cameraTargetZ += dz;
  }

  /** Project a world position to screen pixels. */
  projectToScreen(pos: THREE.Vector3): ScreenProjection {
    const v = pos.clone().project(this.camera);
    const inFront = v.z >= -1 && v.z <= 1;
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (1 - (v.y * 0.5 + 0.5)) * window.innerHeight,
      depth01: (v.z + 1) / 2,
      inFront,
    };
  }

  /** Add an object to the scene. */
  add(obj: THREE.Object3D): void {
    this.scene.add(obj);
  }

  /** Remove an object from the scene. */
  remove(obj: THREE.Object3D): void {
    this.scene.remove(obj);
  }

  private handleResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
}
