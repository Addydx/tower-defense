import { GRID_SIZE, TILE_TYPES } from '../constants.js';

function cellCenter(col, row) {
  return { x: col * GRID_SIZE + GRID_SIZE / 2, y: row * GRID_SIZE + GRID_SIZE / 2 };
}

/**
 * Recorre el camino desde START hasta END siguiendo celdas adyacentes de
 * tipo PATH/END, y devuelve la lista ordenada de waypoints en píxeles
 * (centros de cada tile del camino).
 */
export function buildWaypoints(mapData) {
  const { tiles, cols, rows } = mapData;

  let start = null;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (tiles[row][col] === TILE_TYPES.START) start = { col, row };
    }
  }
  if (!start) throw new Error('El mapa no tiene tile START (2)');

  const visited = new Set();
  const waypoints = [];
  let current = start;
  const dirs = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];

  while (current) {
    visited.add(`${current.col},${current.row}`);
    waypoints.push(cellCenter(current.col, current.row));

    if (tiles[current.row][current.col] === TILE_TYPES.END) break;

    let next = null;
    for (const [dc, dr] of dirs) {
      const nc = current.col + dc;
      const nr = current.row + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const key = `${nc},${nr}`;
      if (visited.has(key)) continue;
      const tile = tiles[nr][nc];
      if (tile === TILE_TYPES.PATH || tile === TILE_TYPES.END) {
        next = { col: nc, row: nr };
        break;
      }
    }
    current = next;
  }

  return waypoints;
}
