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
  GRID_SIZE,
  COLORS,
} from './constants.js';

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

  const body = new PIXI.Graphics();
  body.beginFill(0xffffff);
  body.drawCircle(0, 0, stats.radius);
  body.endFill();
  body.lineStyle(2, 0x000000, 0.35);
  body.drawCircle(0, 0, stats.radius);
  body.tint = stats.color;
  container.addChild(body);

  const barWidth = stats.radius * 2;
  const barY = -stats.radius - 12;

  const healthBarBg = new PIXI.Graphics();
  healthBarBg.beginFill(0x4a0000);
  healthBarBg.drawRect(-barWidth / 2, barY, barWidth, 5);
  healthBarBg.endFill();
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

  const base = new PIXI.Graphics();
  base.beginFill(0x3e2723);
  base.drawRoundedRect(-24, -24, 48, 48, 6);
  base.endFill();
  container.addChild(base);

  const turret = new PIXI.Graphics();
  turret.beginFill(stats.color);
  turret.drawCircle(0, 0, 18);
  turret.endFill();
  turret.lineStyle(3, 0xffffff, 0.4);
  turret.drawCircle(0, 0, 18);
  container.addChild(turret);

  const barrel = new PIXI.Graphics();
  barrel.beginFill(0x212121);
  barrel.drawRect(-4, -26, 8, 14);
  barrel.endFill();
  container.addChild(barrel);

  const rangeIndicator = new PIXI.Graphics();
  rangeIndicator.lineStyle(2, COLORS.RANGE_INDICATOR, 0.5);
  rangeIndicator.drawCircle(0, 0, stats.range);
  rangeIndicator.visible = false;
  container.addChild(rangeIndicator);

  container.base = base;
  container.turret = turret;
  container.barrel = barrel;
  container.rangeIndicator = rangeIndicator;
  container.idlePhase = Math.random() * Math.PI * 2;
  container.recoilTimer = 0;

  layer.addChild(container);

  addComponent(world, eid, Renderable);
  Renderable.sprite[eid] = container;
  Renderable.width[eid] = 48;
  Renderable.height[eid] = 48;
  Renderable.tint[eid] = stats.color;
  Renderable.visible[eid] = 1;

  return eid;
}

// Pool de gráficos de proyectil reutilizables: evita crear/destruir
// objetos PIXI en cada disparo (Fase 9, optimización de rendimiento).
const projectileSpritePool = [];

function acquireProjectileGraphics() {
  return projectileSpritePool.pop() ?? new PIXI.Graphics();
}

export function releaseProjectileGraphics(graphics) {
  graphics.clear();
  graphics.visible = false;
  if (graphics.parent) graphics.parent.removeChild(graphics);
  projectileSpritePool.push(graphics);
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
  const graphics = acquireProjectileGraphics();
  graphics.beginFill(color, 0.55);
  graphics.drawPolygon([-14, -2, -4, 0, -14, 2]);
  graphics.endFill();
  graphics.beginFill(0xffffff);
  graphics.drawCircle(0, 0, 6);
  graphics.endFill();
  graphics.lineStyle(1, color, 0.8);
  graphics.drawCircle(0, 0, 6);
  graphics.visible = true;
  graphics.rotation = 0;
  graphics.x = fromX;
  graphics.y = fromY;
  layer.addChild(graphics);

  addComponent(world, eid, Renderable);
  Renderable.sprite[eid] = graphics;
  Renderable.width[eid] = 12;
  Renderable.height[eid] = 12;
  Renderable.tint[eid] = color;
  Renderable.visible[eid] = 1;

  return eid;
}
