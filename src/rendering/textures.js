// ────────────────────────────────────────────────────────────────────────
// Generador de texturas procedurales estilo pixel art (Canvas2D → PIXI.Texture)
//
// Todo lo que ve el jugador (enemigos, torres, proyectiles, tiles del mapa,
// decoraciones e iconos de UI) se dibuja aquí pixel a pixel sobre un
// <canvas> oculto, usando la paleta de 16 colores del proyecto (ver
// palette.js) más un pequeño set de acentos para brillos/criaturas. Las
// texturas se generan una sola vez y se cachean; el escalado posterior en
// PixiJS usa NEAREST para mantener los bordes nítidos característicos del
// pixel art.
//
// Este módulo es puramente visual: no importa nada de components.js /
// entities.js con lógica de juego, ni conoce estadísticas de daño/HP.
// ────────────────────────────────────────────────────────────────────────

import * as PIXI from 'pixi.js';
import { PALETTE, ACCENT } from './palette.js';

/** Ajustes globales de PixiJS para un render de pixel art nítido. */
export function initPixelRendering() {
  PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
  PIXI.settings.ROUND_PIXELS = true;
}

// ─────────────────────────────────────────── Lienzo de píxeles ───────────────────────────────────────────

/**
 * Envoltorio sobre un <canvas> que dibuja en una grilla lógica (unidades
 * "píxel de arte") escalada por `unit` píxeles de dispositivo reales, con
 * antialiasing desactivado. Soporta contorno automático de 1px para dar el
 * look de sprite recortado típico del pixel art.
 */
