import * as THREE from "three";
import type { SceneRenderer } from "./SceneRenderer";

/**
 * ParallaxScene builds the 2.5D haunted castle hallway:
 *   - far background (silhouette of doorway)
 *   - mid hallway (arches + walls)
 *   - fog layer (animated alpha)
 *   - foreground pillars
 *   - floor stripe
 *
 * All geometry is procedural — sprite planes with canvas-painted textures so
 * the game runs zero-asset out of the gate. CC0 textures can be swapped in
 * by replacing the texture builders.
 */
export class ParallaxScene {
  private group: THREE.Group;
  private fogPlane: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private elapsed = 0;
  private bossMode = false;

  constructor(private sr: SceneRenderer) {
    this.group = new THREE.Group();
    this.sr.add(this.group);

    // FAR BACKGROUND — distant doorway with eerie glow
    const farBg = this.buildBackgroundPlane();
    farBg.position.set(0, 0, -16);
    farBg.scale.set(24, 14, 1);
    this.group.add(farBg);

    // MID HALLWAY — left & right wall flats with arches
    const leftWall = this.buildWallPlane(-1);
    leftWall.position.set(-6, 0, -8);
    leftWall.scale.set(8, 12, 1);
    this.group.add(leftWall);

    const rightWall = this.buildWallPlane(1);
    rightWall.position.set(6, 0, -8);
    rightWall.scale.set(8, 12, 1);
    this.group.add(rightWall);

    // FLOOR — perspective floor stripe
    const floor = this.buildFloorPlane();
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -2.4, -8);
    floor.scale.set(20, 14, 1);
    this.group.add(floor);

