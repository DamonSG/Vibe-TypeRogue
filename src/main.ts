import "./styles/main.css";
import { Game } from "./game/Game";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error("game-canvas element not found");
}

const game = new Game(canvas);
game.start();

// Expose for debugging (no-op in production builds — just convenient in dev)
(window as unknown as { __typerogue: Game }).__typerogue = game;
