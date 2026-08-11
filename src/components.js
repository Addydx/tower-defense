// Componentes bitECS (API 0.4 "core"): cada componente es un objeto plano de
// arrays indexados por entity id (Structure of Arrays).

export const Position = { x: [], y: [] };
export const Velocity = { x: [], y: [] };
export const Health = { current: [], max: [] };

// enemyType: 0 = normal, 1 = fast, 2 = tank (ver ENEMY_TYPE_IDS en constants)
export const Enemy = {
  speed: [],
  goldReward: [],
  pathProgress: [],
  pathIndex: [],
  enemyType: [],
};

// towerType: 0 = ARROW, 1 = CANNON, 2 = ICE (ver TOWER_TYPE_IDS en constants)
// specialization: 0 = ninguna, 1 = primera rama, 2 = segunda rama
export const Tower = {
  range: [],
  damage: [],
  fireRate: [],
  lastFireTime: [],
  cost: [],
  level: [],
  towerType: [],
  specialization: [],
  gridX: [],
  gridY: [],
};

// targetEid: entidad enemiga perseguida (para que el proyectil siga
// impactando aunque el enemigo se haya movido desde el disparo).
export const Projectile = {
  speed: [],
  damage: [],
  targetX: [],
  targetY: [],
  fromX: [],
  fromY: [],
  targetEid: [],
  fromTowerType: [],
};

// sprite y container son referencias a objetos PIXI, no datos numéricos,
// por eso viven en arrays JS normales en lugar de arrays tipados.
export const Renderable = {
  sprite: [],
  width: [],
  height: [],
  tint: [],
  visible: [],
};

export const Slow = { factor: [], duration: [], remaining: [] };
export const Poison = { dps: [], remaining: [] };
export const Regen = { hps: [] };

export const Flying = {};
export const GroundOnly = {};