    // CEILING — dark band
    const ceiling = this.buildCeilingPlane();
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 2.4, -8);
    ceiling.scale.set(20, 14, 1);
    this.group.add(ceiling);

    // FOG VOLUME — animated shader plane between mid and enemy lane
    const fogGeo = new THREE.PlaneGeometry(28, 12);
    const fogMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x281030) },
        uDensity: { value: 0.45 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uDensity;
        varying vec2 vUv;
        // simple value noise
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        void main() {
          vec2 p = vUv * 3.0;
          float n = 0.0;
          float amp = 0.6;
          for (int i = 0; i < 4; i++) {
            n += noise(p + uTime * 0.05 * float(i + 1)) * amp;
            p *= 2.0;
            amp *= 0.5;
          }
          float yMask = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.7, 1.0, vUv.y));
          float alpha = n * uDensity * yMask;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    this.fogPlane = new THREE.Mesh(fogGeo, fogMat);
    this.fogPlane.position.set(0, 0, -6);
    this.group.add(this.fogPlane);

    // Foreground decorations (pillars on either side at z=-2)
    const lPillar = this.buildPillarPlane();
    lPillar.position.set(-5, 0, -2);
    lPillar.scale.set(2, 6, 1);
    this.group.add(lPillar);

    const rPillar = this.buildPillarPlane();
    rPillar.position.set(5, 0, -2);
    rPillar.scale.set(2, 6, 1);
    this.group.add(rPillar);

    // Candles / glow accents
    for (let i = 0; i < 4; i++) {
      const z = -4 - i * 2.5;
      const yOff = 1.4 - Math.random() * 0.4;
      const left = this.buildCandle();
      left.position.set(-3.4, yOff, z);
      this.group.add(left);
      const right = this.buildCandle();
      right.position.set(3.4, yOff, z);
      this.group.add(right);
    }
  }

  setBossMode(enabled: boolean): void {
    this.bossMode = enabled;
    const targetColor = enabled ? 0x481018 : 0x281030;
    const targetDensity = enabled ? 0.6 : 0.45;
    this.fogPlane.material.uniforms.uColor.value.setHex(targetColor);
    this.fogPlane.material.uniforms.uDensity.value = targetDensity;
    this.sr.scene.fog = new THREE.FogExp2(enabled ? 0x2a0a14 : 0x140820, enabled ? 0.08 : 0.06);
  }

  /** Called each frame. */
  update(deltaMs: number): void {
    this.elapsed += deltaMs;
    this.fogPlane.material.uniforms.uTime.value = this.elapsed * 0.001;
  }

  /** Build a textured plane with a custom canvas texture. */
  private buildPlane(texture: THREE.CanvasTexture): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    return new THREE.Mesh(geo, mat);
  }

  private buildBackgroundPlane(): THREE.Mesh {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext("2d")!;
    // Sky / deep gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#1a0820");
    grad.addColorStop(0.5, "#0a0414");
    grad.addColorStop(1, "#04020a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Distant doorway glow
    const doorGrad = ctx.createRadialGradient(512, 260, 20, 512, 260, 240);
    doorGrad.addColorStop(0, "rgba(255, 180, 80, 0.65)");
    doorGrad.addColorStop(0.4, "rgba(120, 60, 30, 0.35)");
    doorGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = doorGrad;
    ctx.fillRect(0, 0, 1024, 512);

    // Door silhouette
    ctx.fillStyle = "rgba(10, 4, 12, 0.7)";
    ctx.fillRect(440, 200, 144, 220);
    ctx.beginPath();
    ctx.moveTo(440, 200);
    ctx.quadraticCurveTo(512, 130, 584, 200);
    ctx.closePath();
    ctx.fill();

    // Distant fog
    ctx.fillStyle = "rgba(40, 20, 50, 0.25)";
    ctx.fillRect(0, 360, 1024, 152);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return this.buildPlane(tex);
  }

  private buildWallPlane(side: number): THREE.Mesh {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 1024;
    const ctx = c.getContext("2d")!;
    // Wall base
    const grad = ctx.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0, "#1c1024");
    grad.addColorStop(1, "#0a0610");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 1024);

    // Stone bricks pattern
    ctx.strokeStyle = "rgba(60, 36, 70, 0.45)";
    ctx.lineWidth = 2;
    for (let y = 0; y < 1024; y += 48) {
      const offset = (Math.floor(y / 48) % 2) * 32;
      for (let x = -32; x < 512; x += 64) {
        ctx.strokeRect(x + offset, y, 64, 48);
      }
    }

    // Arch silhouette on inner edge
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.beginPath();
    if (side < 0) {
      ctx.moveTo(512, 0);
      ctx.lineTo(380, 0);
      ctx.quadraticCurveTo(512, 220, 512, 380);
      ctx.lineTo(512, 0);
    } else {
      ctx.moveTo(0, 0);
      ctx.lineTo(132, 0);
      ctx.quadraticCurveTo(0, 220, 0, 380);
      ctx.lineTo(0, 0);
    }
    ctx.fill();

    // Banner
    ctx.fillStyle = "rgba(122, 24, 48, 0.45)";
    if (side < 0) {
      ctx.fillRect(80, 200, 110, 360);
    } else {
      ctx.fillRect(322, 200, 110, 360);
    }

    // Cracks / vignette
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    const vignette = ctx.createLinearGradient(
      side < 0 ? 0 : 512,
      0,
      side < 0 ? 512 : 0,
      0,
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.65)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, 512, 1024);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return this.buildPlane(tex);
  }

  private buildFloorPlane(): THREE.Mesh {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext("2d")!;
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#0a0510");
    grad.addColorStop(1, "#1d1228");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Tile lines fanning toward perspective center
    ctx.strokeStyle = "rgba(140, 100, 180, 0.18)";
    ctx.lineWidth = 2;
    for (let x = -8; x <= 8; x++) {
      const xt = 512 + x * 80;
      ctx.beginPath();
      ctx.moveTo(xt, 0);
      ctx.lineTo(512 + x * 8, 512);
      ctx.stroke();
    }
    // Horizontal bands
    for (let y = 32; y < 512; y += 48) {
      ctx.strokeStyle = `rgba(140, 100, 180, ${0.05 + (y / 512) * 0.18})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return this.buildPlane(tex);
  }

  private buildCeilingPlane(): THREE.Mesh {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext("2d")!;
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#0a0414");
    grad.addColorStop(1, "#04020a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);
    // Chains hanging
    ctx.strokeStyle = "rgba(180, 160, 130, 0.18)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const x = 80 + i * 130;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (Math.random() - 0.5) * 8, 120);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return this.buildPlane(tex);
  }

  private buildPillarPlane(): THREE.Mesh {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 1024;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, 256, 1024);
    // Pillar gradient
    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, "rgba(8, 4, 14, 1)");
    grad.addColorStop(0.5, "rgba(40, 20, 60, 1)");
    grad.addColorStop(1, "rgba(8, 4, 14, 1)");
    ctx.fillStyle = grad;
    // Trapezoid-ish silhouette for depth
    ctx.beginPath();
    ctx.moveTo(60, 0);
    ctx.lineTo(196, 0);
    ctx.lineTo(220, 1024);
    ctx.lineTo(36, 1024);
    ctx.closePath();
    ctx.fill();
    // Highlight stripe
    ctx.fillStyle = "rgba(180, 130, 200, 0.18)";
    ctx.fillRect(120, 0, 14, 1024);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return this.buildPlane(tex);
  }

  private buildCandle(): THREE.Group {
    const g = new THREE.Group();
    // Halo sprite
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
    grad.addColorStop(0, "rgba(255, 200, 100, 0.95)");
    grad.addColorStop(0.4, "rgba(255, 140, 40, 0.4)");
    grad.addColorStop(1, "rgba(255, 100, 30, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        opacity: 0.9,
      }),
    );
    sprite.scale.set(0.6, 0.6, 1);
    g.add(sprite);
    return g;
  }
}
