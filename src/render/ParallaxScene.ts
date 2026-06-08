import * as THREE from "three";
import type { SceneRenderer } from "./SceneRenderer";
import castleBgUrl from "../../ImageAssets/T_Castle_Background.png";

const BACKDROP_Z = -16;
const IMAGE_ASPECT = 16 / 9;
const COVER_MARGIN = 1.05;

export class ParallaxScene {
  private group: THREE.Group;
  private backdrop: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private backdropMat: THREE.MeshBasicMaterial;

  constructor(private sr: SceneRenderer) {
    this.group = new THREE.Group();
    this.sr.add(this.group);

    const geo = new THREE.PlaneGeometry(1, 1);
    this.backdropMat = new THREE.MeshBasicMaterial({
      depthWrite: false,
      fog: false,
      transparent: false,
    });
    this.backdrop = new THREE.Mesh(geo, this.backdropMat);
    this.backdrop.position.set(0, 0, BACKDROP_Z);
    this.group.add(this.backdrop);

    new THREE.TextureLoader().load(castleBgUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      this.backdropMat.map = tex;
      this.backdropMat.needsUpdate = true;
      this.layoutBackdrop();
    });

    this.layoutBackdrop();
  }

  setBossMode(enabled: boolean): void {
    this.backdropMat.color.setHex(enabled ? 0xff9a9a : 0xffffff);
    this.sr.scene.fog = new THREE.FogExp2(
      enabled ? 0x2a0a14 : 0x140820,
      enabled ? 0.08 : 0.06,
    );
  }

  update(_deltaMs: number): void {
    this.layoutBackdrop();
  }

  private layoutBackdrop(): void {
    const cam = this.sr.camera;
    const dist = this.sr.cameraBaseZ - BACKDROP_Z;
    const vFov = THREE.MathUtils.degToRad(cam.fov);
    const visibleH = 2 * dist * Math.tan(vFov / 2);
    const visibleW = visibleH * cam.aspect;
    const screenAspect = visibleW / visibleH;

    let planeW: number;
    let planeH: number;
    if (screenAspect > IMAGE_ASPECT) {
      planeW = visibleW * COVER_MARGIN;
      planeH = planeW / IMAGE_ASPECT;
    } else {
      planeH = visibleH * COVER_MARGIN;
      planeW = planeH * IMAGE_ASPECT;
    }

    this.backdrop.scale.set(planeW, planeH, 1);
  }
}
