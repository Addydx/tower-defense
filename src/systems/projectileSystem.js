import { query, entityExists, hasComponent, addComponent, removeComponent, removeEntity } from 'bitecs';
import { Position, Projectile, Enemy, Health, Renderable, Slow, Poison, Regen } from '../components.js';
import { PROJECTILE_HIT_DISTANCE } from '../constants.js';
import { releaseProjectileGraphics } from '../entities.js';

/**
 * Mueve los proyectiles hacia su objetivo (actualizando el punto de
 * impacto si el enemigo sigue vivo) y resuelve el impacto: daño, splash,
 * ralentización, veneno y congelación según la configuración en
 * `projectileEffects`.
 */
export function updateProjectiles(world, dt, { projectileEffects, onImpact, onEnemyHit }) {
  const projectiles = query(world, [Position, Projectile]);

  for (const eid of projectiles) {
    const targetEid = Projectile.targetEid[eid];
    const targetAlive = targetEid >= 0 && entityExists(world, targetEid) && hasComponent(world, targetEid, Enemy);

    if (targetAlive) {
      Projectile.targetX[eid] = Position.x[targetEid];
      Projectile.targetY[eid] = Position.y[targetEid];
    }

    const tx = Projectile.targetX[eid];
    const ty = Projectile.targetY[eid];
    const dx = tx - Position.x[eid];
    const dy = ty - Position.y[eid];
    const dist = Math.hypot(dx, dy);
    const step = Projectile.speed[eid] * dt;

    if (dist <= Math.max(step, PROJECTILE_HIT_DISTANCE)) {
      resolveImpact(world, eid, targetAlive ? targetEid : -1, tx, ty, { projectileEffects, onImpact, onEnemyHit });
      destroyProjectile(world, eid);
      continue;
    }

    const ratio = step / dist;
    Position.x[eid] += dx * ratio;
    Position.y[eid] += dy * ratio;
  }
}

function resolveImpact(world, projEid, targetEid, x, y, { projectileEffects, onImpact, onEnemyHit }) {
  const effects = projectileEffects.get(projEid) ?? {};
  projectileEffects.delete(projEid);
  const damage = Projectile.damage[projEid];

  onImpact?.(x, y);

  if (targetEid >= 0) {
    applyDamage(world, targetEid, damage);
    onEnemyHit?.(targetEid);
    applyOnHitEffects(world, targetEid, effects);
  }

  if (effects.splashRadius) {
    const enemies = query(world, [Position, Enemy, Health]);
    for (const eid of enemies) {
      if (eid === targetEid) continue;
      const d = Math.hypot(Position.x[eid] - x, Position.y[eid] - y);
      if (d <= effects.splashRadius) {
        applyDamage(world, eid, damage);
        onEnemyHit?.(eid);
      }
    }
  }

  if (effects.aoeSlowRadius && effects.baseSlow) {
    const enemies = query(world, [Position, Enemy, Health]);
    for (const eid of enemies) {
      const d = Math.hypot(Position.x[eid] - x, Position.y[eid] - y);
      if (d <= effects.aoeSlowRadius) {
        applySlow(world, eid, effects.baseSlow.factor, effects.baseSlow.duration);
      }
    }
  }
}

function applyOnHitEffects(world, targetEid, effects) {
  if (effects.baseSlow && !effects.aoeSlowRadius) {
    applySlow(world, targetEid, effects.baseSlow.factor, effects.baseSlow.duration);
  }
  if (effects.freezeChance && Math.random() < effects.freezeChance) {
    applySlow(world, targetEid, 0, effects.freezeDuration);
  }
  if (effects.poison) {
    addComponent(world, targetEid, Poison);
    Poison.dps[targetEid] = effects.poison.dps;
    Poison.remaining[targetEid] = effects.poison.duration;
  }
}

function applySlow(world, eid, factor, duration) {
  if (!hasComponent(world, eid, Slow) || Slow.remaining[eid] < duration) {
    addComponent(world, eid, Slow);
    Slow.factor[eid] = factor;
    Slow.duration[eid] = duration;
    Slow.remaining[eid] = duration;
  }
}

function applyDamage(world, eid, amount) {
  Health.current[eid] -= amount;
}

function destroyProjectile(world, eid) {
  const sprite = Renderable.sprite[eid];
  if (sprite) releaseProjectileGraphics(sprite);
  removeEntity(world, eid);
}

/** Aplica el daño por segundo del veneno a todos los envenenados. */
export function updatePoison(world, dt) {
  const poisoned = query(world, [Poison, Health]);
  for (const eid of poisoned) {
    Health.current[eid] -= Poison.dps[eid] * dt;
    Poison.remaining[eid] -= dt;
    if (Poison.remaining[eid] <= 0) {
      removeComponent(world, eid, Poison);
    }
  }
}

/** Regeneración de vida por segundo (modificador del modo sin fin). */
export function updateRegen(world, dt) {
  const regenerating = query(world, [Regen, Health]);
  for (const eid of regenerating) {
    Health.current[eid] = Math.min(Health.max[eid], Health.current[eid] + Regen.hps[eid] * dt);
  }
}
