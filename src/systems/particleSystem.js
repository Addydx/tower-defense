import * as PIXI from 'pixi.js';

const MAX_PARTICLES = 200;

/**
 * Sistema de partículas simple basado en PIXI.Graphics, sin librerías
 * externas. Limita el número de partículas activas para mantener el
 * rendimiento.
 */
export class ParticleSystem {
  constructor(layer) {
    this.layer = layer;
    this.particles = [];
  }

  get count() {
    return this.particles.length;
  }

  _spawn(x, y, { color = 0xffffff, radius = 3, life = 0.5, speed = 80, ring = false, gravity = 0 } = {}) {
    if (this.particles.length >= MAX_PARTICLES) return;

    const g = new PIXI.Graphics();
    if (ring) {
      g.lineStyle(3, color, 1);
      g.drawCircle(0, 0, radius);
    } else {
      g.beginFill(color);
      g.drawCircle(0, 0, radius);
      g.endFill();
    }
    g.x = x;
    g.y = y;
    this.layer.addChild(g);

    const angle = Math.random() * Math.PI * 2;
    const spd = ring ? 0 : speed * (0.4 + Math.random() * 0.6);

    this.particles.push({
      sprite: g,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life,
      maxLife: life,
      ring,
      gravity,
      baseRadius: radius,
    });
  }

  /** Explosión al morir un enemigo: partículas de su color. */
  deathBurst(x, y, color) {
    const count = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      this._spawn(x, y, { color, radius: 3 + Math.random() * 2, life: 0.5, speed: 110, gravity: 40 });
    }
  }

  /** Chispas al impactar un proyectil. */
  impactBurst(x, y) {
    const count = 3 + Math.floor(Math.random() * 3);
    const colors = [0xffffff, 0xffe082];
    for (let i = 0; i < count; i++) {
      const color = colors[i % colors.length];
      this._spawn(x, y, { color, radius: 2, life: 0.25, speed: 140 });
    }
  }

  /** Anillo dorado expandiéndose al mejorar una torre. */
  upgradeRing(x, y) {
    this._spawn(x, y, { color: 0xffd54f, radius: 8, life: 0.6, ring: true });
  }

  /** Copo de hielo cayendo alrededor de un enemigo ralentizado. */
  frostFall(x, y) {
    if (this.particles.length >= MAX_PARTICLES) return;
    const offsetX = (Math.random() - 0.5) * 30;
    this._spawn(x + offsetX, y - 10, { color: 0xbbdefb, radius: 2, life: 0.6, speed: 15, gravity: 25 });
  }

  /** Número de daño flotante (p. ej. veneno "-3"). */
  floatingText(x, y, text, color = 0x81c784) {
    if (this.particles.length >= MAX_PARTICLES) return;
    const t = new PIXI.Text(text, { fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', fill: color });
    t.anchor.set(0.5);
    t.x = x + (Math.random() - 0.5) * 10;
    t.y = y;
    this.layer.addChild(t);

    this.particles.push({
      sprite: t,
      vx: 0,
      vy: -35,
      life: 0.6,
      maxLife: 0.6,
      isText: true,
      gravity: 0,
    });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        p.sprite.parent?.removeChild(p.sprite);
        p.sprite.destroy();
        this.particles.splice(i, 1);
        continue;
      }

      const t = p.life / p.maxLife;

      if (p.ring) {
        const growth = 1 + (1 - t) * 4;
        p.sprite.scale.set(growth);
        p.sprite.alpha = t;
      } else {
        p.vy += p.gravity * dt;
        p.sprite.x += p.vx * dt;
        p.sprite.y += p.vy * dt;
        p.sprite.alpha = t;
      }
    }
  }

  clear() {
    for (const p of this.particles) {
      p.sprite.parent?.removeChild(p.sprite);
      p.sprite.destroy();
    }
    this.particles = [];
  }
}
