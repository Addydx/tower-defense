import { query, removeEntity } from 'bitecs';
import { Health, Enemy, Renderable } from '../components.js';

/**
 * Detecta enemigos con salud <= 0, otorga su recompensa, dispara los
 * callbacks de muerte (partículas/sonido/blink) y elimina la entidad.
 */
export function updateDeaths(world, { onDeath }) {
  const enemies = query(world, [Health, Enemy]);

  for (const eid of enemies) {
    if (Health.current[eid] > 0) continue;

    const sprite = Renderable.sprite[eid];
    const gold = Enemy.goldReward[eid];
    const x = sprite?.x ?? 0;
    const y = sprite?.y ?? 0;
    const color = sprite?.baseColor ?? 0xffffff;

    onDeath?.({ eid, sprite, gold, x, y, color });

    removeEntity(world, eid);
  }
}
