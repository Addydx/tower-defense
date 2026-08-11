import * as PIXI from 'pixi.js';
import { Game } from './game.js';
import { initPixelRendering } from './rendering/textures.js';

const GAME_WIDTH = 1024;
const GAME_HEIGHT = 768;

// Configuración de PixiJS para un render de pixel art nítido y de máximo
// rendimiento (Fase 7): sin antialias, escalado NEAREST, píxeles redondeados.
initPixelRendering();

const app = new PIXI.Application({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: 0x2d1b0e,
  antialias: false,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});

const container = document.getElementById('game-container');
container.appendChild(app.view);

function resize() {
  const scale = Math.min(
    window.innerWidth / GAME_WIDTH,
    window.innerHeight / GAME_HEIGHT
  );
  app.view.style.width = `${GAME_WIDTH * scale}px`;
  app.view.style.height = `${GAME_HEIGHT * scale}px`;
}

window.addEventListener('resize', resize);
resize();

const game = new Game(app);
game.init();

app.ticker.add((ticker) => {
  const delta = ticker.deltaMS / 1000;
  game.update(delta);
});
