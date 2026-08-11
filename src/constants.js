export const GRID_SIZE = 64;
export const MAP_COLS = 16;
export const MAP_ROWS = 12;
export const GAME_WIDTH = MAP_COLS * GRID_SIZE; // 1024
export const GAME_HEIGHT = MAP_ROWS * GRID_SIZE; // 768

export const TILE_TYPES = {
  PATH: 0,
  BUILDABLE: 1,
  START: 2,
  END: 3,
  DECORATION: 4,
};

export const TOWER_TYPES = {
  ARROW: {
    id: 'ARROW',
    name: 'Torre Arquera',
    cost: 50,
    range: 150,
    damage: 15,
    fireRate: 0.8,
    color: 0x4caf50,
    projectileColor: 0xa5d6a7,
  },
  CANNON: {
    id: 'CANNON',
    name: 'Torre Cañón',
    cost: 100,
    range: 120,
    damage: 40,
    fireRate: 2.0,
    color: 0xf44336,
    projectileColor: 0xffab91,
  },
  ICE: {
    id: 'ICE',
    name: 'Torre de Hielo',
    cost: 75,
    range: 130,
    damage: 8,
    fireRate: 1.0,
    color: 0x2196f3,
    projectileColor: 0xbbdefb,
    slowFactor: 0.5,
    slowDuration: 2,
  },
};

export const ENEMY_TYPES = {
  normal: { speed: 100, hp: 100, gold: 25, color: 0xd32f2f, radius: 20 },
  fast: { speed: 200, hp: 50, gold: 30, color: 0x9c27b0, radius: 16 },
  tank: { speed: 60, hp: 300, gold: 50, color: 0x757575, radius: 26 },
  boss: { speed: 55, hp: 500, gold: 150, color: 0x4a148c, radius: 34 },
  megaboss: { speed: 50, hp: 1000, gold: 300, color: 0xffb300, radius: 44 },
};

// Códigos numéricos usados dentro de los componentes bitECS (SoA).
export const ENEMY_TYPE_IDS = { normal: 0, fast: 1, tank: 2, boss: 3, megaboss: 4 };
export const ENEMY_TYPE_BY_ID = ['normal', 'fast', 'tank', 'boss', 'megaboss'];

export const TOWER_TYPE_IDS = { ARROW: 0, CANNON: 1, ICE: 2 };
export const TOWER_TYPE_BY_ID = ['ARROW', 'CANNON', 'ICE'];

export const COLORS = {
  BACKGROUND: 0x2d1b0e,
  PATH: 0xa87c4f,
  PATH_BORDER: 0x7a5738,
  BUILDABLE: 0x3a7d44,
  BUILDABLE_ALT: 0x35723e,
  START: 0x2e6ea6,
  END: 0xb33a3a,
  UI_PANEL: 0x1c120a,
  UI_PANEL_BORDER: 0xd4af37,
  GOLD: 0xffd54f,
  LIFE: 0xff5252,
  TEXT_LIGHT: 0xfff8e7,
  TEXT_SHADOW: 0x000000,
  RANGE_INDICATOR: 0xffffff,
};

export const STARTING_GOLD = 300;
export const STARTING_LIVES = 20;

export const PROJECTILE_SPEED = 400;
export const PROJECTILE_HIT_DISTANCE = 10;

export const TOWER_UPGRADE_COST = {
  2: 100,
  3: 200,
};

export const SPECIALIZATION_COST = 250;
