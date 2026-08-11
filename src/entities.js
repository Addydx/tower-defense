import * as PIXI from 'pixi.js';
import { addComponent, addEntity } from 'bitecs';
import {
  Position,
  Velocity,
  Health,
  Enemy,
  Tower,
  Projectile,
  Renderable,
  GroundOnly,
  Regen,
} from './components.js';
import {
  ENEMY_TYPES,
  ENEMY_TYPE_IDS,
  TOWER_TYPES,
  TOWER_TYPE_IDS,
  TOWER_TYPE_BY_ID,
  GRID_SIZE,
  COLORS,
} from './constants.js';
import {
  getEnemyFrames,
  getTowerBaseTexture,
  getTowerTurretTexture,
  getTowerBarrelTexture,
  getProjectileTexture,
  TOWER_BASE_ANCHOR,
} from './rendering/textures.js';
import { drawShadow, drawGlow } from './rendering/effects.js';

/**
 * Crea un enemigo en el waypoint de inicio del camino.
 * @param {object} world - mundo bitECS
 * @param {'normal'|'fast'|'tank'|'boss'|'megaboss'} type
 * @param {{x:number,y:number}} startPos - posición mundial inicial (waypoint START)
 * @param {PIXI.Container} layer - contenedor donde se añade el sprite
 * @param {{hpMult?:number, speedMult?:number, goldMult?:number, regenHps?:number}} [options] - modificadores (modo sin fin)
 */
export function createEnemy(world, type, startPos, layer, options = {}) {
  const stats = ENEMY_TYPES[type];
  const hp = Math.round(stats.hp * (options.hpMult ?? 1));
  const speed = stats.speed * (options.speedMult ?? 1);
  const gold = Math.round(stats.gold * (options.goldMult ?? 1));
  const eid = addEntity(world);

  addComponent(world, eid, Position);
  Position.x[eid] = startPos.x;
  Position.y[eid] = startPos.y;

  addComponent(world, eid, Velocity);
  Velocity.x[eid] = 0;
  Velocity.y[eid] = 0;

  addComponent(world, eid, Health);
  Health.current[eid] = hp;
  Health.max[eid] = hp;

  addComponent(world, eid, Enemy);
  Enemy.speed[eid] = speed;
  Enemy.goldReward[eid] = gold;
  Enemy.pathProgress[eid] = 0;
  Enemy.pathIndex[eid] = 0;
  Enemy.enemyType[eid] = ENEMY_TYPE_IDS[type];

  addComponent(world, eid, GroundOnly);

  if (options.regenHps) {
    addComponent(world, eid, Regen);
    Regen.hps[eid] = options.regenHps;
  }

  const container = new PIXI.Container();
  container.x = startPos.x;
  container.y = startPos.y;

  const shadow = new PIXI.Graphics();
  drawShadow(shadow, { rx: stats.radius * 0.9, ry: stats.radius * 0.35, yOffset: stats.radius * 0.75, alpha: 0.3 });
  container.addChild(shadow);

  const frostOverlay = new PIXI.Graphics();
  frostOverlay.beginFill(0xbde9ff, 0.45);
  frostOverlay.drawCircle(0, 0, stats.radius * 1.05);
  frostOverlay.endFill();
  frostOverlay.visible = false;
  container.frost = frostOverlay;

  const frames = getEnemyFrames(type);
  const body = new PIXI.Sprite(frames[1]);
  body.anchor.set(0.5);
  body.width = stats.radius * 2.2;
  body.height = stats.radius * 2.2;
  container.addChild(body);
  container.addChild(frostOverlay);

  const barWidth = stats.radius * 2;
  const barY = -stats.radius - 14;

  const healthBarBg = new PIXI.Graphics();
  healthBarBg.beginFill(0x2a1608);
  healthBarBg.drawRect(-barWidth / 2 - 1, barY - 1, barWidth + 2, 7);
  healthBarBg.endFill();
  healthBarBg.lineStyle(1, COLORS.UI_PANEL_BORDER, 0.9);
  healthBarBg.drawRect(-barWidth / 2 - 1, barY - 1, barWidth + 2, 7);
  container.addChild(healthBarBg);

  const healthBarFill = new PIXI.Graphics();
  healthBarFill.beginFill(0x4caf50);
  healthBarFill.drawRect(-barWidth / 2, barY, barWidth, 5);
  healthBarFill.endFill();
  container.addChild(healthBarFill);

  container.body = body;
  container.healthBarFill = healthBarFill;
  container.barWidth = barWidth;
  container.baseColor = stats.color;
  container.radius = stats.radius;
  container.walkFrames = frames;
  container.enemyTypeName = type;
  container.lastHealth = hp;
  container.flashTimer = 0;

  layer.addChild(container);

  addComponent(world, eid, Renderable);
  Renderable.sprite[eid] = container;
  Renderable.width[eid] = stats.radius * 2;
  Renderable.height[eid] = stats.radius * 2;
  Renderable.tint[eid] = stats.color;
  Renderable.visible[eid] = 1;

  return eid;
}

/**
 * Crea una torre centrada en la celda de grilla indicada.
 * @param {object} world
 * @param {number} gridX
 * @param {number} gridY
 * @param {'ARROW'|'CANNON'|'ICE'} towerType
 * @param {PIXI.Container} layer
 */
