import * as PIXI from 'pixi.js';

const MAX_PARTICLES = 500;
const POOL_PREWARM = 300;

/**
 * Sistema de partículas basado en PIXI.Graphics con object pooling (Fase 4):
 * los gráficos se reutilizan en vez de crearse/destruirse en cada disparo,
 * lo que evita presión de GC con cientos de partículas en pantalla. Un
 * "viento" compartido añade un desplazamiento lateral suave y compartido a
 * todas las partículas no ancladas (todas salvo los anillos de mejora).
 */
export class ParticleSystem {
  constructor(layer) {
    this.layer = layer;
    this.particles = [];
    this.pool = [];
    this.windPhase = Math.random() * Math.PI * 2;
    this.wind = 0;

    for (let i = 0; i < POOL_PREWARM; i++) this.pool.push(new PIXI.Graphics());
  }

  get count() {
    return this.particles.length;
  }

  _acquireGraphics() {
    return this.pool.pop() ?? new PIXI.Graphics();
  }

  _releaseGraphics(g) {
    g.clear();
    g.visible = false;
    g.rotation = 0;
    g.tint = 0xffffff;
    if (g.parent) g.parent.removeChild(g);
    if (this.pool.length < MAX_PARTICLES) this.pool.push(g);
    else g.destroy();
  }

  _spawn(x, y, { color = 0xffffff, radius = 3, life = 0.5, speed = 80, ring = false, gravity = 0, angle = null, spread = Math.PI * 2, windAffected = true, shape = 'circle' } = {}) {
    if (this.particles.length >= MAX_PARTICLES) return null;

    const g = this._acquireGraphics();
    g.visible = true;
    if (ring) {
      g.lineStyle(3, color, 1);
      g.drawCircle(0, 0, radius);
    } else if (shape === 'square') {
      g.beginFill(color);
      g.drawRect(-radius, -radius, radius * 2, radius * 2);
      g.endFill();
    } else {
      g.beginFill(color);
      g.drawCircle(0, 0, radius);
      g.endFill();
    }
    g.x = x;
    g.y = y;
    this.layer.addChild(g);

    const baseAngle = angle ?? Math.random() * Math.PI * 2;
    const a = baseAngle + (Math.random() - 0.5) * spread;
    const spd = ring ? 0 : speed * (0.4 + Math.random() * 0.6);

    const p = {
      sprite: g,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      life,
      maxLife: life,
      ring,
      gravity,
      baseRadius: radius,
      windAffected,
      isText: false,
    };
    this.particles.push(p);
    return p;
  }

  /** Explosión al morir un enemigo: partículas de su color + chispas de "gore" pixel art. */
  deathBurst(x, y, color) {
    const count = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      this._spawn(x, y, { color, radius: 3 + Math.random() * 2, life: 0.5, speed: 110, gravity: 40 });
    }
    const goreCount = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < goreCount; i++) {
      this._spawn(x, y, { color: 0x8a1010, radius: 1.5 + Math.random(), life: 0.4, speed: 90, gravity: 160 });
    }
  }

  /** Chispas metálicas al impactar un proyectil. */
  impactBurst(x, y) {
    const count = 3 + Math.floor(Math.random() * 3);
    const colors = [0xffffff, 0xffe082];
    for (let i = 0; i < count; i++) {
      const color = colors[i % colors.length];
      this._spawn(x, y, { color, radius: 2, life: 0.25, speed: 140 });
    }
  }

  /** Anillo dorado expandiéndose + estrellas orbitando al mejorar/especializar una torre. */
  upgradeRing(x, y) {
    this._spawn(x, y, { color: 0xffd54f, radius: 8, life: 0.6, ring: true, windAffected: false });
    for (let i = 0; i < 8; i++) {
      this._spawn(x, y, { color: 0xffd54f, radius: 1.6, life: 0.7, speed: 60, gravity: -30, shape: 'square', windAffected: false });
    }
  }

  /** Copo de hielo cayendo alrededor de un enemigo ralentizado. */
  frostFall(x, y) {
    const offsetX = (Math.random() - 0.5) * 30;
    this._spawn(x + offsetX, y - 10, { color: 0xbbdefb, radius: 2, life: 0.6, speed: 15, gravity: 25 });
  }

  /** Burbuja verde subiendo desde un enemigo envenenado. */
  poisonBubble(x, y) {
    const offsetX = (Math.random() - 0.5) * 20;
    this._spawn(x + offsetX, y, { color: 0x7bffb0, radius: 1.5 + Math.random(), life: 0.7, speed: 20, angle: -Math.PI / 2, spread: 0.6, gravity: -8 });
  }

  /** Cono de llamas de la torre Lanzallamas, disparado hacia `angle` (radianes). */
  flameCone(x, y, angle) {
    const count = 2 + Math.floor(Math.random() * 2);
    const colors = [0xffd54f, 0xe87830, 0xc43a1a];
    for (let i = 0; i < count; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      this._spawn(x, y, { color, radius: 3 + Math.random() * 2, life: 0.35, speed: 220, angle, spread: 0.9, gravity: -20 });
    }
  }

  /** Polvo marrón cayendo al terminar de construir una torre. */
  constructionDust(x, y) {
    for (let i = 0; i < 10; i++) {
      this._spawn(x, y - 20, { color: 0x8b5a2b, radius: 2 + Math.random() * 2, life: 0.5, speed: 90, gravity: 220 });
    }
  }

  /** Número de daño flotante (p. ej. veneno "-3"). No usa el pool de Graphics (es texto). */
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
      windAffected: false,
    });
  }

  update(dt) {
    this.windPhase += dt;
    this.wind = Math.sin(this.windPhase * 0.5) * 10 + Math.sin(this.windPhase * 1.7) * 4;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        if (p.isText) {
          p.sprite.parent?.removeChild(p.sprite);
          p.sprite.destroy();
        } else {
          this._releaseGraphics(p.sprite);
        }
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
        const windForce = p.windAffected ? this.wind : 0;
        p.sprite.x += (p.vx + windForce) * dt;
        p.sprite.y += p.vy * dt;
        if (!p.isText) p.sprite.rotation += dt * 2;
        p.sprite.alpha = t;
      }
    }
  }

  clear() {
    for (const p of this.particles) {
      if (p.isText) {
        p.sprite.parent?.removeChild(p.sprite);
        p.sprite.destroy();
      } else {
        this._releaseGraphics(p.sprite);
      }
    }
    this.particles = [];
  }
}
