import * as THREE from "three";
import type { Enemy, EnemyKind } from "../types";
import type { SceneRenderer } from "./SceneRenderer";

/**
 * EnemyView builds and maintains the Three.js Sprite for each enemy. Procedural
 * canvas-painted textures are used (no external assets) so the game is fully
 * playable without downloads. The textures can be swapped for CC0 art later.
 */
export class EnemyView {
  private sprites = new Map<string, THREE.Sprite>();
  private textureCache = new Map<string, THREE.CanvasTexture>();
  /** Per-enemy lunge offset for attack visual */
  private lungeOffsets = new Map<string, number>();

  constructor(private sr: SceneRenderer) {}

  /** Update all enemy sprites based on current Enemy state. */
  update(enemies: Enemy[], deltaMs: number, elapsedMs: number): void {
    for (const e of enemies) {
      const sprite = this.ensureSprite(e);
      // Spawn-in animation: ease-out fade + scale during the first 250ms of life.
      const SPAWN_MS = 250;
      const spawnAge = performance.now() - e.spawnedAt;
      let spawnT = 1;
      if (spawnAge < SPAWN_MS) {
        const linear = spawnAge / SPAWN_MS;
        spawnT = 1 - (1 - linear) * (1 - linear);
      }
      const baseScale = e.def.scale * 1.4;
      sprite.scale.set(baseScale * 0.9 * spawnT, baseScale * 1.35 * spawnT, 1);
      const pos = this.computeWorldPos(e, elapsedMs);
      sprite.position.copy(pos);
      sprite.material.opacity =
        (e.dying ? Math.max(0, e.dyingMs / 320) : 1) * spawnT;
      // Ghost flicker
      if (e.def.kind === "ghost") {
        const flicker = (Math.sin(elapsedMs * 0.008) + Math.sin(elapsedMs * 0.013 + 1)) / 2;
        sprite.material.opacity *= 0.55 + 0.45 * ((flicker + 1) / 2);
      }
      // Mistake flash tint
      if (e.mistakeOnCurrent) {
        sprite.material.color.lerp(new THREE.Color(0xff5555), 0.2);
        sprite.material.color.lerp(new THREE.Color(0xffffff), 0.85);
        // gradual desaturate back
        if (Math.random() < 0.1) e.mistakeOnCurrent = false;
      } else {
        sprite.material.color.set(0xffffff);
      }
    }
    // Cleanup
    const presentIds = new Set(enemies.map((e) => e.id));
    for (const id of [...this.sprites.keys()]) {
      if (!presentIds.has(id)) {
        const s = this.sprites.get(id);
        if (s) {
          this.sr.remove(s);
          if (s.material instanceof THREE.SpriteMaterial) s.material.dispose();
        }
        this.sprites.delete(id);
        this.lungeOffsets.delete(id);
      }
    }
  }

  /** Trigger a brief forward lunge anim for an enemy attack. */
  lunge(enemyId: string): void {
    this.lungeOffsets.set(enemyId, 1.0);
  }

  /** World position above or below the enemy (alternating per spawn) — used for word card anchor. */
  getCardAnchor(enemy: Enemy): THREE.Vector3 {
    const pos = this.computeWorldPos(enemy, performance.now());
    const dir = enemy.cardAnchorSide === "top" ? +1 : -1;
    pos.y += dir * enemy.def.scale * 1.0;
    return pos;
  }

  /** Force removal of an enemy sprite (used by death cleanup). */
  remove(enemyId: string): void {
    const s = this.sprites.get(enemyId);
    if (s) {
      this.sr.remove(s);
      if (s.material instanceof THREE.SpriteMaterial) s.material.dispose();
      this.sprites.delete(enemyId);
    }
  }

  /** Reset (used between runs). */
  clear(): void {
    for (const [, sprite] of this.sprites) {
      this.sr.remove(sprite);
      if (sprite.material instanceof THREE.SpriteMaterial) sprite.material.dispose();
    }
    this.sprites.clear();
    this.lungeOffsets.clear();
  }

