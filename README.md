# 🗼 Tower Defense

**[▶ Jugar online](https://addydx.github.io/tower-defense/)**

Tower Defense pixel art en el navegador, hecho con **PixiJS 7** (render 2D) y **bitECS** (arquitectura Entity-Component-System). Todos los sprites, tiles, iconos y efectos se generan proceduralmente con Canvas 2D — no hay imágenes ni spritesheets externas.

## Requisitos

- Node.js 18+
- npm

## Instalación y ejecución

```bash
npm install
npm run dev       # servidor de desarrollo (Vite) con recarga en caliente
npm run build     # build de producción en dist/
npm run preview   # sirve el build de producción localmente
```

Abre la URL que imprime Vite (por defecto `http://localhost:5173`).

## Cómo se juega

- **Clic** sobre una casilla de césped construible para elegir qué torre construir (o teclas **1/2/3** con el panel de construcción abierto).
- **Clic** sobre una torre ya construida para mejorarla, especializarla o venderla.
- **Espacio** o el botón "INICIAR OLEADA" para lanzar la siguiente oleada de enemigos.
- Defiende el castillo: cada enemigo que llega al final del camino resta una vida. Si las vidas llegan a 0, pierdes.
- Al completar todas las oleadas puedes seguir en **modo sin fin** con oleadas generadas proceduralmente y cada vez más difíciles.
- La partida se autoguarda en `localStorage` entre oleadas.

### Torres

| Torre | Fuerte contra | Especializaciones (nivel 3) |
|---|---|---|
| 🏹 Arquera | Cadencia alta, daño moderado | Francotirador (rango/daño ↑↑) · Guardabosques (multidisparo + veneno) |
| 💣 Cañón | Daño alto, cadencia lenta | Artillería (daño en área) · Lanzallamas (cono de fuego continuo) |
| ❄️ Hielo | Ralentiza enemigos | Congelación (probabilidad de congelar) · Ventisca (ralentización en área) |

### Enemigos

Goblin (normal), lobo sombrío (rápido), gólem de piedra (tanque) y dragón esquelético (jefe/mega-jefe), cada uno con su propio sprite pixel art animado.

## Estructura del proyecto

```
src/
├── main.js                 # bootstrap: PIXI.Application, resize, game loop
├── game.js                 # estado de la partida, UI, oleadas, construcción
├── constants.js             # balance: tipos de torre/enemigo, colores, costos
├── components.js            # componentes bitECS (Position, Health, Tower...)
├── entities.js               # fábricas de entidades (enemigo/torre/proyectil)
├── towerStats.js            # cálculo de stats por nivel/especialización
├── sound.js                 # efectos de sonido y música (Web Audio)
├── data/
│   ├── map.json              # layout del mapa (camino, construible, inicio/fin)
│   └── waves.json            # composición de cada oleada
├── systems/                 # lógica ECS por frame (movimiento, combate, muerte...)
│   ├── pathSystem.js
│   ├── movementSystem.js
│   ├── combatSystem.js
│   ├── projectileSystem.js
│   ├── deathSystem.js
│   ├── renderSystem.js       # sincroniza sprites con el estado ECS + animaciones
│   └── particleSystem.js     # pool de partículas (impactos, muerte, clima...)
└── rendering/                # generación procedural de gráficos (Canvas2D → PIXI.Texture)
    ├── palette.js             # paleta de 16 colores + acentos
    ├── textures.js            # sprites de enemigos/torres/proyectiles/tiles/UI
    ├── mapRenderer.js         # fondo, tiles, decoraciones del mapa
    ├── uiRenderer.js          # paneles y botones pixel art
    └── effects.js             # sombras y resplandor ambiental
```

La separación es intencional: `systems/`, `entities.js`, `components.js`, `constants.js` y `towerStats.js` contienen la **lógica de juego** (ECS, balance, reglas); `rendering/` contiene únicamente **generación visual** procedural, sin conocer reglas de daño ni economía.

## Stack técnico

- [PixiJS 7](https://pixijs.com/) — renderer 2D (WebGL)
- [bitECS](https://github.com/NateTheGreatt/bitECS) — ECS basado en Structure-of-Arrays
- [Vite](https://vitejs.dev/) — dev server y bundler

## Licencia

ISC
