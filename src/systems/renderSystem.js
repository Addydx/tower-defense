import { query, hasComponent } from 'bitecs';
import { Position, Enemy, Health, Tower, Projectile, Renderable, Slow, Poison } from '../components.js';

const SLOW_TINT = 0x64b5f6;
const POISON_TINT = 0x81c784;
const FROZEN_TINT = 0xe1f5fe;

/** Sincroniza los sprites de enemigos: posición, bob, barra de vida y tinte de estado. */
function renderEnemies(world, elapsedTime) {
  const enemies = query(world, [Position, Enemy, Health, Renderable]);
  for (const eid of enemies) {
    const sprite = Renderable.sprite[eid];
    if (!sprite) continue;

    if (sprite.bobPhase === undefined) sprite.bobPhase = Math.random() * Math.PI * 2;
    sprite.x = Position.x[eid];
    sprite.y = Position.y[eid] + Math.sin(elapsedTime * 9 + sprite.bobPhase) * 2.5;

    const pct = Math.max(0, Health.current[eid] / Health.max[eid]);
    sprite.healthBarFill.scale.x = pct;
    sprite.healthBarFill.tint = pct > 0.5 ? 0x4caf50 : pct > 0.25 ? 0xffb300 : 0xf44336;

    const frozen = hasComponent(world, eid, Slow) && Slow.factor[eid] === 0;
    const slowed = hasComponent(world, eid, Slow) && Slow.factor[eid] > 0;
    const poisoned = hasComponent(world, eid, Poison);

    if (frozen) sprite.body.tint = FROZEN_TINT;
    else if (poisoned && slowed) sprite.body.tint = 0x9ccc65;
    else if (slowed) sprite.body.tint = SLOW_TINT;
    else if (poisoned) sprite.body.tint = POISON_TINT;
    else sprite.body.tint = sprite.baseColor;
  }
}

/** Animación idle (oscilación senoidal) y retroceso al disparar de las torres. */
function renderTowers(world, dt, elapsedTime) {
  const towers = query(world, [Position, Tower, Renderable]);
  for (const eid of towers) {
    const sprite = Renderable.sprite[eid];
    if (!sprite) continue;

    const bob = Math.sin(elapsedTime * 2 + sprite.idlePhase) * 2;
    sprite.turret.y = bob;
    sprite.barrel.y = -26 + bob;

    if (sprite.recoilTimer > 0) {
      sprite.recoilTimer -= dt;
      sprite.turret.scale.y = 0.9;
      sprite.barrel.scale.y = 0.9;
    } else {
      sprite.turret.scale.y = 1;
      sprite.barrel.scale.y = 1;
    }
  }
}

/** Orienta cada proyectil hacia su dirección de movimiento. */
function renderProjectiles(world) {
  const projectiles = query(world, [Position, Projectile, Renderable]);
  for (const eid of projectiles) {
    const sprite = Renderable.sprite[eid];
    if (!sprite) continue;
    sprite.x = Position.x[eid];
    sprite.y = Position.y[eid];
    const dx = Projectile.targetX[eid] - Position.x[eid];
    const dy = Projectile.targetY[eid] - Position.y[eid];
    if (dx !== 0 || dy !== 0) sprite.rotation = Math.atan2(dy, dx);
  }
}

export function updateRender(world, dt, elapsedTime) {
  renderEnemies(world, elapsedTime);
  renderTowers(world, dt, elapsedTime);
  renderProjectiles(world);
}