  // ---------- Internals ----------

  private ensureSprite(enemy: Enemy): THREE.Sprite {
    let s = this.sprites.get(enemy.id);
    if (s) return s;
    const tex = this.getTexture(enemy.def.spriteKey, enemy.colorHint);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
    });
    s = new THREE.Sprite(mat);
    this.sr.add(s);
    this.sprites.set(enemy.id, s);
    return s;
  }

  private computeWorldPos(enemy: Enemy, _elapsed: number): THREE.Vector3 {
    // depth 1 = far, 0 = at player
    const worldX = enemy.laneX * 3.2;
    const worldZ = -1 - enemy.depth * 9;
    // Lunge offset (briefly closer when attacking)
    const lungeVal = this.lungeOffsets.get(enemy.id) ?? 0;
    if (lungeVal > 0) {
      this.lungeOffsets.set(enemy.id, Math.max(0, lungeVal - 0.06));
    }
    // Subtle bob
    const t = performance.now();
    const bob = Math.sin((t + enemy.spawnedAt) * 0.003) * 0.07;
    const worldY = -0.4 - enemy.depth * 0.15 + bob + enemy.def.scale * 0.3;
    return new THREE.Vector3(worldX, worldY, worldZ + lungeVal * 0.5);
  }

  private getTexture(key: string, colorHint: string): THREE.CanvasTexture {
    const cacheKey = `${key}_${colorHint}`;
    let tex = this.textureCache.get(cacheKey);
    if (tex) return tex;
    tex = buildEnemyTexture(key as EnemyKind, colorHint);
    this.textureCache.set(cacheKey, tex);
    return tex;
  }
}

/**
 * Build a procedural canvas texture for an enemy kind. Stylized silhouettes
 * with rim glow — a credible placeholder until CC0 art is swapped in.
 */