class PixelCanvas {
  constructor(widthPx, heightPx, unit = 2, originY = 0) {
    this.unit = unit;
    this.originY = originY; // desplazamiento vertical en unidades de grilla (permite coords. negativas, p.ej. mira de francotirador)
    this.canvas = document.createElement('canvas');
    this.canvas.width = widthPx;
    this.canvas.height = heightPx;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Rectángulo relleno en coordenadas de grilla (pueden ser .5 para contornos finos). */
  px(gx, gy, gw, gh, color) {
    if (!color) return;
    this.ctx.fillStyle = color;
    const u = this.unit;
    this.ctx.fillRect(Math.round(gx * u), Math.round((gy + this.originY) * u), Math.round(gw * u), Math.round(gh * u));
  }

  /** Bloque con contorno oscuro de 1px (o `outline=null` para omitirlo). */
  block(gx, gy, gw, gh, color, outline = ACCENT.outline) {
    if (outline) this.px(gx - 0.5, gy - 0.5, gw + 1, gh + 1, outline);
    this.px(gx, gy, gw, gh, color);
  }

  dot(gx, gy, color) {
    this.px(gx, gy, 1, 1, color);
  }

  /** Círculo "pixelado" (redondeo por celda de grilla). */
  circle(cx, cy, r, color) {
    for (let gy = Math.floor(cy - r); gy <= Math.ceil(cy + r); gy++) {
      for (let gx = Math.floor(cx - r); gx <= Math.ceil(cx + r); gx++) {
        const d = Math.hypot(gx + 0.5 - cx, gy + 0.5 - cy);
        if (d <= r) this.px(gx, gy, 1, 1, color);
      }
    }
  }

  circleOutlined(cx, cy, r, color, outline = ACCENT.outline) {
    if (outline) this.circle(cx, cy, r + 0.7, outline);
    this.circle(cx, cy, r, color);
  }

  /** Rombo "pixelado" (distancia Manhattan) — usado para cristales/gemas. */
  diamond(cx, cy, r, color) {
    for (let gy = Math.floor(cy - r); gy <= Math.ceil(cy + r); gy++) {
      for (let gx = Math.floor(cx - r); gx <= Math.ceil(cx + r); gx++) {
        const d = Math.abs(gx + 0.5 - cx) + Math.abs(gy + 0.5 - cy);
        if (d <= r) this.px(gx, gy, 1, 1, color);
      }
    }
  }

  diamondOutlined(cx, cy, r, color, outline = ACCENT.outline) {
    if (outline) this.diamond(cx, cy, r + 1, outline);
    this.diamond(cx, cy, r, color);
  }

  /** Traza una línea de puntos (usada para huesos de alas/cola del dragón). */
  dotLine(x0, y0, dx, dy, len, color) {
    for (let i = 0; i < len; i++) this.dot(x0 + dx * i, y0 + dy * i, color);
  }

  toTexture() {
    const tex = PIXI.Texture.from(this.canvas);
    tex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
    return tex;
  }
}

// Cache genérica: evita regenerar la misma textura dos veces.
const textureCache = new Map();
function cached(key, build) {
  if (!textureCache.has(key)) textureCache.set(key, build());
  return textureCache.get(key);
}

// ─────────────────────────────────────────── ENEMIGOS ───────────────────────────────────────────
// 3 frames de animación de caminata por tipo. phase: 0 = pierna izq. adelante,
// 1 = neutral, 2 = pierna der. adelante.

function buildGoblinFrame(phase) {
  const pc = new PixelCanvas(32, 32, 2);
  const bodyDark = PALETTE.greenDark;
  const bodyMid = PALETTE.greenMid;
  const skin = PALETTE.greenLight;
  const eye = PALETTE.gold;
  const belt = PALETTE.brownDark;

  const liftL = phase === 0 ? 1 : 0;
  const liftR = phase === 2 ? 1 : 0;
  pc.block(5, 12 + liftL, 2, 3 - liftL, bodyDark);
  pc.block(9, 12 + liftR, 2, 3 - liftR, bodyDark);

  const armL = phase === 2 ? -1 : 0;
  const armR = phase === 0 ? -1 : 0;
  pc.block(2, 8 + armL, 2, 4, skin);
  pc.block(12, 8 + armR, 2, 4, skin);

  pc.block(4, 7, 8, 5, bodyMid);
  pc.block(4, 11, 8, 1, belt);

  pc.circleOutlined(8, 4, 3, skin);
  pc.block(3, 3, 1, 2, skin);
  pc.block(12, 3, 1, 2, skin);
  pc.dot(6.5, 4, eye);
  pc.dot(9.5, 4, eye);

  return pc.toTexture();
}

function buildWolfFrame(phase) {
  const pc = new PixelCanvas(28, 28, 2);
  const dark = ACCENT.purpleDark;
  const mid = ACCENT.purpleMid;
  const eye = ACCENT.redGlow;

  pc.block(3, 6, 8, 4, dark);
  pc.circleOutlined(11, 6, 2.2, dark);
  pc.block(10, 3, 1, 2, dark);
  pc.block(12, 3, 1, 2, dark);
  pc.block(0, 5, 3, 1, mid);

  const strideF = phase === 0 ? 1 : phase === 2 ? -1 : 0;
  const strideB = -strideF;
  pc.block(8 + strideF, 10, 2, 3, mid);
  pc.block(4 + strideB, 10, 2, 3, mid);

  pc.dot(11.5, 5.5, eye);
  return pc.toTexture();
}

function buildGolemFrame(phase) {
  const pc = new PixelCanvas(40, 40, 2);
  const stone = PALETTE.gray;
  const stoneLight = PALETTE.silver;
  const stoneDarkC = '#5a5a5a';
  const moss = PALETTE.greenMid;
  const amber = PALETTE.gold;

  pc.block(4, 6, 12, 10, stone);
  pc.block(7, 2, 6, 4, stoneLight);
  pc.dot(9, 3.5, amber);
  pc.dot(12, 3.5, amber);
  pc.block(1, 8, 3, 6, stone);
  pc.block(16, 8, 3, 6, stone);

  const stompL = phase === 0 ? 1 : 0;
  const stompR = phase === 2 ? 1 : 0;
  pc.block(5, 16 + stompL, 4, 3 - stompL, stoneDarkC);
  pc.block(11, 16 + stompR, 4, 3 - stompR, stoneDarkC);

  pc.dot(8, 9, stoneDarkC);
  pc.dot(9, 10, stoneDarkC);
  pc.dot(10, 11, stoneDarkC);
  pc.dot(5, 7, moss);
  pc.dot(14, 12, moss);
  pc.dot(6, 14, moss);

  return pc.toTexture();
}

function buildDragonFrame(phase) {
  const pc = new PixelCanvas(64, 64, 2);
  const bone = ACCENT.boneWhite;
  const boneShadow = ACCENT.boneShadow;
  const glow = phase === 1 ? ACCENT.fireGlowGreen : ACCENT.fireGlowBlue;
  const flap = phase === 0 ? -1 : phase === 2 ? 1 : 0;

  // Cola
  pc.dotLine(16, 22, -0.4, 1, 8, boneShadow);
  // Columna / torso
  pc.block(14, 10, 4, 13, bone);
  pc.block(11, 13, 10, 1, boneShadow);
  pc.block(11, 16, 10, 1, boneShadow);
  pc.block(11, 19, 10, 1, boneShadow);
  // Cráneo
  pc.block(12, 3, 8, 6, bone);
  pc.block(12, 9, 8, 1, boneShadow);
  pc.dot(14, 6, glow);
  pc.dot(18, 6, glow);
  // Alas (huesos en abanico, la inclinación varía con `flap`)
  for (let i = 0; i < 9; i++) {
    const yL = 11 + i * (0.55 + flap * 0.12);
    const yR = 11 + i * (0.55 - flap * 0.12);
    pc.dot(13 - i, yL, i % 3 === 0 ? bone : boneShadow);
    pc.dot(19 + i, yR, i % 3 === 0 ? bone : boneShadow);
  }
  // Patas
  pc.block(12, 23, 2, 4, bone);
  pc.block(18, 23, 2, 4, bone);

  return pc.toTexture();
}

const ENEMY_BUILDERS = {
  normal: buildGoblinFrame,
  fast: buildWolfFrame,
  tank: buildGolemFrame,
  boss: buildDragonFrame,
  megaboss: buildDragonFrame,
};

/** Devuelve las 3 texturas de animación de caminata de un tipo de enemigo. */
export function getEnemyFrames(enemyTypeName) {
  return cached(`enemy:${enemyTypeName}`, () => {
    const builder = ENEMY_BUILDERS[enemyTypeName] ?? buildGoblinFrame;
    return [builder(0), builder(1), builder(2)];
  });
}

// ─────────────────────────────────────────── TORRES ───────────────────────────────────────────
// Cada torre se compone de 3 partes (igual que antes, para no romper el
// bamboleo/retroceso de renderSystem.js): `base` (estructura, varía por
// nivel/especialización), `turret` (emblema del arma, flota y retrocede) y
// `barrel` (accesorio pequeño sobre el emblema).

// Canvas alto con margen superior (originY) para que variantes muy altas
// (p.ej. Francotirador) puedan dibujar por encima de la fila 0 sin recortarse.
const TOWER_BASE_H = 120;
const TOWER_BASE_ORIGIN_Y = 20;
export const TOWER_BASE_ANCHOR = { x: 0.5, y: 56 / 60 };

function crenellations(pc, xStart, y, count, spacing, w, h, color) {
  for (let i = 0; i < count; i++) pc.block(xStart + i * spacing, y, w, h, color);
}

function buildArrowBase(variant) {
  const pc = new PixelCanvas(48, TOWER_BASE_H, 2, TOWER_BASE_ORIGIN_Y);
  const cx = 12;
  if (variant === 1) {
    pc.block(6, 30, 12, 4, PALETTE.brownDark);
    pc.block(7, 20, 10, 10, PALETTE.brownMid);
    crenellations(pc, 7, 18, 3, 4, 2, 2, PALETTE.brownLight);
    pc.dot(11, 24, ACCENT.outline);
    pc.circleOutlined(cx, 17, 1.4, PALETTE.beige);
  } else if (variant === 2) {
    pc.block(5, 30, 14, 4, PALETTE.gray);
    pc.block(6, 16, 12, 14, PALETTE.silver);
    crenellations(pc, 6, 14, 4, 3, 2, 2, PALETTE.gray);
    pc.block(17, 4, 1, 12, PALETTE.brownDark);
    pc.block(18, 4, 4, 3, PALETTE.fireRed);
    pc.circleOutlined(cx, 13, 1.6, ACCENT.purpleDark);
  } else if (variant === 3) {
    pc.block(5, 30, 14, 4, PALETTE.gray);
    pc.block(6, 8, 12, 22, PALETTE.silver);
    crenellations(pc, 6, 6, 4, 3, 2, 2, PALETTE.gray);
    pc.block(3, 8, 18, 2, PALETTE.brownDark);
    pc.block(2, 6, 2, 4, PALETTE.brownMid);
    pc.block(20, 6, 2, 4, PALETTE.brownMid);
    pc.circleOutlined(9, 5, 1.3, ACCENT.purpleDark);
    pc.circleOutlined(15, 5, 1.3, ACCENT.purpleDark);
  } else if (variant === 'spec1') {
    pc.block(5, 30, 14, 4, PALETTE.gray);
    pc.block(7, 2, 10, 28, PALETTE.silver);
    crenellations(pc, 7, 0, 3, 3, 2, 2, PALETTE.gray);
    pc.block(11, -6, 2, 8, PALETTE.gray);
    pc.circleOutlined(12, -7, 1.6, PALETTE.iceLight);
    pc.circleOutlined(cx, -3, 1.3, PALETTE.greenLight);
  } else if (variant === 'spec2') {
    pc.block(9, 22, 6, 12, PALETTE.brownDark);
    pc.circle(12, 20, 6, PALETTE.greenDark);
    pc.circle(8, 15, 5, PALETTE.greenMid);
    pc.circle(16, 15, 5, PALETTE.greenMid);
    pc.circle(12, 10, 6, PALETTE.greenLight);
    pc.dot(9, 16, PALETTE.gold);
    pc.dot(14, 13, PALETTE.gold);
    pc.dot(12, 19, PALETTE.gold);
  }
  return pc.toTexture();
}

function buildCannonBase(variant) {
  const pc = new PixelCanvas(48, TOWER_BASE_H, 2, TOWER_BASE_ORIGIN_Y);
  if (variant === 1) {
    pc.circleOutlined(7, 34, 2.2, PALETTE.brownDark);
    pc.circleOutlined(17, 34, 2.2, PALETTE.brownDark);
    pc.block(6, 28, 14, 6, PALETTE.brownMid);
    pc.block(10, 18, 4, 12, '#4a4a4a');
    pc.circle(12, 18, 2.2, '#6a6a6a');
  } else if (variant === 2) {
    pc.circleOutlined(7, 34, 2.4, PALETTE.brownDark);
    pc.circleOutlined(17, 34, 2.4, PALETTE.brownDark);
    pc.block(5, 27, 16, 7, PALETTE.brownLight);
    pc.block(9, 14, 6, 16, '#8b6b2b');
    pc.block(9, 18, 6, 1, PALETTE.gold);
    pc.block(9, 22, 6, 1, PALETTE.gold);
    pc.circle(12, 14, 2.4, '#c99a3c');
  } else if (variant === 3) {
    pc.circleOutlined(6, 34, 2.6, PALETTE.brownDark);
    pc.circleOutlined(18, 34, 2.6, PALETTE.brownDark);
    pc.block(4, 26, 18, 8, PALETTE.gray);
    pc.block(8, 10, 8, 18, '#3a3a3a');
    pc.block(6, 6, 12, 6, PALETTE.brownDark);
    pc.dot(8, 8, PALETTE.gold);
    pc.dot(12, 8, PALETTE.gold);
    pc.dot(16, 8, PALETTE.gold);
  } else if (variant === 'spec1') {
    pc.block(3, 26, 20, 9, PALETTE.gray);
    pc.block(5, 8, 3, 20, '#3a3a3a');
    pc.block(10.5, 4, 3, 24, '#3a3a3a');
    pc.block(16, 8, 3, 20, '#3a3a3a');
    pc.dot(6.5, 8, PALETTE.fireRed);
    pc.dot(12, 4, PALETTE.fireRed);
    pc.dot(17.5, 8, PALETTE.fireRed);
  } else if (variant === 'spec2') {
    pc.circleOutlined(6, 24, 3, PALETTE.fireRed);
    pc.block(6, 20, 14, 12, '#5a5a5a');
    pc.block(9, 8, 2, 12, '#3a3a3a');
    pc.block(15, 8, 2, 12, '#3a3a3a');
    pc.dot(10, 8, PALETTE.orange);
    pc.dot(16, 8, PALETTE.orange);
    pc.dot(10, 6, PALETTE.fireRed);
    pc.dot(16, 6, PALETTE.fireRed);
  }
  return pc.toTexture();
}

function buildIceBase(variant) {
  const pc = new PixelCanvas(48, TOWER_BASE_H, 2, TOWER_BASE_ORIGIN_Y);
  if (variant === 1) {
    pc.block(8, 32, 8, 4, PALETTE.gray);
    pc.diamondOutlined(12, 24, 5, PALETTE.iceLight);
    pc.diamond(12, 24, 2.4, PALETTE.iceBlue);
  } else if (variant === 2) {
    pc.block(9, 30, 6, 6, PALETTE.gray);
    pc.block(9, 14, 6, 18, PALETTE.iceBlue);
    pc.dot(10, 18, PALETTE.iceLight);
    pc.dot(14, 22, PALETTE.iceLight);
    pc.dot(10, 26, PALETTE.iceLight);
    pc.diamondOutlined(12, 12, 4, PALETTE.iceLight);
  } else if (variant === 3) {
    pc.block(8, 28, 8, 8, PALETTE.gray);
    pc.block(8, 8, 8, 22, PALETTE.iceBlue);
    pc.circleOutlined(12, 16, 3, PALETTE.white);
    pc.diamondOutlined(12, 6, 4, PALETTE.iceLight);
    pc.diamond(6, 20, 2, PALETTE.iceLight);
    pc.diamond(18, 20, 2, PALETTE.iceLight);
  } else if (variant === 'spec1') {
    pc.block(9, 30, 6, 5, PALETTE.gray);
    pc.block(7, 16, 10, 15, ACCENT.purpleDark);
    pc.block(8, 8, 8, 10, ACCENT.purpleMid);
    pc.circleOutlined(12, 10, 2.4, PALETTE.iceLight);
    pc.dot(12, 10, PALETTE.white);
  } else if (variant === 'spec2') {
    pc.block(9, 32, 6, 4, PALETTE.gray);
    pc.diamondOutlined(12, 24, 3, PALETTE.white);
    const orbits = 6;
    for (let i = 0; i < orbits; i++) {
      const a = (i / orbits) * Math.PI * 2;
      const r = 9;
      pc.diamond(12 + Math.cos(a) * r, 20 + Math.sin(a) * r * 0.7, 1.4, PALETTE.iceLight);
    }
  }
  return pc.toTexture();
}

const TOWER_BASE_BUILDERS = { ARROW: buildArrowBase, CANNON: buildCannonBase, ICE: buildIceBase };

/** variant: 1 | 2 | 3 (nivel) o 'spec1' | 'spec2' (especialización, siempre nivel 3). */
export function getTowerBaseTexture(towerType, variant) {
  return cached(`towerBase:${towerType}:${variant}`, () => TOWER_BASE_BUILDERS[towerType](variant));
}

function buildTurret(towerType, specKey) {
  const pc = new PixelCanvas(32, 32, 2);
  if (towerType === 'ARROW') {
    const tint = specKey === 'spec2' ? PALETTE.greenMid : PALETTE.brownLight;
    pc.circleOutlined(8, 8, specKey === 'spec1' ? 7 : 6, tint);
    if (specKey === 'spec1') pc.circle(8, 8, 3.5, PALETTE.silver);
    pc.dotLine(3, 12, 1, -1, 9, PALETTE.beige);
    pc.dot(11, 4, PALETTE.gray);
    if (specKey === 'spec2') pc.dot(6, 9, PALETTE.gold);
  } else if (towerType === 'CANNON') {
    const tint = specKey === 'spec1' ? PALETTE.fireRed : specKey === 'spec2' ? PALETTE.orange : '#4a4a4a';
    pc.circleOutlined(8, 8, 6, tint);
    pc.circle(8, 8, 3, '#2a2a2a');
    if (specKey === 'spec2') pc.dot(8, 3, PALETTE.orange);
  } else if (towerType === 'ICE') {
    const tint = specKey === 'spec1' ? ACCENT.purpleMid : PALETTE.iceLight;
    pc.diamondOutlined(8, 8, 5, tint);
    pc.diamond(8, 8, 2, PALETTE.white);
    if (specKey === 'spec2') {
      pc.dot(2, 8, PALETTE.iceLight);
      pc.dot(14, 8, PALETTE.iceLight);
    }
  }
  return pc.toTexture();
}

export function getTowerTurretTexture(towerType, specKey) {
  return cached(`turret:${towerType}:${specKey ?? 'base'}`, () => buildTurret(towerType, specKey));
}

function buildBarrel(towerType) {
  const pc = new PixelCanvas(16, 16, 2);
  if (towerType === 'ARROW') {
    pc.block(3, 5, 2, 6, PALETTE.brownMid);
    pc.dot(3, 4, PALETTE.fireRed);
    pc.dot(4, 4, PALETTE.fireRed);
  } else if (towerType === 'CANNON') {
    pc.block(2, 4, 4, 7, '#3a3a3a');
  } else if (towerType === 'ICE') {
    pc.diamondOutlined(4, 6, 2.4, PALETTE.iceLight);
  }
  return pc.toTexture();
}

export function getTowerBarrelTexture(towerType) {
  return cached(`barrel:${towerType}`, () => buildBarrel(towerType));
}

// ─────────────────────────────────────────── PROYECTILES ───────────────────────────────────────────

function buildProjectile(towerType) {
  if (towerType === 'ARROW') {
    const pc = new PixelCanvas(16, 6, 2);
    pc.px(1, 2, 2, 1, PALETTE.fireRed);
    pc.px(3, 2, 5, 1, PALETTE.brownMid);
    pc.px(8, 1.5, 2, 2, PALETTE.silver);
    return pc.toTexture();
  }
  if (towerType === 'CANNON') {
    const pc = new PixelCanvas(12, 12, 2);
    pc.circleOutlined(3, 3, 2.6, '#3a3a3a');
    pc.dot(2, 2, '#7a7a7a');
    return pc.toTexture();
  }
  const pc = new PixelCanvas(12, 16, 2);
  pc.diamondOutlined(3, 4, 2.6, PALETTE.iceLight);
  pc.dot(3, 3, PALETTE.white);
  return pc.toTexture();
}

export function getProjectileTexture(towerType) {
  return cached(`projectile:${towerType}`, () => buildProjectile(towerType));
}

// ─────────────────────────────────────────── TILES DEL MAPA ───────────────────────────────────────────

const TILE_PX = 64;

function seededScatter(pc, count, colorFn, rng) {
  for (let i = 0; i < count; i++) {
    const gx = Math.floor(rng() * 30) + 1;
    const gy = Math.floor(rng() * 30) + 1;
    pc.dot(gx, gy, colorFn());
  }
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPathTile(variant) {
  const pc = new PixelCanvas(TILE_PX, TILE_PX, 2);
  const rng = mulberry32(1000 + variant);
  pc.px(0, 0, 32, 32, PALETTE.brownLight);
  seededScatter(pc, 40, () => (rng() > 0.5 ? PALETTE.brownMid : PALETTE.beige), rng);
  seededScatter(pc, 14, () => '#5c4326', rng);
  // marcas de carreta
  const trackY1 = 8 + variant;
  const trackY2 = 22 + variant;
  for (let x = 0; x < 32; x += 2) {
    pc.dot(x, trackY1, PALETTE.brownDark);
    pc.dot(x, trackY2, PALETTE.brownDark);
  }
  // hierba en los bordes
  for (let x = 0; x < 32; x += 3) {
    if (rng() > 0.5) pc.dot(x, 0, PALETTE.greenMid);
    if (rng() > 0.5) pc.dot(x, 31, PALETTE.greenMid);
  }
  return pc.toTexture();
}

function buildBuildableTile(variant) {
  const pc = new PixelCanvas(TILE_PX, TILE_PX, 2);
  const rng = mulberry32(2000 + variant);
  const base = variant === 0 ? PALETTE.greenMid : variant === 1 ? PALETTE.greenDark : PALETTE.greenLight;
  pc.px(0, 0, 32, 32, base);
  seededScatter(pc, 60, () => (rng() > 0.5 ? PALETTE.greenLight : PALETTE.greenDark), rng);
  const flowers = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < flowers; i++) {
    const gx = Math.floor(rng() * 28) + 2;
    const gy = Math.floor(rng() * 28) + 2;
    pc.dot(gx, gy, rng() > 0.5 ? PALETTE.white : PALETTE.gold);
    pc.dot(gx + 1, gy, rng() > 0.5 ? PALETTE.white : PALETTE.gold);
  }
  return pc.toTexture();
}

function buildStartTile() {
  const pc = new PixelCanvas(TILE_PX, TILE_PX, 2);
  pc.px(0, 0, 32, 32, PALETTE.gray);
  seededScatter(pc, 30, () => '#787878', mulberry32(42));
  pc.circleOutlined(16, 16, 10, '#3a3a3a');
  pc.circle(16, 16, 7, PALETTE.iceBlue);
  pc.diamond(16, 16, 3, PALETTE.iceLight);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    pc.dot(16 + Math.cos(a) * 9, 16 + Math.sin(a) * 9, PALETTE.iceLight);
  }
  return pc.toTexture();
}

