import { query, hasComponent, removeComponent } from 'bitecs';
import { Position, Enemy, Slow } from '../components.js';

/**
 * Avanza a todos los enemigos por la lista de waypoints según su velocidad
 * (con dt para que el movimiento sea independiente del framerate).
 * @returns {number[]} ids de enemigos que llegaron al final del camino este frame.
 */
export function updateMovement(world, waypoints, dt) {
  const enemies = query(world, [Position, Enemy]);
  const escaped = [];

  // Distancia acumulada hasta cada waypoint, usada para un pathProgress
  // suave (0..1) que sirve de criterio de targeting ("más avanzado").
  const prefixLength = [0];
  for (let i = 1; i < waypoints.length; i++) {
    const dx = waypoints[i].x - waypoints[i - 1].x;
    const dy = waypoints[i].y - waypoints[i - 1].y;
    prefixLength.push(prefixLength[i - 1] + Math.hypot(dx, dy));
  }
  const totalLength = prefixLength[prefixLength.length - 1] || 1;

  for (const eid of enemies) {
    let speed = Enemy.speed[eid];

    if (hasComponent(world, eid, Slow)) {
      speed *= Slow.factor[eid];
      Slow.remaining[eid] -= dt;
      if (Slow.remaining[eid] <= 0) {
        removeComponent(world, eid, Slow);
      }
    }

    let remaining = speed * dt;
    let pathIndex = Enemy.pathIndex[eid];

    while (remaining > 0 && pathIndex < waypoints.length - 1) {
      const target = waypoints[pathIndex + 1];
      const dx = target.x - Position.x[eid];
      const dy = target.y - Position.y[eid];
      const dist = Math.hypot(dx, dy);

      if (dist <= remaining) {
        Position.x[eid] = target.x;
        Position.y[eid] = target.y;
        remaining -= dist;
        pathIndex += 1;
      } else {
        const ratio = dist === 0 ? 0 : remaining / dist;
        Position.x[eid] += dx * ratio;
        Position.y[eid] += dy * ratio;
        remaining = 0;
      }
    }

    Enemy.pathIndex[eid] = pathIndex;

    const distFromWaypoint = Math.hypot(
      Position.x[eid] - waypoints[pathIndex].x,
      Position.y[eid] - waypoints[pathIndex].y
    );
    Enemy.pathProgress[eid] = (prefixLength[pathIndex] + distFromWaypoint) / totalLength;

    if (pathIndex >= waypoints.length - 1) {
      escaped.push(eid);
    }
  }

  return escaped;
}
