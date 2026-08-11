// ────────────────────────────────────────────────────────────────────────
// Renderizado del mapa (Fase 2): tiles texturizados con variantes,
// decoraciones (árboles/rocas/flores), fondo con cielo/nubes/montañas y
// pequeños efectos vivos sobre el portal de inicio y la puerta de salida.
//
// Puramente visual: no conoce reglas de construcción ni de pathing; sólo
// lee `mapData.tiles` para decidir qué dibujar en cada celda.
// ────────────────────────────────────────────────────────────────────────

import * as PIXI from 'pixi.js';
import { GRID_SIZE, TILE_TYPES, GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { getTileTexture, getDecorationTexture, mulberry32 } from './textures.js';
import { ACCENT, PALETTE } from './palette.js';

function hashTile(row, col, salt) {
  const rng = mulberry32(row * 9301 + col * 49297 + salt);
  return rng();
}

// ─────────────────────────────────────────── Fondo (cielo / montañas / nubes) ───────────────────────────────────────────

function buildSkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, ACCENT.skyTop);
  grad.addColorStop(1, ACCENT.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  const tex = PIXI.Texture.from(canvas);
  tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; // degradado suave, no pixelado
  return tex;
}

function buildMountainLayer(color, peaks, baseY, amplitude) {
  const g = new PIXI.Graphics();
  g.beginFill(color, 1);
  const points = [0, GAME_HEIGHT];
  const step = GAME_WIDTH / peaks;
  for (let i = 0; i <= peaks; i++) {
    const x = i * step;
    const y = baseY - Math.abs(Math.sin(i * 1.7)) * amplitude;
    points.push(x, y);
  }
  points.push(GAME_WIDTH, GAME_HEIGHT);
  g.drawPolygon(points);
  g.endFill();
  return g;
}

function buildCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 20;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = ACCENT.cloud;
  const blocks = [
    [6, 10, 24, 6],
    [12, 4, 20, 8],
    [0, 12, 16, 6],
    [26, 12, 18, 6],
  ];
  for (const [x, y, w, h] of blocks) ctx.fillRect(x, y, w, h);
  const tex = PIXI.Texture.from(canvas);
  tex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
  return tex;
}

function buildBackground(backgroundLayer) {
  const sky = new PIXI.Sprite(buildSkyTexture());
  sky.width = GAME_WIDTH;
  sky.height = GAME_HEIGHT;
  backgroundLayer.addChild(sky);

  backgroundLayer.addChild(buildMountainLayer(ACCENT.mountainFar, 6, GAME_HEIGHT * 0.62, 60));
  backgroundLayer.addChild(buildMountainLayer(ACCENT.mountainNear, 5, GAME_HEIGHT * 0.7, 46));

  const cloudTex = buildCloudTexture();
  const clouds = [];
  const rng = mulberry32(777);
  for (let i = 0; i < 6; i++) {
    const c = new PIXI.Sprite(cloudTex);
    c.alpha = 0.75;
    c.scale.set(1 + rng() * 0.6);
    c.x = rng() * GAME_WIDTH;
    c.y = 20 + rng() * (GAME_HEIGHT * 0.35);
    c.speed = 4 + rng() * 6;
    backgroundLayer.addChild(c);
    clouds.push(c);
  }

  // Polvo dorado flotando muy lento (ambiente) — unas pocas motas persistentes y baratas.
  const motes = [];
  for (let i = 0; i < 14; i++) {
    const m = new PIXI.Graphics();
    m.beginFill(PALETTE.gold, 0.35);
    m.drawCircle(0, 0, 1.4);
    m.endFill();
    m.x = rng() * GAME_WIDTH;
    m.y = rng() * GAME_HEIGHT;
    m.driftPhase = rng() * Math.PI * 2;
    m.speed = 4 + rng() * 5;
    backgroundLayer.addChild(m);
    motes.push(m);
  }

  return {
    update(dt) {
      for (const c of clouds) {
        c.x += c.speed * dt;
        if (c.x > GAME_WIDTH + 40) c.x = -40;
      }
      for (const m of motes) {
        m.driftPhase += dt * 0.6;
        m.x += Math.sin(m.driftPhase) * 6 * dt;
        m.y -= m.speed * dt;
        if (m.y < -4) m.y = GAME_HEIGHT + 4;
      }
    },
  };
}

// ─────────────────────────────────────────── Tiles ───────────────────────────────────────────

function tileKindAt(mapData, row, col) {
  const t = mapData.tiles[row][col];
  if (t === TILE_TYPES.PATH) return 'path';
  if (t === TILE_TYPES.START) return 'start';
  if (t === TILE_TYPES.END) return 'end';
  return 'buildable';
}