function buildEndTile() {
  const pc = new PixelCanvas(TILE_PX, TILE_PX, 2);
  pc.px(0, 0, 32, 32, PALETTE.gray);
  seededScatter(pc, 30, () => '#787878', mulberry32(99));
  pc.block(6, 14, 20, 16, PALETTE.silver);
  pc.block(6, 10, 4, 4, PALETTE.gray);
  pc.block(22, 10, 4, 4, PALETTE.gray);
  pc.block(13, 6, 6, 8, PALETTE.gray);
  pc.block(14, 20, 4, 10, ACCENT.outline);
  return pc.toTexture();
}

export function getTileTexture(kind, variant = 0) {
  return cached(`tile:${kind}:${variant}`, () => {
    if (kind === 'path') return buildPathTile(variant % 4);
    if (kind === 'buildable') return buildBuildableTile(variant % 3);
    if (kind === 'start') return buildStartTile();
    if (kind === 'end') return buildEndTile();
    throw new Error(`Tile desconocido: ${kind}`);
  });
}

// ─────────────────────────────────────────── DECORACIONES ───────────────────────────────────────────

function buildTree(kind) {
  const pc = new PixelCanvas(32, 40, 2);
  if (kind === 'oak') {
    pc.block(14, 12, 4, 8, PALETTE.brownDark);
    pc.circle(16, 8, 8, PALETTE.greenDark);
    pc.circle(11, 7, 5, PALETTE.greenMid);
    pc.circle(21, 7, 5, PALETTE.greenMid);
    pc.circle(16, 5, 5, PALETTE.greenLight);
  } else if (kind === 'pine') {
    pc.block(14, 15, 4, 5, PALETTE.brownDark);
    pc.diamond(16, 14, 8, PALETTE.greenDark);
    pc.diamond(16, 9, 6, PALETTE.greenMid);
    pc.diamond(16, 5, 4, PALETTE.greenLight);
  } else {
    pc.circle(16, 15, 7, PALETTE.greenDark);
    pc.circle(12, 13, 4, PALETTE.greenMid);
    pc.circle(20, 13, 4, PALETTE.greenMid);
  }
  return pc.toTexture();
}

