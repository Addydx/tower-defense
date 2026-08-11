import { TOWER_TYPES, TOWER_UPGRADE_COST, SPECIALIZATION_COST } from './constants.js';

// Multiplicadores acumulativos por nivel (se aplican en cadena: nivel 3
// incluye el bonus de nivel 2 más el suyo propio).
const LEVEL_MULTIPLIERS = {
  1: { damage: 1, range: 1 },
  2: { damage: 1.3, range: 1.1 },
  3: { damage: 1.5, range: 1.15 },
};

export const SPECIALIZATIONS = {
  ARROW: {
    1: {
      id: 1,
      name: 'Francotirador',
      icon: '🏹',
      cost: SPECIALIZATION_COST,
      damageMult: 1.8,
      rangeMult: 2.0,
      fireRateMult: 0.6,
    },
    2: {
      id: 2,
      name: 'Guardabosques',
      icon: '🌿',
      cost: SPECIALIZATION_COST,
      multishot: 3,
      shotDamageMult: 0.8,
      poison: { dps: 6, duration: 3 },
    },
  },
  CANNON: {
    1: {
      id: 1,
      name: 'Artillería',
      icon: '💥',
      cost: SPECIALIZATION_COST,
      damageMult: 2.5,
      fireRateMult: 0.5,
      splashRadius: 50,
    },
    2: {
      id: 2,
      name: 'Lanzallamas',
      icon: '🔥',
      cost: SPECIALIZATION_COST,
      flamethrower: true,
      coneAngleDeg: 50,
      coneRangeMult: 0.75,
    },
  },
  ICE: {
    1: {
      id: 1,
      name: 'Congelación',
      icon: '❄️',
      cost: SPECIALIZATION_COST,
      freezeChance: 0.3,
      freezeDuration: 2,
    },
    2: {
      id: 2,
      name: 'Ventisca',
      icon: '🌨️',
      cost: SPECIALIZATION_COST,
      aoeSlowRadius: 60,
    },
  },
};

export function getSpecialization(towerTypeName, specializationId) {
  if (!specializationId) return null;
  return SPECIALIZATIONS[towerTypeName]?.[specializationId] ?? null;
}

/**
 * Calcula las estadísticas efectivas de una torre según su tipo, nivel y
 * especialización elegida.
 */
export function computeTowerStats(towerTypeName, level, specializationId) {
  const base = TOWER_TYPES[towerTypeName];
  let damage = base.damage;
  let range = base.range;
  let fireRate = base.fireRate;

  for (let lvl = 2; lvl <= level; lvl++) {
    const mult = LEVEL_MULTIPLIERS[lvl];
    damage *= mult.damage;
    range *= mult.range;
  }

  const spec = getSpecialization(towerTypeName, specializationId);
  if (spec) {
    if (spec.damageMult) damage *= spec.damageMult;
    if (spec.rangeMult) range *= spec.rangeMult;
    if (spec.fireRateMult) fireRate *= spec.fireRateMult;
  }

  return { damage, range, fireRate };
}

export function getUpgradeCost(nextLevel) {
  return TOWER_UPGRADE_COST[nextLevel] ?? null;
}

export function getSellValue(towerTypeName, level) {
  const base = TOWER_TYPES[towerTypeName];
  let totalSpent = base.cost;
  for (let lvl = 2; lvl <= level; lvl++) {
    totalSpent += TOWER_UPGRADE_COST[lvl] ?? 0;
  }
  return Math.round(totalSpent * 0.5);
}
