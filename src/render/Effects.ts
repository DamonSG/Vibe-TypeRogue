import * as THREE from "three";
import type { SceneRenderer } from "./SceneRenderer";

interface Particle {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  lifeMs: number;
  totalLifeMs: number;
  startScale: number;
  startOpacity: number;
}

/**
 * Effects manages short-lived particle bursts, hit flashes, and screen shake.
 * Particle sprites are pooled to keep allocations low during heavy combat.
 */
export class Effects {
  private particles: Particle[] = [];
  private dotTexture: THREE.CanvasTexture;
  private sparkTexture: THREE.CanvasTexture;
  private appEl: HTMLElement;

  constructor(private sr: SceneRenderer) {
    this.dotTexture = buildDotTexture();
    this.sparkTexture = buildSparkTexture();
    this.appEl = document.getElementById("app") as HTMLElement;
  }

  update(deltaMs: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.lifeMs -= deltaMs;
      if (p.lifeMs <= 0) {
        this.sr.remove(p.sprite);
        if (p.sprite.material instanceof THREE.SpriteMaterial)
          p.sprite.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      const t = 1 - p.lifeMs / p.totalLifeMs;
      p.sprite.position.x += p.velocity.x * (deltaMs / 1000);
      p.sprite.position.y += p.velocity.y * (deltaMs / 1000);
      p.sprite.position.z += p.velocity.z * (deltaMs / 1000);
      p.velocity.y -= 4 * (deltaMs / 1000); // gravity
      p.velocity.multiplyScalar(0.985);
      p.sprite.material.opacity = p.startOpacity * (1 - t);
      const s = p.startScale * (1 - t * 0.6);
      p.sprite.scale.set(s, s, 1);
    }
  }

  /** Burst sparks at a world position. color is a hex string. */
  burst(
    worldPos: THREE.Vector3,
    color: string,
    count = 12,
    options?: {
      speed?: number;
      lifeMs?: number;
      scale?: number;
      texture?: "dot" | "spark";
    },
  ): void {
    const speed = options?.speed ?? 2.5;
    const lifeMs = options?.lifeMs ?? 450;
    const scale = options?.scale ?? 0.18;
    const tex = options?.texture === "spark" ? this.sparkTexture : this.dotTexture;
    const colorObj = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex,
        color: colorObj,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.copy(worldPos);
      sprite.scale.set(scale, scale, 1);
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const upBias = Math.random() * 0.4;
      const v = new THREE.Vector3(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed * 0.7 + upBias * speed,
        (Math.random() - 0.5) * speed * 0.4,
      );
      this.sr.add(sprite);
      this.particles.push({
        sprite,
        velocity: v,
        lifeMs,
        totalLifeMs: lifeMs,
        startScale: scale,
        startOpacity: 1,
      });
    }
  }

  /** Small hit spark — gentle. */
  hitSpark(worldPos: THREE.Vector3, color: string): void {
    this.burst(worldPos, color, 6, {
      speed: 1.6,
      lifeMs: 280,
      scale: 0.12,
      texture: "spark",
    });
  }

  /** Bigger kill burst. */
  killBurst(worldPos: THREE.Vector3, color: string): void {
    this.burst(worldPos, color, 22, {
      speed: 3.4,
      lifeMs: 700,
      scale: 0.22,
      texture: "dot",
    });
    this.burst(worldPos, "#ffffff", 10, {
      speed: 5.0,
      lifeMs: 320,
      scale: 0.1,
      texture: "spark",
    });
  }

  /** Chain spark trail between two world positions. */
  chainArc(from: THREE.Vector3, to: THREE.Vector3, color: string): void {
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const pos = from.clone().lerp(to, t);
      pos.x += (Math.random() - 0.5) * 0.3;
      pos.y += (Math.random() - 0.5) * 0.3;
      const mat = new THREE.SpriteMaterial({
        map: this.sparkTexture,
        color: new THREE.Color(color),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const s = new THREE.Sprite(mat);
      s.position.copy(pos);
      s.scale.set(0.1, 0.1, 1);
      this.sr.add(s);
      this.particles.push({
        sprite: s,
        velocity: new THREE.Vector3(0, 0.5, 0),
        lifeMs: 220,
        totalLifeMs: 220,
        startScale: 0.1,
        startOpacity: 1,
      });
    }
  }

  /** Apply a CSS-driven shake to #app. */
  domShake(strength: "light" | "medium" | "heavy"): void {
    this.appEl.classList.remove("shake-light", "shake-medium", "shake-heavy");
    // Force reflow to restart animation
    void this.appEl.offsetWidth;
    this.appEl.classList.add(`shake-${strength}`);
    window.setTimeout(
      () => this.appEl.classList.remove(`shake-${strength}`),
      400,
    );
  }

  /** Quick red flash overlay (player damage). */
  damageFlash(): void {
    const el = document.createElement("div");
    el.className = "damage-flash";
    document.getElementById("app")!.appendChild(el);
    window.setTimeout(() => el.remove(), 340);
  }

  /** Clear everything. */
  clear(): void {
    for (const p of this.particles) {
      this.sr.remove(p.sprite);
      if (p.sprite.material instanceof THREE.SpriteMaterial)
        p.sprite.material.dispose();
    }
    this.particles = [];
  }
}

function buildDotTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.5, "rgba(255, 255, 255, 0.5)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildSparkTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = "white";
  ctx.lineCap = "round";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(32, 6);
  ctx.lineTo(32, 58);
  ctx.moveTo(6, 32);
  ctx.lineTo(58, 32);
  ctx.stroke();
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 22);
  grad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
