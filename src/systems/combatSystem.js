import { query } from 'bitecs';
import { Position, Tower, Enemy, Health, Renderable } from '../components.js';
import { TOWER_TYPE_BY_ID, TOWER_TYPES, PROJECTILE_SPEED } from '../constants.js';
import { getSpecialization } from '../towerStats.js';
import { createProjectile } from '../entities.js';

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/**
 * Elige el enemigo dentro de rango con mayor pathProgress (el más
 * avanzado hacia la salida), que es el criterio estándar para no dejar
 * pasar fugas.
 */
export function acquireTarget(world, towerEid) {
  const enemies = query(world, [Position, Enemy, Health]);
  const tx = Position.x[towerEid];
  const ty = Position.y[towerEid];
  const range = Tower.range[towerEid];

  let best = -1;
  let bestProgress = -Infinity;
  for (const eid of enemies) {
    if (Health.current[eid] <= 0) continue;
    const d = distance(tx, ty, Position.x[eid], Position.y[eid]);
    if (d > range) continue;
    if (Enemy.pathProgress[eid] > bestProgress) {
      bestProgress = Enemy.pathProgress[eid];
      best = eid;
    }
  }
  return best === -1 ? null : best;
}

/**
 * Actualiza el targeting y disparo de todas las torres. Los proyectiles
 * creados se registran en `projectileEffects` con su configuración extra
 * (splash, veneno, congelación...) para que projectileSystem la use al
 * impactar.
 */
export function updateTowers(world, { dt, time, projectileLayer, projectileEffects, onShoot, onFlame }) {
  const towers = query(world, [Position, Tower]);

  for (const eid of towers) {
    const towerTypeName = TOWER_TYPE_BY_ID[Tower.towerType[eid]];
    const baseStats = TOWER_TYPES[towerTypeName];
    const spec = getSpecialization(towerTypeName, Tower.specialization[eid]);
    const target = acquireTarget(world, eid);

    if (spec?.flamethrower) {
      if (target !== null) {
        const angle = Math.atan2(Position.y[target] - Position.y[eid], Position.x[target] - Position.x[eid]);
        applyConeDamage(world, eid, angle, spec, dt);
        onFlame?.(Position.x[eid], Position.y[eid], angle);
      }
      continue;
    }

    if (target === null) continue;

    const fireInterval = 1 / Tower.fireRate[eid];
    if (time - Tower.lastFireTime[eid] < fireInterval) continue;
    Tower.lastFireTime[eid] = time;

    const shots = spec?.multishot ?? 1;
    const perShotDamageMult = spec?.shotDamageMult ?? 1;

    for (let i = 0; i < shots; i++) {
      const options = {
        targetEid: target,
        towerType: Tower.towerType[eid],
        speed: PROJECTILE_SPEED,
        projectileColor: baseStats.projectileColor,
      };

      const effects = {};
      if (spec?.splashRadius) effects.splashRadius = spec.splashRadius;
      if (spec?.poison) effects.poison = spec.poison;
      if (spec?.freezeChance) {
        effects.freezeChance = spec.freezeChance;
        effects.freezeDuration = spec.freezeDuration;
      }
      if (spec?.aoeSlowRadius) {
        effects.aoeSlowRadius = spec.aoeSlowRadius;
        effects.baseSlow = { factor: baseStats.slowFactor ?? 0.5, duration: baseStats.slowDuration ?? 2 };
      } else if (towerTypeName === 'ICE') {
        effects.baseSlow = { factor: baseStats.slowFactor, duration: baseStats.slowDuration };
      }

      const projEid = createProjectile(
        world,
        Position.x[eid],
        Position.y[eid],
        Position.x[target],
        Position.y[target],
        Tower.damage[eid] * perShotDamageMult,
        projectileLayer,
        options
      );
      projectileEffects.set(projEid, effects);
    }

    const towerSprite = Renderable.sprite[eid];
    if (towerSprite) towerSprite.recoilTimer = 0.1;

    onShoot?.(towerTypeName, eid);
  }
}

function applyConeDamage(world, towerEid, angle, spec, dt) {
  const enemies = query(world, [Position, Enemy, Health]);
  const tx = Position.x[towerEid];
  const ty = Position.y[towerEid];
  const range = Tower.range[towerEid] * (spec.coneRangeMult ?? 0.75);
  const halfAngle = ((spec.coneAngleDeg ?? 50) * Math.PI) / 180 / 2;
  const dps = Tower.damage[towerEid];

  for (const eid of enemies) {
    if (Health.current[eid] <= 0) continue;
    const dx = Position.x[eid] - tx;
    const dy = Position.y[eid] - ty;
    const d = Math.hypot(dx, dy);
    if (d > range) continue;
    const angleTo = Math.atan2(dy, dx);
    let diff = Math.abs(angleTo - angle);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff > halfAngle) continue;
    Health.current[eid] -= dps * dt;
  }
}
