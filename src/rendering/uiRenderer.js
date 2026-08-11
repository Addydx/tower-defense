// ────────────────────────────────────────────────────────────────────────
// UI pixel art (Fase 3): paneles, botones e iconos reutilizables. Estos
// helpers no conocen nada del estado del juego — game.js les pasa la
// etiqueta/handler y decide cuándo llamarlos. Los paneles/botones
// devueltos exponen la misma API que antes (`container.setEnabled`,
// `container.labelText`) para no tocar la lógica que los usa.
// ────────────────────────────────────────────────────────────────────────

import * as PIXI from 'pixi.js';
import { getPanelTileTexture, getUiIconTexture } from './textures.js';
import { PALETTE } from './palette.js';

const FONT = '"Trebuchet MS", Georgia, sans-serif';
const OUTLINE = 0x1a1208;

/** Panel con fondo texturizado (madera/piedra/pergamino) y marco con remaches dorados. */
export function makePixelPanel(width, height, theme = 'stone') {
  const container = new PIXI.Container();

  const tile = new PIXI.TilingSprite(getPanelTileTexture(theme), width, height);
  container.addChild(tile);

  const border = new PIXI.Graphics();
  border.lineStyle(2, OUTLINE, 1);
  border.drawRect(0, 0, width, height);
  border.lineStyle(2, PALETTE.gold, 0.85);
  border.drawRect(3, 3, width - 6, height - 6);
  container.addChild(border);

  for (const [cx, cy] of [
    [7, 7],
    [width - 7, 7],
    [7, height - 7],
    [width - 7, height - 7],
  ]) {
    const stud = new PIXI.Graphics();
    stud.beginFill(PALETTE.gold);
    stud.drawCircle(cx, cy, 2.2);
    stud.endFill();
    stud.lineStyle(1, OUTLINE, 0.6);
    stud.drawCircle(cx, cy, 2.2);
    container.addChild(stud);
  }

  container.hitArea = new PIXI.Rectangle(0, 0, width, height);
  container.eventMode = 'static';
  container.on('pointerdown', (e) => e.stopPropagation());
  container.bg = tile;
  return container;
}

function drawCracks(g, width, height) {
  g.lineStyle(1.5, 0x2a1608, 0.85);
  g.moveTo(width * 0.2, 0);
  g.lineTo(width * 0.35, height * 0.4);
  g.lineTo(width * 0.15, height * 0.7);
  g.moveTo(width * 0.7, height);
  g.lineTo(width * 0.6, height * 0.5);
  g.lineTo(width * 0.8, height * 0.35);
}

/**
 * Botón texturizado con estado hover/disabled. `opts.accent` colorea el
 * marco (dorado = mejorar, rojo = vender, púrpura = especializar, etc.).
 * `opts.theme` elige la textura de fondo ('wood' por defecto).
 */
export function makePixelButton(label, width, height, onClick, opts = {}) {
  const theme = opts.theme ?? 'wood';
  const accent = opts.accent ?? PALETTE.gold;
  const disabledColor = 0x555555;

  const container = new PIXI.Container();
  const tile = new PIXI.TilingSprite(getPanelTileTexture(theme), width, height);
  container.addChild(tile);

  const wash = new PIXI.Graphics();
  wash.beginFill(accent, 0.22);
  wash.drawRect(0, 0, width, height);
  wash.endFill();
  container.addChild(wash);

  const border = new PIXI.Graphics();
  const drawBorder = (color, glow = false) => {
    border.clear();
    border.lineStyle(2, OUTLINE, 1);
    border.drawRect(0, 0, width, height);
    border.lineStyle(glow ? 3 : 2, color, 1);
    border.drawRect(2, 2, width - 4, height - 4);
  };
  drawBorder(accent);
  container.addChild(border);

  const cracks = new PIXI.Graphics();
  cracks.visible = false;
  container.addChild(cracks);

  const text = new PIXI.Text(label, {
    fontFamily: FONT,
    fontSize: Math.min(18, height * 0.4),
    fontWeight: 'bold',
    fill: PALETTE.white,
    align: 'center',
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowDistance: 1,
    dropShadowAlpha: 0.85,
  });
  text.anchor.set(0.5);
  text.x = width / 2;
  text.y = height / 2;
  container.addChild(text);
  container.labelText = text;

  container.eventMode = 'static';
  container.cursor = 'pointer';
  container.hitArea = new PIXI.Rectangle(0, 0, width, height);

  container.setEnabled = (enabled) => {
    container.eventMode = enabled ? 'static' : 'none';
    container.cursor = enabled ? 'pointer' : 'default';
    container.alpha = enabled ? 1 : 0.6;
    wash.visible = enabled;
    cracks.visible = !enabled;
    if (!enabled) {
      cracks.clear();
      drawCracks(cracks, width, height);
      drawBorder(disabledColor);
    } else {
      drawBorder(accent);
    }
  };

  container.on('pointerover', () => {
    if (container.eventMode === 'static') drawBorder(0xffffff, true);
  });
  container.on('pointerout', () => {
    if (container.eventMode === 'static') drawBorder(accent);
  });
  container.on('pointerdown', (e) => {
    e.stopPropagation();
    onClick();
  });

  return container;
}

/** Icono de moneda o corazón a un tamaño dado. */
export function makeIcon(kind, size = 18) {
  const sprite = new PIXI.Sprite(getUiIconTexture(kind));
  sprite.width = size;
  sprite.height = size;
  return sprite;
}

/** Barra de estadística rellenable (usada en el panel de información de torre). */
export function makeStatBar(width, height, color) {
  const container = new PIXI.Container();
  const bg = new PIXI.Graphics();
  bg.beginFill(0x2a1608);
  bg.drawRect(0, 0, width, height);
  bg.endFill();
  bg.lineStyle(1, PALETTE.gold, 0.7);
  bg.drawRect(0, 0, width, height);
  container.addChild(bg);

  const fill = new PIXI.Graphics();
  fill.beginFill(color);
  fill.drawRect(0, 0, width, height);
  fill.endFill();
  container.addChild(fill);
  container.fillBar = fill;

  container.setPct = (pct) => {
    fill.scale.x = Math.max(0, Math.min(1, pct));
  };
  return container;
}