function buildRock() {
  const pc = new PixelCanvas(24, 18, 2);
  pc.circleOutlined(6, 7, 4, PALETTE.gray);
  pc.circleOutlined(9, 6, 5, PALETTE.silver);
  pc.dot(8, 5, PALETTE.greenMid);
  pc.dot(5, 8, PALETTE.greenDark);
  return pc.toTexture();
}

function buildFlowerCluster() {
  const pc = new PixelCanvas(12, 12, 2);
  pc.dot(3, 4, PALETTE.greenDark);
  pc.dot(2, 3, PALETTE.white);
  pc.dot(4, 3, PALETTE.gold);
  pc.dot(3, 2, PALETTE.white);
  return pc.toTexture();
}

export function getDecorationTexture(kind) {
  return cached(`deco:${kind}`, () => {
    if (kind === 'tree-oak') return buildTree('oak');
    if (kind === 'tree-pine') return buildTree('pine');
    if (kind === 'bush') return buildTree('bush');
    if (kind === 'rock') return buildRock();
    if (kind === 'flowers') return buildFlowerCluster();
    throw new Error(`Decoración desconocida: ${kind}`);
  });
}

// ─────────────────────────────────────────── ICONOS DE UI ───────────────────────────────────────────

function buildCoinIcon() {
  const pc = new PixelCanvas(16, 16, 1);
  pc.circleOutlined(8, 8, 6.5, PALETTE.gold);
  pc.circle(8, 8, 4.5, '#c99a2c');
  pc.circle(7, 7, 2, PALETTE.gold);
  return pc.toTexture();
}

function buildHeartIcon() {
  const pc = new PixelCanvas(16, 16, 1);
  pc.circleOutlined(5.5, 6, 3, PALETTE.fireRed);
  pc.circleOutlined(10.5, 6, 3, PALETTE.fireRed);
  pc.px(3, 6, 10, 4, PALETTE.fireRed);
  for (let i = 0; i < 5; i++) pc.px(4 + i, 10 + i, 8 - i * 2, 1, PALETTE.fireRed);
  pc.dot(6, 5, PALETTE.orange);
  return pc.toTexture();
}

export function getUiIconTexture(kind) {
  return cached(`ui:${kind}`, () => {
    if (kind === 'coin') return buildCoinIcon();
    if (kind === 'heart') return buildHeartIcon();
    throw new Error(`Icono desconocido: ${kind}`);
  });
}
