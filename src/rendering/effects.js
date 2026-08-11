// Helpers de PIXI.Graphics reutilizados por entities.js y game.js para
// sombras proyectadas y el resplandor ambiental de las torres (Fase 5).
// Puramente visual: no dependen de ningún dato de juego.

export function drawShadow(g, { rx = 20, ry = 7, yOffset = 20, alpha = 0.32 } = {}) {
  g.clear();
  g.beginFill(0x000000, alpha);
  g.drawEllipse(0, yOffset, rx, ry);
  g.endFill();
}

/** Resplandor cenital suave (varios anillos de baja opacidad), color según tipo, radio según nivel. */
export function drawGlow(g, color, radius) {
  g.clear();
  const rings = 3;
  for (let i = rings; i >= 1; i--) {
    const r = (radius / rings) * i;
    const alpha = 0.09 * (1 - (i - 1) / rings);
    g.beginFill(color, alpha);
    g.drawCircle(0, 0, r);
    g.endFill();
  }
}