export function createTower(world, gridX, gridY, towerType, layer) {
  const stats = TOWER_TYPES[towerType];
  const eid = addEntity(world);

  const worldX = gridX * GRID_SIZE + GRID_SIZE / 2;
  const worldY = gridY * GRID_SIZE + GRID_SIZE / 2;

  addComponent(world, eid, Position);
  Position.x[eid] = worldX;
  Position.y[eid] = worldY;

  addComponent(world, eid, Tower);
  Tower.range[eid] = stats.range;
  Tower.damage[eid] = stats.damage;
  Tower.fireRate[eid] = stats.fireRate;
  Tower.lastFireTime[eid] = 0;
  Tower.cost[eid] = stats.cost;
  Tower.level[eid] = 1;
  Tower.towerType[eid] = TOWER_TYPE_IDS[towerType];
  Tower.specialization[eid] = 0;
  Tower.gridX[eid] = gridX;
  Tower.gridY[eid] = gridY;

  const container = new PIXI.Container();
  container.x = worldX;
  container.y = worldY;

  const shadow = new PIXI.Graphics();
  drawShadow(shadow, { rx: 20, ry: 7, yOffset: 20, alpha: 0.32 });
  container.addChild(shadow);

  const glow = new PIXI.Graphics();
  drawGlow(glow, stats.color, 46);
  container.addChild(glow);

  const base = new PIXI.Sprite(getTowerBaseTexture(towerType, 1));
  base.anchor.set(TOWER_BASE_ANCHOR.x, TOWER_BASE_ANCHOR.y);
  container.addChild(base);

  const turret = new PIXI.Sprite(getTowerTurretTexture(towerType, null));
  turret.anchor.set(0.5);
  turret.y = -30;
  container.addChild(turret);

  const barrel = new PIXI.Sprite(getTowerBarrelTexture(towerType));
  barrel.anchor.set(0.5, 1);
  barrel.y = -30;
  container.addChild(barrel);

  const rangeIndicator = new PIXI.Graphics();
  rangeIndicator.lineStyle(2, COLORS.RANGE_INDICATOR, 0.5);
  rangeIndicator.drawCircle(0, 0, stats.range);
  rangeIndicator.visible = false;
  container.addChild(rangeIndicator);

  container.base = base;
  container.turret = turret;
  container.barrel = barrel;
  container.shadow = shadow;
  container.glow = glow;
  container.glowColor = stats.color;
  container.glowLevel = 1;
  container.rangeIndicator = rangeIndicator;
  container.idlePhase = Math.random() * Math.PI * 2;
  container.recoilTimer = 0;
  container.buildTimer = 0.45; // animación de construcción (Fase 4)
  container.scale.set(0.3);
  container.alpha = 0;

  layer.addChild(container);

  addComponent(world, eid, Renderable);
  Renderable.sprite[eid] = container;
  Renderable.width[eid] = 48;
  Renderable.height[eid] = 48;
  Renderable.tint[eid] = stats.color;
  Renderable.visible[eid] = 1;

  return eid;
}

// Pool de visuales de proyectil reutilizables (contenedor con estela +
// sprite de cabeza pixel art): evita crear/destruir objetos PIXI en cada
// disparo (Fase 7, optimización de rendimiento).
const projectileVisualPool = [];

function acquireProjectileVisual() {
  const existing = projectileVisualPool.pop();
  if (existing) return existing;

  const container = new PIXI.Container();
  const trail = new PIXI.Graphics();
  const head = new PIXI.Sprite();
  head.anchor.set(0.5);
  container.addChild(trail, head);
  container.trail = trail;
  container.head = head;
  return container;
}

export function releaseProjectileGraphics(container) {
  container.visible = false;
  if (container.parent) container.parent.removeChild(container);
  projectileVisualPool.push(container);
}

/**
 * Crea un proyectil que viaja desde (fromX, fromY) hacia el enemigo objetivo.
 * @param {object} world
 * @param {number} fromX
 * @param {number} fromY
 * @param {number} targetX
 * @param {number} targetY
 * @param {number} damage
 * @param {PIXI.Container} layer
 * @param {object} options - { targetEid, towerType, speed, projectileColor, splash, poison, freezeChance }
 */
export function createProjectile(world, fromX, fromY, targetX, targetY, damage, layer, options = {}) {
  const eid = addEntity(world);

  addComponent(world, eid, Position);
  Position.x[eid] = fromX;
  Position.y[eid] = fromY;

  addComponent(world, eid, Projectile);
  Projectile.speed[eid] = options.speed ?? 400;
  Projectile.damage[eid] = damage;
  Projectile.targetX[eid] = targetX;
  Projectile.targetY[eid] = targetY;
  Projectile.fromX[eid] = fromX;
  Projectile.fromY[eid] = fromY;
  Projectile.targetEid[eid] = options.targetEid ?? -1;
  Projectile.fromTowerType[eid] = options.towerType ?? 0;

  const color = options.projectileColor ?? 0xffffff;
  const towerTypeName = TOWER_TYPE_BY_ID[options.towerType ?? 0];

  const container = acquireProjectileVisual();
  container.trail.clear();
  container.trail.beginFill(color, 0.5);
  container.trail.drawPolygon([-14, -2, -4, 0, -14, 2]);
  container.trail.endFill();
  container.head.texture = getProjectileTexture(towerTypeName);
  container.visible = true;
  container.rotation = 0;
  container.x = fromX;
  container.y = fromY;
  layer.addChild(container);

  addComponent(world, eid, Renderable);
  Renderable.sprite[eid] = container;
  Renderable.width[eid] = 12;
  Renderable.height[eid] = 12;
  Renderable.tint[eid] = color;
  Renderable.visible[eid] = 1;

  return eid;
}