function buildEnemyTexture(
  kind: EnemyKind,
  colorHint: string,
): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 384;
  const ctx = c.getContext("2d")!;

  // Soft rim glow behind silhouette
  const halo = ctx.createRadialGradient(128, 200, 30, 128, 200, 180);
  halo.addColorStop(0, hexToRgba(colorHint, 0.35));
  halo.addColorStop(0.5, hexToRgba(colorHint, 0.15));
  halo.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 256, 384);

  switch (kind) {
    case "skeleton":
      drawSkeleton(ctx);
      break;
    case "ghoul":
      drawGhoul(ctx, colorHint);
      break;
    case "guard":
      drawGuard(ctx, colorHint);
      break;
    case "ghost":
      drawGhost(ctx, colorHint);
      break;
    case "caster":
      drawCaster(ctx, colorHint);
      break;
    case "elite":
      drawElite(ctx, colorHint);
      break;
    case "boss":
      drawBoss(ctx, colorHint);
      break;
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ---------- Enemy silhouettes ----------

function drawSkeleton(ctx: CanvasRenderingContext2D): void {
  // Body
  ctx.fillStyle = "#bcb29a";
  ctx.beginPath();
  ctx.ellipse(128, 120, 36, 44, 0, 0, Math.PI * 2);
  ctx.fill();
  // Skull shading
  ctx.fillStyle = "rgba(80, 60, 40, 0.4)";
  ctx.beginPath();
  ctx.ellipse(128, 130, 26, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes
  ctx.fillStyle = "#1a0a0a";
  ctx.fillRect(110, 110, 12, 16);
  ctx.fillRect(134, 110, 12, 16);
  // Glowing eyes (red dot)
  ctx.fillStyle = "#ff4844";
  ctx.fillRect(114, 114, 4, 8);
  ctx.fillRect(138, 114, 4, 8);
  // Jaw
  ctx.fillStyle = "#bcb29a";
  ctx.fillRect(118, 152, 20, 14);
  ctx.fillStyle = "#1a0a0a";
  for (let i = 0; i < 4; i++) ctx.fillRect(120 + i * 5, 156, 3, 8);
  // Ribcage
  ctx.fillStyle = "#cfc5ac";
  ctx.fillRect(98, 180, 60, 80);
  ctx.fillStyle = "rgba(60, 40, 30, 0.55)";
  for (let i = 0; i < 5; i++) ctx.fillRect(102, 192 + i * 14, 52, 6);
  // Arms
  ctx.fillStyle = "#bcb29a";
  ctx.fillRect(70, 180, 18, 90);
  ctx.fillRect(168, 180, 18, 90);
  // Legs hint
  ctx.fillStyle = "#a59c84";
  ctx.fillRect(108, 260, 14, 80);
  ctx.fillRect(134, 260, 14, 80);
}

function drawGhoul(ctx: CanvasRenderingContext2D, color: string): void {
  // Hunched body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(128, 220, 70, 90, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head (low, jutting forward)
  ctx.fillStyle = darken(color, 0.85);
  ctx.beginPath();
  ctx.ellipse(140, 170, 32, 26, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Eyes
  ctx.fillStyle = "#ffe14a";
  ctx.beginPath();
  ctx.arc(150, 162, 4, 0, Math.PI * 2);
  ctx.arc(160, 168, 4, 0, Math.PI * 2);
  ctx.fill();
  // Maw
  ctx.fillStyle = "#280808";
  ctx.beginPath();
  ctx.ellipse(158, 180, 14, 6, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(150 + i * 6, 176);
    ctx.lineTo(152 + i * 6, 184);
    ctx.lineTo(148 + i * 6, 184);
    ctx.fill();
  }
  // Claws
  ctx.fillStyle = darken(color, 0.6);
  ctx.fillRect(70, 240, 22, 60);
  ctx.fillRect(166, 240, 22, 60);
  ctx.fillStyle = "#ddd";
  for (let i = 0; i < 3; i++) ctx.fillRect(72 + i * 8, 296, 4, 14);
  for (let i = 0; i < 3; i++) ctx.fillRect(168 + i * 8, 296, 4, 14);
}

function drawGuard(ctx: CanvasRenderingContext2D, color: string): void {
  // Body / chestplate
  ctx.fillStyle = color;
  ctx.fillRect(82, 150, 92, 130);
  // Plate trim
  ctx.fillStyle = darken(color, 0.6);
  ctx.fillRect(82, 150, 92, 14);
  ctx.fillRect(82, 200, 92, 6);
  // Head
  ctx.fillStyle = darken(color, 0.7);
  ctx.beginPath();
  ctx.arc(128, 120, 28, 0, Math.PI * 2);
  ctx.fill();
  // Helmet visor
  ctx.fillStyle = "#0a0a14";
  ctx.fillRect(110, 116, 36, 10);
  ctx.fillStyle = "#ff8a44";
  ctx.fillRect(114, 119, 4, 4);
  ctx.fillRect(138, 119, 4, 4);
  // Shield
  ctx.fillStyle = darken(color, 0.5);
  ctx.beginPath();
  ctx.moveTo(50, 180);
  ctx.lineTo(86, 180);
  ctx.lineTo(86, 260);
  ctx.lineTo(68, 286);
  ctx.lineTo(50, 260);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#7a1830";
  ctx.beginPath();
  ctx.arc(68, 220, 12, 0, Math.PI * 2);
  ctx.fill();
  // Sword
  ctx.fillStyle = "#ccc";
  ctx.fillRect(180, 130, 6, 130);
  ctx.fillStyle = "#8a5a30";
  ctx.fillRect(174, 250, 18, 12);
  // Legs
  ctx.fillStyle = darken(color, 0.85);
  ctx.fillRect(96, 280, 22, 80);
  ctx.fillRect(140, 280, 22, 80);
}

function drawGhost(ctx: CanvasRenderingContext2D, color: string): void {
  // Wispy body
  ctx.fillStyle = hexToRgba(color, 0.75);
  ctx.beginPath();
  ctx.moveTo(80, 320);
  ctx.bezierCurveTo(60, 240, 80, 160, 128, 120);
  ctx.bezierCurveTo(176, 160, 196, 240, 176, 320);
  ctx.bezierCurveTo(160, 300, 144, 320, 128, 310);
  ctx.bezierCurveTo(112, 320, 96, 300, 80, 320);
  ctx.closePath();
  ctx.fill();
  // Inner shimmer
  ctx.fillStyle = hexToRgba("#ffffff", 0.18);
  ctx.beginPath();
  ctx.ellipse(120, 200, 28, 60, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes (hollow)
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(112, 170, 8, 0, Math.PI * 2);
  ctx.arc(144, 170, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#9af";
  ctx.beginPath();
  ctx.arc(112, 170, 3, 0, Math.PI * 2);
  ctx.arc(144, 170, 3, 0, Math.PI * 2);
  ctx.fill();
  // Mouth
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.ellipse(128, 200, 8, 14, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCaster(ctx: CanvasRenderingContext2D, color: string): void {
  // Robe body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(70, 360);
  ctx.lineTo(86, 180);
  ctx.lineTo(128, 130);
  ctx.lineTo(170, 180);
  ctx.lineTo(186, 360);
  ctx.closePath();
  ctx.fill();
  // Hood
  ctx.fillStyle = darken(color, 0.6);
  ctx.beginPath();
  ctx.moveTo(86, 180);
  ctx.quadraticCurveTo(128, 90, 170, 180);
  ctx.lineTo(150, 200);
  ctx.quadraticCurveTo(128, 160, 106, 200);
  ctx.closePath();
  ctx.fill();
  // Glowing inside of hood
  ctx.fillStyle = "rgba(8, 4, 14, 0.95)";
  ctx.beginPath();
  ctx.ellipse(128, 165, 22, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff6080";
  ctx.beginPath();
  ctx.arc(120, 160, 3, 0, Math.PI * 2);
  ctx.arc(136, 160, 3, 0, Math.PI * 2);
  ctx.fill();
  // Sash
  ctx.fillStyle = darken(color, 0.4);
  ctx.fillRect(86, 250, 84, 12);
  // Staff
  ctx.fillStyle = "#5a3a1c";
  ctx.fillRect(190, 110, 6, 200);
  // Orb
  const orbGrad = ctx.createRadialGradient(193, 100, 2, 193, 100, 20);
  orbGrad.addColorStop(0, "#ffd2ff");
  orbGrad.addColorStop(0.6, color);
  orbGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = orbGrad;
  ctx.beginPath();
  ctx.arc(193, 100, 20, 0, Math.PI * 2);
  ctx.fill();
}

function drawElite(ctx: CanvasRenderingContext2D, color: string): void {
  // Body — large armor
  ctx.fillStyle = color;
  ctx.fillRect(80, 160, 96, 150);
  // Plate seams
  ctx.fillStyle = darken(color, 0.55);
  ctx.fillRect(80, 220, 96, 8);
  ctx.fillRect(80, 270, 96, 8);
  // Pauldrons
  ctx.fillStyle = darken(color, 0.4);
  ctx.beginPath();
  ctx.ellipse(78, 170, 18, 26, 0, 0, Math.PI * 2);
  ctx.ellipse(178, 170, 18, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  // Helmet
  ctx.fillStyle = darken(color, 0.7);
  ctx.beginPath();
  ctx.moveTo(98, 150);
  ctx.lineTo(158, 150);
  ctx.lineTo(166, 130);
  ctx.quadraticCurveTo(128, 80, 90, 130);
  ctx.closePath();
  ctx.fill();
  // Visor slit
  ctx.fillStyle = "#040208";
  ctx.fillRect(102, 110, 52, 8);
  ctx.fillStyle = "#ff4848";
  ctx.fillRect(120, 112, 4, 4);
  ctx.fillRect(132, 112, 4, 4);
  // Crest
  ctx.fillStyle = "#7a1830";
  ctx.beginPath();
  ctx.moveTo(120, 80);
  ctx.lineTo(136, 80);
  ctx.lineTo(132, 50);
  ctx.lineTo(124, 50);
  ctx.closePath();
  ctx.fill();
  // Sword
  ctx.fillStyle = "#ddd";
  ctx.fillRect(190, 140, 8, 160);
  ctx.fillStyle = "#5a3a1c";
  ctx.fillRect(182, 290, 24, 14);
  // Legs
  ctx.fillStyle = darken(color, 0.8);
  ctx.fillRect(94, 310, 24, 70);
  ctx.fillRect(138, 310, 24, 70);
}

function drawBoss(ctx: CanvasRenderingContext2D, color: string): void {
  // Huge shadow halo
  const halo = ctx.createRadialGradient(128, 220, 40, 128, 220, 180);
  halo.addColorStop(0, "rgba(122, 24, 48, 0.6)");
  halo.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 256, 384);

  // Cape
  ctx.fillStyle = "rgba(40, 8, 16, 0.95)";
  ctx.beginPath();
  ctx.moveTo(50, 360);
  ctx.lineTo(80, 140);
  ctx.lineTo(176, 140);
  ctx.lineTo(206, 360);
  ctx.quadraticCurveTo(128, 340, 50, 360);
  ctx.closePath();
  ctx.fill();
  // Body armor
  ctx.fillStyle = color;
  ctx.fillRect(72, 150, 112, 180);
  ctx.fillStyle = darken(color, 0.4);
  ctx.fillRect(72, 150, 112, 16);
  ctx.fillRect(72, 230, 112, 8);
  // Pauldrons spike
  ctx.fillStyle = darken(color, 0.3);
  ctx.beginPath();
  ctx.moveTo(60, 180);
  ctx.lineTo(80, 130);
  ctx.lineTo(96, 180);
  ctx.closePath();
  ctx.moveTo(160, 180);
  ctx.lineTo(176, 130);
  ctx.lineTo(196, 180);
  ctx.closePath();
  ctx.fill();
  // Helmet
  ctx.fillStyle = darken(color, 0.5);
  ctx.beginPath();
  ctx.moveTo(86, 140);
  ctx.lineTo(170, 140);
  ctx.lineTo(178, 110);
  ctx.quadraticCurveTo(128, 50, 78, 110);
  ctx.closePath();
  ctx.fill();
  // Horns
  ctx.fillStyle = "#1a0408";
  ctx.beginPath();
  ctx.moveTo(80, 70);
  ctx.quadraticCurveTo(60, 40, 70, 20);
  ctx.lineTo(86, 60);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(176, 70);
  ctx.quadraticCurveTo(196, 40, 186, 20);
  ctx.lineTo(170, 60);
  ctx.closePath();
  ctx.fill();
  // Visor glow
  ctx.fillStyle = "#080208";
  ctx.fillRect(94, 100, 68, 12);
  ctx.fillStyle = "#ff2840";
  ctx.fillRect(110, 102, 8, 8);
  ctx.fillRect(140, 102, 8, 8);
  // Sword (long)
  ctx.fillStyle = "#ccc";
  ctx.fillRect(208, 80, 10, 240);
  ctx.fillStyle = "#7a1830";
  ctx.fillRect(196, 310, 32, 16);
  // Belt
  ctx.fillStyle = darken(color, 0.2);
  ctx.fillRect(72, 250, 112, 14);
  ctx.fillStyle = "#ffd060";
  ctx.fillRect(120, 250, 16, 14);
}

// ---------- color helpers ----------

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darken(hex: string, factor: number): string {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.substring(0, 2), 16) * factor);
  const g = Math.round(parseInt(h.substring(2, 4), 16) * factor);
  const b = Math.round(parseInt(h.substring(4, 6), 16) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}