function buildStartEffects(sprite) {
  const glow = new PIXI.Graphics();
  sprite.addChild(glow);
  return {
    update(elapsed) {
      const pulse = 0.35 + Math.sin(elapsed * 3) * 0.2;
      glow.clear();
      glow.beginFill(PALETTE.iceLight, pulse);
      glow.drawCircle(GRID_SIZE / 2, GRID_SIZE / 2, 14 + Math.sin(elapsed * 3) * 2);
      glow.endFill();
    },
  };
}

function buildEndEffects(sprite) {
  const flag = new PIXI.Graphics();
  flag.x = GRID_SIZE / 2 + 6;
  flag.y = GRID_SIZE / 2 - 24;
  sprite.addChild(flag);
  return {
    update(elapsed) {
      const wave = Math.sin(elapsed * 6) * 3;
      flag.clear();
      flag.beginFill(PALETTE.fireRed);
      flag.drawPolygon([0, 0, 10 + wave, 3, 0, 6]);
      flag.endFill();
    },
  };
}

/**
 * Dibuja todos los tiles del mapa con texturas pixel art (variantes
 * deterministas según posición) y devuelve la matriz de sprites creados
 * para que game.js pueda seguir enganchando la interacción de clic/hover
 * exactamente igual que antes.
 */
function buildTiles(mapLayer, mapData) {
  const { rows, cols } = mapData;
  const tileSprites = Array.from({ length: rows }, () => Array(cols).fill(null));
  const dynamicEffects = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const kind = tileKindAt(mapData, row, col);
      const variant = kind === 'path' ? Math.floor(hashTile(row, col, 11) * 4) : Math.floor(hashTile(row, col, 22) * 3);

      const sprite = new PIXI.Sprite(getTileTexture(kind, variant));
      sprite.x = col * GRID_SIZE;
      sprite.y = row * GRID_SIZE;
      mapLayer.addChild(sprite);
      tileSprites[row][col] = sprite;

      if (kind === 'start') dynamicEffects.push(buildStartEffects(sprite));
      if (kind === 'end') dynamicEffects.push(buildEndEffects(sprite));
    }
  }

  return { tileSprites, dynamicEffects };
}

// ─────────────────────────────────────────── Decoraciones ───────────────────────────────────────────

const DECORATION_KINDS = ['tree-oak', 'tree-pine', 'bush', 'rock', 'flowers'];

function buildDecorations(decorationLayer, mapData) {
  const { rows, cols } = mapData;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (tileKindAt(mapData, row, col) !== 'buildable') continue;
      const roll = hashTile(row, col, 33);
      if (roll > 0.16) continue; // sólo una fracción de tiles lleva decoración

      const kind = DECORATION_KINDS[Math.floor(hashTile(row, col, 44) * DECORATION_KINDS.length)];
      const sprite = new PIXI.Sprite(getDecorationTexture(kind));
      sprite.anchor.set(0.5, 0.92);
      const jitterX = (hashTile(row, col, 55) - 0.5) * GRID_SIZE * 0.4;
      const jitterY = (hashTile(row, col, 66) - 0.5) * GRID_SIZE * 0.3;
      sprite.x = col * GRID_SIZE + GRID_SIZE / 2 + jitterX;
      sprite.y = row * GRID_SIZE + GRID_SIZE / 2 + jitterY + GRID_SIZE * 0.2;
      sprite.scale.set(kind.startsWith('tree') ? 1.1 : 0.9);
      decorationLayer.addChild(sprite);

      const shadow = new PIXI.Graphics();
      shadow.beginFill(0x000000, 0.22);
      shadow.drawEllipse(sprite.x, sprite.y + 2, 12, 4);
      shadow.endFill();
      decorationLayer.addChildAt(shadow, decorationLayer.getChildIndex(sprite));
    }
  }
}

/**
 * Construye todo el entorno visual del mapa: fondo (cielo/montañas/nubes),
 * tiles y decoraciones. Devuelve `{ tileSprites, update(dt, elapsed) }`.
 */
export function buildMapVisuals({ backgroundLayer, mapLayer, decorationLayer }, mapData) {
  const bg = buildBackground(backgroundLayer);
  const { tileSprites, dynamicEffects } = buildTiles(mapLayer, mapData);
  buildDecorations(decorationLayer, mapData);

  return {
    tileSprites,
    update(dt, elapsed) {
      bg.update(dt);
      for (const fx of dynamicEffects) fx.update(elapsed);
    },
  };
}
