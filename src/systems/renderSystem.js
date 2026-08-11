import { query, hasComponent } from 'bitecs';
import { Position, Enemy, Health, Tower, Projectile, Renderable, Slow, Poison } from '../components.js';

// Tintes suaves (no tapan el detalle del pixel art, solo insinúan el estado).
const SLOW_TINT = 0xaee0ff;
const POISON_TINT = 0xc8f0b0;
const POISON_SLOW_TINT = 0xbfe0a0;
const FROZEN_TINT = 0xcfefff;
const NORMAL_TINT = 0xffffff;
const HIT_FLASH_TINT = 0xffffff;
const HIT_FLASH_DURATION = 0.1;
const BUILD_ANIM_DURATION = 0.45;

/** Sincroniza los sprites de enemigos: posición, bob, ciclo de caminata, barra de vida y estado. */
function renderEnemies(world, dt, elapsedTime) {
  const enemies = query(world, [Position, Enemy, Health, Renderable]);
  for (const eid of enemies) {
    const sprite = Renderable.sprite[eid];
    if (!sprite) continue;

    if (sprite.bobPhase === undefined) sprite.bobPhase = Math.random() * Math.PI * 2;
    if (sprite.lastHealth === undefined) sprite.lastHealth = Health.current[eid];
    if (sprite.flashTimer === undefined) sprite.flashTimer = 0;

    sprite.x = Position.x[eid];
    sprite.y = Position.y[eid] + Math.sin(elapsedTime * 9 + sprite.bobPhase) * 2.5;

    const pct = Math.max(0, Health.current[eid] / Health.max[eid]);
    sprite.healthBarFill.scale.x = pct;
    sprite.healthBarFill.tint = pct > 0.5 ? 0x4caf50 : pct > 0.25 ? 0xffb300 : 0xf44336;

    const frozen = hasComponent(world, eid, Slow) && Slow.factor[eid] === 0;
    const slowed = hasComponent(world, eid, Slow) && Slow.factor[eid] > 0;
    const poisoned = hasComponent(world, eid, Poison);

    // Ciclo de caminata (3 frames); se congela visualmente si está frozen.
    if (sprite.walkFrames && !frozen) {
      const cadence = slowed ? 3 : 8;
      const frameIdx = Math.floor(elapsedTime * cadence + sprite.bobPhase * 2) % 3;
      const tex = sprite.walkFrames[frameIdx];
      if (sprite.body.texture !== tex) sprite.body.texture = tex;
    }

    if (sprite.frost) sprite.frost.visible = frozen;

    // Flash blanco al recibir daño (detectado por caída de HP entre frames).
    if (Health.current[eid] < sprite.lastHealth - 0.001) sprite.flashTimer = HIT_FLASH_DURATION;
    sprite.lastHealth = Health.current[eid];

    if (sprite.flashTimer > 0) {
      sprite.flashTimer -= dt;
      sprite.body.tint = HIT_FLASH_TINT;
    } else if (frozen) {
      sprite.body.tint = FROZEN_TINT;
    } else if (poisoned && slowed) {
      sprite.body.tint = POISON_SLOW_TINT;
    } else if (slowed) {
      sprite.body.tint = SLOW_TINT;
    } else if (poisoned) {
      sprite.body.tint = POISON_TINT;
    } else {
      sprite.body.tint = NORMAL_TINT;
    }
  }
}

/** Animación de construcción, respiración idle y retroceso al disparar de las torres. */
function renderTowers(world, dt, elapsedTime) {
  const towers = query(world, [Position, Tower, Renderable]);
  for (const eid of towers) {
    const sprite = Renderable.sprite[eid];
    if (!sprite) continue;

    if (sprite.buildTimer > 0) {
      sprite.buildTimer -= dt;
      const t = Math.max(0, sprite.buildTimer / BUILD_ANIM_DURATION);
      sprite.scale.set(0.3 + (1 - t) * 0.7);
      sprite.alpha = 1 - t;
      sprite.y = Position.y[eid] - t * 40;
      if (sprite.buildTimer <= 0) {
        sprite.scale.set(1);
        sprite.alpha = 1;
        sprite.y = Position.y[eid];
      }
      continue;
    }

    const breathe = 1 + Math.sin(elapsedTime * 2 + sprite.idlePhase) * 0.02;
    const lvlScale = (sprite.levelScale ?? 1) * breathe;
    sprite.base.scale.set(lvlScale);

    const turretY = sprite.turretOffsetY ?? -30;
    const bob = Math.sin(elapsedTime * 2 + sprite.idlePhase) * 2;
    sprite.turret.y = turretY + bob;
    sprite.barrel.y = turretY + bob;

    if (sprite.spinTurret) sprite.turret.rotation += dt * 1.2;

    const turretScale = sprite.levelScale ?? 1;
    if (sprite.recoilTimer > 0) {
      sprite.recoilTimer -= dt;
      sprite.turret.scale.set(turretScale, turretScale * 0.85);
      sprite.barrel.scale.set(1, 0.85);
    } else {
      sprite.turret.scale.set(turretScale, turretScale);
      sprite.barrel.scale.set(1, 1);
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
  renderEnemies(world, dt, elapsedTime);
  renderTowers(world, dt, elapsedTime);
  renderProjectiles(world);
}
