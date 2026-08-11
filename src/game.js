import * as PIXI from 'pixi.js';
import { createWorld, removeEntity, query, entityExists, hasComponent } from 'bitecs';

import {
  GRID_SIZE,
  MAP_COLS,
  MAP_ROWS,
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_TYPES,
  TOWER_TYPES,
  TOWER_TYPE_BY_ID,
  COLORS,
  STARTING_GOLD,
  STARTING_LIVES,
} from './constants.js';

import { Position, Enemy, Tower, Renderable, Slow, Poison } from './components.js';

import mapData from './data/map.json';
import wavesData from './data/waves.json';

import { buildWaypoints } from './systems/pathSystem.js';
import { updateMovement } from './systems/movementSystem.js';
import { updateTowers } from './systems/combatSystem.js';
import { updateProjectiles, updatePoison, updateRegen } from './systems/projectileSystem.js';
import { updateDeaths } from './systems/deathSystem.js';
import { updateRender } from './systems/renderSystem.js';
import { ParticleSystem } from './systems/particleSystem.js';
import { createEnemy, createTower } from './entities.js';
import { computeTowerStats, getUpgradeCost, getSellValue, SPECIALIZATIONS, getSpecialization } from './towerStats.js';
import { SoundManager } from './sound.js';

const SAVE_KEY = 'td_save_v1';
const HIGHSCORE_KEY = 'td_highscore_v1';

const FONT = '"Trebuchet MS", Georgia, sans-serif';

export class Game {
  constructor(app) {
    this.app = app;
    this.sound = new SoundManager();
    this.state = 'boot'; // boot | menu | playing | victory | defeat
  }

  init() {
    this.world = createWorld();
    this.waypoints = buildWaypoints(mapData);
    this.towerGrid = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(null));
    this.projectileEffects = new Map();

    this.gold = STARTING_GOLD;
    this.lives = STARTING_LIVES;
    this.currentWave = 0; // índice 0-based, oleada mostrada = currentWave + 1
    this.killCount = 0;
    this.elapsedTime = 0;
    this.waveActive = false;
    this.spawnQueue = [];
    this.endless = false;
    this.endlessWave = 0;
    this.cleanupTimer = 0;

    this.selectedTowerEid = null;

    this._buildLayers();
    this._drawMap();
    this.particles = new ParticleSystem(this.particleLayer);
    this._setupUI();
    this._setupInput();
    this._buildMenus();

    this.state = 'menu';
    this._showMainMenu();
  }

  // ─────────────────────────────────────────── Setup ───────────────────────────────────────────

  _buildLayers() {
    this.mapLayer = new PIXI.Container();
    this.towerLayer = new PIXI.Container();
    this.enemyLayer = new PIXI.Container();
    this.projectileLayer = new PIXI.Container();
    this.particleLayer = new PIXI.Container();
    this.uiLayer = new PIXI.Container();
    this.popupLayer = new PIXI.Container();
    this.overlayLayer = new PIXI.Container();
    this.menuLayer = new PIXI.Container();

    this.app.stage.addChild(
      this.mapLayer,
      this.towerLayer,
      this.enemyLayer,
      this.projectileLayer,
      this.particleLayer,
      this.uiLayer,
      this.popupLayer,
      this.overlayLayer,
      this.menuLayer
    );
  }

  _drawMap() {
    const { tiles, cols, rows } = mapData;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const type = tiles[row][col];
        const x = col * GRID_SIZE;
        const y = row * GRID_SIZE;

        const g = new PIXI.Graphics();
        let fill = COLORS.BUILDABLE;
        if (type === TILE_TYPES.PATH) fill = COLORS.PATH;
        else if (type === TILE_TYPES.START) fill = COLORS.START;
        else if (type === TILE_TYPES.END) fill = COLORS.END;
        else if ((row + col) % 2 === 0) fill = COLORS.BUILDABLE_ALT;

        g.beginFill(fill);
        g.drawRect(0, 0, GRID_SIZE, GRID_SIZE);
        g.endFill();
        g.lineStyle(1, 0x000000, 0.15);
        g.drawRect(0, 0, GRID_SIZE, GRID_SIZE);
        g.x = x;
        g.y = y;
        this.mapLayer.addChild(g);

        if (type === TILE_TYPES.BUILDABLE) {
          g.eventMode = 'static';
          g.cursor = 'pointer';
          g.on('pointerdown', () => this._onTileClick(col, row));
          g.on('pointerover', () => {
            if (this._isBuildable(col, row)) g.alpha = 0.75;
          });
          g.on('pointerout', () => {
            g.alpha = 1;
          });
        }
      }
    }
  }

  _setupUI() {
    const shadow = { dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 2, dropShadowAlpha: 0.8 };

    this.goldText = new PIXI.Text('🪙 Oro: 300', {
      fontFamily: FONT,
      fontSize: 22,
      fontWeight: 'bold',
      fill: COLORS.GOLD,
      ...shadow,
    });
    this.goldText.x = 16;
    this.goldText.y = 12;
    this.uiLayer.addChild(this.goldText);

    this.livesText = new PIXI.Text('❤️ Vidas: 20', {
      fontFamily: FONT,
      fontSize: 22,
      fontWeight: 'bold',
      fill: COLORS.LIFE,
      ...shadow,
    });
    this.livesText.anchor.set(1, 0);
    this.livesText.x = GAME_WIDTH - 16;
    this.livesText.y = 12;
    this.uiLayer.addChild(this.livesText);

    this.waveText = new PIXI.Text('Oleada 0 / 10', {
      fontFamily: FONT,
      fontSize: 18,
      fill: COLORS.TEXT_LIGHT,
      ...shadow,
    });
    this.waveText.anchor.set(0.5, 0);
    this.waveText.x = GAME_WIDTH / 2;
    this.waveText.y = 14;
    this.uiLayer.addChild(this.waveText);

    this.waveButton = this._makeButton('⚔️ INICIAR OLEADA 1', 260, 52, () => this._startWave(), {
      fill: 0x8d1f1f,
      hoverFill: 0xb33a3a,
    });
    this.waveButton.x = GAME_WIDTH / 2 - 130;
    this.waveButton.y = GAME_HEIGHT - 76;
    this.uiLayer.addChild(this.waveButton);

    this.muteButton = this._makeButton('🔊', 44, 44, () => this._toggleMute(), { fill: 0x3e2723, hoverFill: 0x5d4037 });
    this.muteButton.x = GAME_WIDTH - 60;
    this.muteButton.y = GAME_HEIGHT - 60;
    this.uiLayer.addChild(this.muteButton);

    this.waveBanner = new PIXI.Text('', {
      fontFamily: FONT,
      fontSize: 64,
      fontWeight: 'bold',
      fill: COLORS.GOLD,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowDistance: 4,
      dropShadowAlpha: 0.9,
    });
    this.waveBanner.anchor.set(0.5);
    this.waveBanner.x = GAME_WIDTH / 2;
    this.waveBanner.y = GAME_HEIGHT / 2;
    this.waveBanner.alpha = 0;
    this.waveBanner.scale.set(0);
    this.overlayLayer.addChild(this.waveBanner);
    this._bannerTimer = 0;
    this._bannerPhase = null;
  }

  _setupInput() {
    window.addEventListener('keydown', (e) => {
      this.sound.unlock();
      if (e.code === 'Space' && this.state === 'playing' && !this.waveActive) {
        e.preventDefault();
        this._startWave();
      }
      if (['Digit1', 'Digit2', 'Digit3'].includes(e.code) && this._buildMenuOpen) {
        const idx = Number(e.code.slice(-1)) - 1;
        const types = ['ARROW', 'CANNON', 'ICE'];
        this._tryBuild(types[idx]);
      }
    });

    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = new PIXI.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.app.stage.on('pointerdown', () => this.sound.unlock());
  }

  // ─────────────────────────────────────────── Menús (PixiJS) ───────────────────────────────────────────

  _makeButton(label, width, height, onClick, opts = {}) {
    const container = new PIXI.Container();
    const fillColor = opts.fill ?? 0x2e6ea6;
    const hoverColor = opts.hoverFill ?? 0x3f8ed6;
    const disabledColor = 0x4a4a4a;

    const bg = new PIXI.Graphics();
    const draw = (color) => {
      bg.clear();
      bg.beginFill(color);
      bg.drawRoundedRect(0, 0, width, height, 10);
      bg.endFill();
      bg.lineStyle(2, COLORS.UI_PANEL_BORDER, 0.8);
      bg.drawRoundedRect(0, 0, width, height, 10);
    };
    draw(fillColor);
    container.addChild(bg);

    const text = new PIXI.Text(label, {
      fontFamily: FONT,
      fontSize: Math.min(18, height * 0.4),
      fontWeight: 'bold',
      fill: COLORS.TEXT_LIGHT,
      align: 'center',
    });
    text.anchor.set(0.5);
    text.x = width / 2;
    text.y = height / 2;
    container.addChild(text);

    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.hitArea = new PIXI.Rectangle(0, 0, width, height);

    container.setEnabled = (enabled) => {
      container.eventMode = enabled ? 'static' : 'none';
      container.cursor = enabled ? 'pointer' : 'default';
      draw(enabled ? fillColor : disabledColor);
      container.alpha = enabled ? 1 : 0.55;
    };

    container.on('pointerover', () => {
      if (container.eventMode === 'static') draw(hoverColor);
    });
    container.on('pointerout', () => {
      if (container.eventMode === 'static') draw(fillColor);
    });
    container.on('pointerdown', (e) => {
      e.stopPropagation();
      this.sound.unlock();
      this.sound.playClick();
      onClick();
    });

    return container;
  }

  _makePanel(width, height) {
    const panel = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.UI_PANEL, 0.96);
    bg.drawRoundedRect(0, 0, width, height, 12);
    bg.endFill();
    bg.lineStyle(3, COLORS.UI_PANEL_BORDER, 1);
    bg.drawRoundedRect(0, 0, width, height, 12);
    panel.addChild(bg);
    panel.hitArea = new PIXI.Rectangle(0, 0, width, height);
    panel.eventMode = 'static';
    panel.on('pointerdown', (e) => e.stopPropagation());
    return panel;
  }

  _buildMenus() {
    this._buildMainMenuUI();
    this._buildEndScreenUI();
  }

  _buildMainMenuUI() {
    const bg = new PIXI.Graphics();
    bg.beginFill(0x120b06, 0.96);
    bg.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.endFill();
    bg.eventMode = 'static';
    this.mainMenuContainer = new PIXI.Container();
    this.mainMenuContainer.addChild(bg);

    const title = new PIXI.Text('🗼 TOWER DEFENSE', {
      fontFamily: FONT,
      fontSize: 64,
      fontWeight: 'bold',
      fill: COLORS.GOLD,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowDistance: 5,
      dropShadowBlur: 4,
      dropShadowAlpha: 0.85,
    });
    title.anchor.set(0.5);
    title.x = GAME_WIDTH / 2;
    title.y = 160;
    this.mainMenuContainer.addChild(title);

    this.menuButtonsGroup = new PIXI.Container();
    this.menuButtonsGroup.x = GAME_WIDTH / 2 - 130;
    this.menuButtonsGroup.y = 280;
    this.mainMenuContainer.addChild(this.menuButtonsGroup);

    const controlsText = new PIXI.Text(
      'Clic: construir / mejorar torres   ·   Teclas 1-2-3: elegir torre   ·   Espacio: iniciar oleada',
      { fontFamily: FONT, fontSize: 15, fill: 0xd7c9a8, align: 'center', wordWrap: true, wordWrapWidth: 700 }
    );
    controlsText.anchor.set(0.5);
    controlsText.x = GAME_WIDTH / 2;
    controlsText.y = GAME_HEIGHT - 70;
    controlsText.visible = false;
    this.controlsText = controlsText;
    this.mainMenuContainer.addChild(controlsText);

    const version = new PIXI.Text('v1.0.0', { fontFamily: FONT, fontSize: 13, fill: 0x8d7a5c });
    version.anchor.set(0.5);
    version.x = GAME_WIDTH / 2;
    version.y = GAME_HEIGHT - 24;
    this.mainMenuContainer.addChild(version);

    const highScore = Number(localStorage.getItem(HIGHSCORE_KEY) ?? 0);
    const hsText = new PIXI.Text(`Mejor puntuación: ${highScore}`, {
      fontFamily: FONT,
      fontSize: 16,
      fill: COLORS.TEXT_LIGHT,
    });
    hsText.anchor.set(0.5);
    hsText.x = GAME_WIDTH / 2;
    hsText.y = 230;
    this.mainMenuContainer.addChild(hsText);
    this._highScoreText = hsText;

    this.menuLayer.addChild(this.mainMenuContainer);
  }

  _refreshMainMenuButtons() {
    this.menuButtonsGroup.removeChildren();
    const saved = this._readSave();

    let y = 0;
    const addBtn = (label, onClick, colors) => {
      const btn = this._makeButton(label, 260, 52, onClick, colors);
      btn.y = y;
      this.menuButtonsGroup.addChild(btn);
      y += 64;
    };

    if (saved) {
      addBtn(`▶ CONTINUAR (Oleada ${saved.currentWave + 1})`, () => this._continueGame(saved), {
        fill: 0x2e6ea6,
        hoverFill: 0x3f8ed6,
      });
      addBtn('🆕 NUEVA PARTIDA', () => this._confirmNewGame(), { fill: 0x4caf50, hoverFill: 0x66bb6a });
    } else {
      addBtn('▶ JUGAR', () => this._startNewGame(), { fill: 0x4caf50, hoverFill: 0x66bb6a });
    }

    addBtn('❔ CONTROLES', () => {
      this.controlsText.visible = !this.controlsText.visible;
    }, { fill: 0x5d4037, hoverFill: 0x795548 });

    const highScore = Number(localStorage.getItem(HIGHSCORE_KEY) ?? 0);
    this._highScoreText.text = `Mejor puntuación: ${highScore}`;
  }

  _showMainMenu() {
    this.state = 'menu';
    this._refreshMainMenuButtons();
    this.mainMenuContainer.visible = true;
    this.endScreenContainer.visible = false;
    this.waveButton.visible = false;
  }

  _confirmNewGame() {
    this._clearSave();
    this._startNewGame();
  }

  _buildEndScreenUI() {
    const bg = new PIXI.Graphics();
    bg.beginFill(0x120b06, 0.96);
    bg.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.endFill();
    bg.eventMode = 'static';
    this.endScreenContainer = new PIXI.Container();
    this.endScreenContainer.addChild(bg);
    this.endScreenContainer.visible = false;

    this.endTitle = new PIXI.Text('', {
      fontFamily: FONT,
      fontSize: 56,
      fontWeight: 'bold',
      fill: COLORS.GOLD,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowDistance: 4,
      dropShadowAlpha: 0.85,
    });
    this.endTitle.anchor.set(0.5);
    this.endTitle.x = GAME_WIDTH / 2;
    this.endTitle.y = 160;
    this.endScreenContainer.addChild(this.endTitle);

    this.endStats = new PIXI.Text('', {
      fontFamily: FONT,
      fontSize: 20,
      fill: COLORS.TEXT_LIGHT,
      align: 'center',
      lineHeight: 30,
    });
    this.endStats.anchor.set(0.5);
    this.endStats.x = GAME_WIDTH / 2;
    this.endStats.y = 280;
    this.endScreenContainer.addChild(this.endStats);

    this.endButtonsGroup = new PIXI.Container();
    this.endButtonsGroup.x = GAME_WIDTH / 2 - 130;
    this.endButtonsGroup.y = 400;
    this.endScreenContainer.addChild(this.endButtonsGroup);

    this.menuLayer.addChild(this.endScreenContainer);
  }

  _showEndScreen({ won }) {
    this.state = won ? 'victory' : 'defeat';
    this.waveButton.visible = false;
    this._closeBuildMenu();
    this._closeUpgradePanel();
    this.sound.stopMusic();

    const score = this.killCount * 10 + this.lives * 50 + this.gold * 2;
    const highScore = Number(localStorage.getItem(HIGHSCORE_KEY) ?? 0);
    if (score > highScore) localStorage.setItem(HIGHSCORE_KEY, String(score));

    this.endTitle.text = won ? '¡VICTORIA!' : 'DERROTA';
    this.endTitle.style.fill = won ? COLORS.GOLD : COLORS.LIFE;
    this.endStats.text =
      `Oleadas completadas: ${this.currentWave}${this.endless ? ` (+${this.endlessWave} sin fin)` : ''}\n` +
      `Enemigos eliminados: ${this.killCount}\n` +
      `Vidas restantes: ${this.lives}   Oro restante: ${this.gold}\n` +
      `Puntuación: ${score}`;

    this.endButtonsGroup.removeChildren();
    if (won) {
      const endless = this._makeButton('♾️ MODO SIN FIN', 260, 52, () => this._continueEndless(), {
        fill: 0x6a1b9a,
        hoverFill: 0x8e24aa,
      });
      this.endButtonsGroup.addChild(endless);
      const retry = this._makeButton('MENÚ PRINCIPAL', 260, 52, () => this._backToMenu(), {
        fill: 0x5d4037,
        hoverFill: 0x795548,
      });
      retry.y = 64;
      this.endButtonsGroup.addChild(retry);
    } else {
      const retry = this._makeButton('🔄 REINTENTAR', 260, 52, () => this._confirmNewGame(), {
        fill: 0x8d1f1f,
        hoverFill: 0xb33a3a,
      });
      this.endButtonsGroup.addChild(retry);
    }

    won ? this.sound.playVictory() : this.sound.playDefeat();
    this._clearSave();
    this.endScreenContainer.visible = true;
  }

  _backToMenu() {
    this.endScreenContainer.visible = false;
    this._showMainMenu();
  }

  _continueEndless() {
    this.endScreenContainer.visible = false;
    this.endless = true;
    this.state = 'playing';
    this.waveButton.visible = true;
    this._refreshWaveButtonLabel();
    this.sound.startMusic();
  }

  // ─────────────────────────────────────────── Ciclo de partida ───────────────────────────────────────────

  _startNewGame() {
    this._resetGameState();
    this.state = 'playing';
    this.mainMenuContainer.visible = false;
    this.waveButton.visible = true;
    this._updateHUD();
    this.sound.startMusic();
  }

  _continueGame(saved) {
    this._resetGameState();
    this.gold = saved.gold;
    this.lives = saved.lives;
    this.currentWave = saved.currentWave;
    this.killCount = saved.killCount ?? 0;
    this.endless = saved.endless ?? false;
    this.endlessWave = saved.endlessWave ?? 0;

    for (const t of saved.towers) {
      const eid = createTower(this.world, t.gridX, t.gridY, t.towerType, this.towerLayer);
      this.towerGrid[t.gridY][t.gridX] = eid;
      Tower.level[eid] = t.level;
      Tower.specialization[eid] = t.specialization;
      this._applyTowerStats(eid);
      this._attachTowerInteraction(eid);
      this._applyTowerVisualLevel(eid);
    }

    this.state = 'playing';
    this.mainMenuContainer.visible = false;
    this.waveButton.visible = true;
    this._updateHUD();
    this._refreshWaveButtonLabel();
    this.sound.startMusic();
  }

  _resetGameState() {
    // Limpia entidades y sprites de una partida anterior (si la hubiera).
    for (const eid of query(this.world, [Renderable])) {
      Renderable.sprite[eid]?.parent?.removeChild(Renderable.sprite[eid]);
      Renderable.sprite[eid]?.destroy?.();
      removeEntity(this.world, eid);
    }
    this.particles.clear();
    this.towerGrid = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(null));
    this.projectileEffects.clear();

    this.gold = STARTING_GOLD;
    this.lives = STARTING_LIVES;
    this.currentWave = 0;
    this.killCount = 0;
    this.waveActive = false;
    this.spawnQueue = [];
    this.endless = false;
    this.endlessWave = 0;
    this._closeBuildMenu();
    this._closeUpgradePanel();
  }

  update(delta) {
    this.particles.update(delta);

    if (this.state !== 'playing') return;

    this.elapsedTime += delta;
    this._updateSpawning(delta);

    const escaped = updateMovement(this.world, this.waypoints, delta);
    for (const eid of escaped) this._onEnemyEscaped(eid);

    updateTowers(this.world, {
      dt: delta,
      time: this.elapsedTime,
      projectileLayer: this.projectileLayer,
      projectileEffects: this.projectileEffects,
      onShoot: (towerTypeName) => this.sound.playShoot(towerTypeName),
    });

    updateProjectiles(this.world, delta, {
      projectileEffects: this.projectileEffects,
      onImpact: (x, y) => {
        this.particles.impactBurst(x, y);
        this.sound.playImpact();
      },
      onEnemyHit: () => {},
    });

    updatePoison(this.world, delta);
    updateRegen(this.world, delta);
    this._updateStatusEffectVisuals();

    updateDeaths(this.world, { onDeath: (info) => this._onEnemyDeath(info) });

    updateRender(this.world, delta, this.elapsedTime);

    this.sound.setMusicIntensity(query(this.world, [Enemy]).length);

    this._updateBanner(delta);
    this._checkWaveCompletion();

    this.cleanupTimer += delta;
    if (this.cleanupTimer >= 5) {
      this.cleanupTimer = 0;
      this._sweepStaleEffects();
    }
  }

  /** Partículas de hielo cayendo sobre enemigos ralentizados y números de daño del veneno. */
  _updateStatusEffectVisuals() {
    for (const eid of query(this.world, [Position, Slow])) {
      if (Slow.factor[eid] === 0) continue; // congelado: sin partículas de caída
      if (Math.random() < 0.25) this.particles.frostFall(Position.x[eid], Position.y[eid]);
    }

    for (const eid of query(this.world, [Position, Poison])) {
      if (Math.random() < 0.06) {
        const amount = Math.max(1, Math.round(Poison.dps[eid] * 0.5));
        this.particles.floatingText(Position.x[eid], Position.y[eid] - 20, `-${amount}`, 0x81c784);
      }
    }
  }

  _sweepStaleEffects() {
    // Limpieza periódica defensiva: descarta configuraciones de efectos de
    // proyectiles cuya entidad ya no existe (debería ser raro, ya que
    // projectileSystem las borra al resolver el impacto).
    for (const eid of this.projectileEffects.keys()) {
      if (!entityExists(this.world, eid)) this.projectileEffects.delete(eid);
    }
  }

  // ─────────────────────────────────────────── Oleadas ───────────────────────────────────────────

  _getWaveEntries(waveNumber) {
    if (waveNumber <= wavesData.waves.length) {
      return wavesData.waves[waveNumber - 1].enemies;
    }
    return this._generateEndlessWave(waveNumber - wavesData.waves.length);
  }

  _generateEndlessWave(endlessIndex) {
    const count = 10 + endlessIndex * 2;
    const entries = [];
    const types = ['normal', 'fast', 'tank'];
    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const roll = Math.random();
      const modifier = roll < 0.2 ? 'fast' : roll < 0.4 ? 'tough' : roll < 0.5 ? 'regen' : null;
      entries.push({ type, delay: i === 0 ? 0 : 0.5, modifier });
    }
    return entries;
  }

  _startWave() {
    if (this.waveActive || this.state !== 'playing') return;
    this.currentWave += 1;
    this.waveActive = true;
    this.waveButton.visible = false;

    const entries = this._getWaveEntries(this.currentWave);
    this.spawnQueue = entries.map((e) => ({ ...e, timer: e.delay }));

    this.sound.playWaveStart();
    this._showBanner(`OLEADA ${this.currentWave}`);
    this._updateHUD();
  }

  _updateSpawning(dt) {
    if (!this.waveActive || this.spawnQueue.length === 0) return;

    this.spawnQueue[0].timer -= dt;
    if (this.spawnQueue[0].timer <= 0) {
      const entry = this.spawnQueue.shift();
      this._spawnEnemy(entry);
    }
  }

  _spawnEnemy(entry) {
    const start = this.waypoints[0];
    const options = {};
    if (entry.modifier === 'fast') options.speedMult = 1.4;
    if (entry.modifier === 'tough') options.hpMult = 1.6;
    if (entry.modifier === 'regen') options.regenHps = 8;

    createEnemy(this.world, entry.type, start, this.enemyLayer, options);
  }

  _checkWaveCompletion() {
    if (!this.waveActive) return;
    if (this.spawnQueue.length > 0) return;
    if (query(this.world, [Enemy]).length > 0) return;

    this.waveActive = false;
    const bonus = 50 + this.currentWave * 10;
    this.gold += bonus;

    if (this.currentWave > wavesData.waves.length) this.endlessWave = this.currentWave - wavesData.waves.length;

    this._saveGame();

    if (this.currentWave >= wavesData.waves.length && !this.endless) {
      this._showEndScreen({ won: true });
      return;
    }

    this.waveButton.visible = true;
    this._refreshWaveButtonLabel();
    this._updateHUD();
  }

  _refreshWaveButtonLabel() {
    const label = this.waveButton.children[1];
    label.text = `⚔️ INICIAR OLEADA ${this.currentWave + 1}`;
  }

  _showBanner(text) {
    this.waveBanner.text = text;
    this._bannerTimer = 0;
    this._bannerPhase = 'in';
  }

  _updateBanner(dt) {
    if (!this._bannerPhase) return;
    this._bannerTimer += dt;

    if (this._bannerPhase === 'in') {
      const t = Math.min(1, this._bannerTimer / 0.3);
      this.waveBanner.alpha = t;
      this.waveBanner.scale.set(t);
      if (t >= 1) {
        this._bannerPhase = 'hold';
        this._bannerTimer = 0;
      }
    } else if (this._bannerPhase === 'hold') {
      if (this._bannerTimer >= 1) {
        this._bannerPhase = 'out';
        this._bannerTimer = 0;
      }
    } else if (this._bannerPhase === 'out') {
      const t = Math.min(1, this._bannerTimer / 0.3);
      this.waveBanner.alpha = 1 - t;
      this.waveBanner.scale.set(1 + t * 0.2);
      if (t >= 1) {
        this._bannerPhase = null;
      }
    }
  }

  // ─────────────────────────────────────────── Enemigos ───────────────────────────────────────────

  _onEnemyEscaped(eid) {
    const sprite = Renderable.sprite[eid];
    sprite?.parent?.removeChild(sprite);
    sprite?.destroy?.();
    removeEntity(this.world, eid);

    this.lives -= 1;
    this.sound.playLeak();
    this._updateHUD();

    if (this.lives <= 0) {
      this._showEndScreen({ won: false });
    }
  }

  _onEnemyDeath({ sprite, gold, x, y, color }) {
    this.gold += gold;
    this.killCount += 1;
    this.sound.playDeath();
    this.particles.deathBurst(x, y, color);
    this._updateHUD();
    this._blinkAndRemove(sprite);
  }

  _blinkAndRemove(sprite) {
    if (!sprite) return;
    let blinks = 0;
    const totalBlinks = 6;
    const interval = setInterval(() => {
      sprite.visible = !sprite.visible;
      blinks += 1;
      if (blinks >= totalBlinks) {
        clearInterval(interval);
        sprite.parent?.removeChild(sprite);
        sprite.destroy?.();
      }
    }, 60);
  }

  // ─────────────────────────────────────────── Construcción ───────────────────────────────────────────

  _isBuildable(gridX, gridY) {
    return mapData.tiles[gridY][gridX] === TILE_TYPES.BUILDABLE && !this.towerGrid[gridY][gridX];
  }

  _onTileClick(gridX, gridY) {
    if (this.state !== 'playing') return;
    if (!this._isBuildable(gridX, gridY)) return;
    this._showBuildMenu(gridX, gridY);
  }

  _showBuildMenu(gridX, gridY) {
    this._closeUpgradePanel();
    this._closeBuildMenu();

    const panelWidth = 220;
    const panelHeight = 190;
    let px = gridX * GRID_SIZE + GRID_SIZE + 8;
    let py = gridY * GRID_SIZE - 20;
    px = Math.min(px, GAME_WIDTH - panelWidth - 8);
    py = Math.max(8, Math.min(py, GAME_HEIGHT - panelHeight - 8));

    const catcher = new PIXI.Graphics();
    catcher.beginFill(0x000000, 0.001);
    catcher.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    catcher.endFill();
    catcher.eventMode = 'static';
    catcher.on('pointerdown', () => this._closeBuildMenu());
    this.popupLayer.addChild(catcher);

    const panel = this._makePanel(panelWidth, panelHeight);
    panel.x = px;
    panel.y = py;

    const title = new PIXI.Text('Construir torre', {
      fontFamily: FONT,
      fontSize: 16,
      fontWeight: 'bold',
      fill: COLORS.TEXT_LIGHT,
    });
    title.x = 14;
    title.y = 10;
    panel.addChild(title);

    let y = 40;
    for (const key of ['ARROW', 'CANNON', 'ICE']) {
      const t = TOWER_TYPES[key];
      const canAfford = this.gold >= t.cost;
      const btn = this._makeButton(`${t.name} — ${t.cost}🪙`, panelWidth - 24, 42, () => this._tryBuild(key), {
        fill: t.color,
        hoverFill: t.color,
      });
      btn.x = 12;
      btn.y = y;
      btn.setEnabled(canAfford);
      panel.addChild(btn);
      y += 50;
    }

    this.popupLayer.addChild(panel);
    this._buildMenuOpen = { catcher, panel, gridX, gridY };
  }

  _closeBuildMenu() {
    if (!this._buildMenuOpen) return;
    this.popupLayer.removeChild(this._buildMenuOpen.catcher);
    this.popupLayer.removeChild(this._buildMenuOpen.panel);
    this._buildMenuOpen.catcher.destroy();
    this._buildMenuOpen.panel.destroy({ children: true });
    this._buildMenuOpen = null;
  }

  _tryBuild(towerTypeKey) {
    if (!this._buildMenuOpen) return;
    const { gridX, gridY } = this._buildMenuOpen;
    const stats = TOWER_TYPES[towerTypeKey];
    if (this.gold < stats.cost || !this._isBuildable(gridX, gridY)) return;

    this.gold -= stats.cost;
    const eid = createTower(this.world, gridX, gridY, towerTypeKey, this.towerLayer);
    this.towerGrid[gridY][gridX] = eid;
    this._attachTowerInteraction(eid);

    this.sound.playBuild();
    this._updateHUD();
    this._closeBuildMenu();
  }

  _attachTowerInteraction(eid) {
    const sprite = Renderable.sprite[eid];
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';
    sprite.hitArea = new PIXI.Rectangle(-24, -24, 48, 48);
    sprite.on('pointerdown', (e) => {
      e.stopPropagation();
      this._onTowerClick(eid);
    });
  }

  // ─────────────────────────────────────────── Mejora / venta ───────────────────────────────────────────

  _onTowerClick(eid) {
    if (this.state !== 'playing') return;
    this._closeBuildMenu();
    this.selectedTowerEid = eid;
    const sprite = Renderable.sprite[eid];
    if (sprite) sprite.rangeIndicator.visible = true;
    this._showUpgradePanel(eid);
  }

  _applyTowerStats(eid) {
    const towerTypeName = TOWER_TYPE_BY_ID[Tower.towerType[eid]];
    const stats = computeTowerStats(towerTypeName, Tower.level[eid], Tower.specialization[eid] || null);
    Tower.damage[eid] = stats.damage;
    Tower.range[eid] = stats.range;
    Tower.fireRate[eid] = stats.fireRate;

    const sprite = Renderable.sprite[eid];
    if (sprite) {
      sprite.rangeIndicator.clear();
      sprite.rangeIndicator.lineStyle(2, COLORS.RANGE_INDICATOR, 0.5);
      sprite.rangeIndicator.drawCircle(0, 0, stats.range);
    }
  }

  _applyTowerVisualLevel(eid) {
    const sprite = Renderable.sprite[eid];
    const level = Tower.level[eid];
    const scale = level === 1 ? 1 : level === 2 ? 1.12 : 1.28;
    sprite.base.scale.set(scale);
    sprite.turret.scale.set(scale, sprite.turret.scale.y);

    if (Tower.specialization[eid]) {
      if (!sprite.specIcon) {
        const icon = new PIXI.Text('', { fontFamily: FONT, fontSize: 20 });
        icon.anchor.set(0.5);
        icon.y = -48;
        sprite.addChild(icon);
        sprite.specIcon = icon;
      }
      const towerTypeName = TOWER_TYPE_BY_ID[Tower.towerType[eid]];
      const spec = getSpecialization(towerTypeName, Tower.specialization[eid]);
      sprite.specIcon.text = spec?.icon ?? '';

      sprite.turret.clear();
      sprite.turret.beginFill(TOWER_TYPES[towerTypeName].color);
      sprite.turret.drawCircle(0, 0, 18);
      sprite.turret.endFill();
      sprite.turret.lineStyle(3, COLORS.UI_PANEL_BORDER, 1);
      sprite.turret.drawCircle(0, 0, 18);
    } else if (level >= 3 && !sprite.starIcon) {
      const star = new PIXI.Text('★', { fontFamily: FONT, fontSize: 16, fill: COLORS.GOLD });
      star.anchor.set(0.5);
      star.y = -46;
      sprite.addChild(star);
      sprite.starIcon = star;
    }
  }

  _showUpgradePanel(eid) {
    this._closeUpgradePanel();

    const towerTypeName = TOWER_TYPE_BY_ID[Tower.towerType[eid]];
    const stats = TOWER_TYPES[towerTypeName];
    const level = Tower.level[eid];
    const specId = Tower.specialization[eid];
    const spec = getSpecialization(towerTypeName, specId);

    const panelWidth = 260;
    const panelHeight = spec || level >= 3 ? 260 : 230;
    const gridX = Tower.gridX[eid];
    const gridY = Tower.gridY[eid];
    let px = Math.min(gridX * GRID_SIZE + GRID_SIZE + 8, GAME_WIDTH - panelWidth - 8);
    let py = Math.max(8, Math.min(gridY * GRID_SIZE - 20, GAME_HEIGHT - panelHeight - 8));

    const catcher = new PIXI.Graphics();
    catcher.beginFill(0x000000, 0.001);
    catcher.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    catcher.endFill();
    catcher.eventMode = 'static';
    catcher.on('pointerdown', () => this._closeUpgradePanel());
    this.popupLayer.addChild(catcher);

    const panel = this._makePanel(panelWidth, panelHeight);
    panel.x = px;
    panel.y = py;

    const title = new PIXI.Text(`${stats.name}${spec ? ' · ' + spec.icon + ' ' + spec.name : ''}`, {
      fontFamily: FONT,
      fontSize: 16,
      fontWeight: 'bold',
      fill: COLORS.TEXT_LIGHT,
      wordWrap: true,
      wordWrapWidth: panelWidth - 24,
    });
    title.x = 14;
    title.y = 10;
    panel.addChild(title);

    const info = new PIXI.Text(
      `Nivel ${level} / 3\nDaño: ${Tower.damage[eid].toFixed(1)}   Rango: ${Tower.range[eid].toFixed(0)}\nCadencia: ${Tower.fireRate[eid].toFixed(2)}/s`,
      { fontFamily: FONT, fontSize: 13, fill: 0xd7c9a8, lineHeight: 18 }
    );
    info.x = 14;
    info.y = 40;
    panel.addChild(info);

    let y = 100;

    if (level < 3) {
      const cost = getUpgradeCost(level + 1);
      const btn = this._makeButton(`⬆ MEJORAR (${cost}🪙)`, panelWidth - 24, 40, () => this._upgradeTower(eid), {
        fill: 0x2e6ea6,
        hoverFill: 0x3f8ed6,
      });
      btn.x = 12;
      btn.y = y;
      btn.setEnabled(this.gold >= cost);
      panel.addChild(btn);
      y += 48;
    } else if (!spec) {
      const options = SPECIALIZATIONS[towerTypeName];
      for (const key of Object.keys(options)) {
        const opt = options[key];
        const btn = this._makeButton(`${opt.icon} ${opt.name} (${opt.cost}🪙)`, panelWidth - 24, 40, () => this._specializeTower(eid, opt.id), {
          fill: 0x6a1b9a,
          hoverFill: 0x8e24aa,
        });
        btn.x = 12;
        btn.y = y;
        btn.setEnabled(this.gold >= opt.cost);
        panel.addChild(btn);
        y += 48;
      }
    } else {
      const maxed = new PIXI.Text('Torre al máximo nivel', { fontFamily: FONT, fontSize: 13, fill: 0x8d7a5c });
      maxed.x = 14;
      maxed.y = y;
      panel.addChild(maxed);
      y += 30;
    }

    const sellValue = getSellValue(towerTypeName, level);
    const sellBtn = this._makeButton(`💰 VENDER (+${sellValue}🪙)`, panelWidth - 24, 40, () => this._sellTower(eid), {
      fill: 0x8d1f1f,
      hoverFill: 0xb33a3a,
    });
    sellBtn.x = 12;
    sellBtn.y = y;
    panel.addChild(sellBtn);

    this.popupLayer.addChild(panel);
    this._upgradePanelOpen = { catcher, panel };
  }

  _closeUpgradePanel() {
    if (!this._upgradePanelOpen) return;
    this.popupLayer.removeChild(this._upgradePanelOpen.catcher);
    this.popupLayer.removeChild(this._upgradePanelOpen.panel);
    this._upgradePanelOpen.catcher.destroy();
    this._upgradePanelOpen.panel.destroy({ children: true });
    this._upgradePanelOpen = null;

    if (this.selectedTowerEid !== null) {
      const sprite = Renderable.sprite[this.selectedTowerEid];
      if (sprite) sprite.rangeIndicator.visible = false;
    }
    this.selectedTowerEid = null;
  }

  _upgradeTower(eid) {
    const level = Tower.level[eid];
    const cost = getUpgradeCost(level + 1);
    if (this.gold < cost) return;

    this.gold -= cost;
    Tower.level[eid] = level + 1;
    this._applyTowerStats(eid);
    this._applyTowerVisualLevel(eid);

    this.sound.playUpgrade();
    this.particles.upgradeRing(Position.x[eid], Position.y[eid]);
    this._updateHUD();
    this._showUpgradePanel(eid);
  }

  _specializeTower(eid, specId) {
    const towerTypeName = TOWER_TYPE_BY_ID[Tower.towerType[eid]];
    const spec = getSpecialization(towerTypeName, specId);
    if (!spec || this.gold < spec.cost) return;

    this.gold -= spec.cost;
    Tower.specialization[eid] = specId;
    this._applyTowerStats(eid);
    this._applyTowerVisualLevel(eid);

    this.sound.playUpgrade();
    this.particles.upgradeRing(Position.x[eid], Position.y[eid]);
    this._updateHUD();
    this._showUpgradePanel(eid);
  }

  _sellTower(eid) {
    const towerTypeName = TOWER_TYPE_BY_ID[Tower.towerType[eid]];
    const value = getSellValue(towerTypeName, Tower.level[eid]);
    this.gold += value;

    const gridX = Tower.gridX[eid];
    const gridY = Tower.gridY[eid];
    this.towerGrid[gridY][gridX] = null;

    const sprite = Renderable.sprite[eid];
    sprite?.parent?.removeChild(sprite);
    sprite?.destroy?.({ children: true });
    removeEntity(this.world, eid);

    this._updateHUD();
    this._closeUpgradePanel();
  }

  // ─────────────────────────────────────────── HUD / persistencia ───────────────────────────────────────────

  _updateHUD() {
    this.goldText.text = `🪙 Oro: ${this.gold}`;
    this.livesText.text = `❤️ Vidas: ${this.lives}`;
    const totalWaves = wavesData.waves.length;
    this.waveText.text = this.endless
      ? `Oleada ${this.currentWave} · Sin fin +${this.endlessWave}`
      : `Oleada ${this.currentWave} / ${totalWaves}`;
  }

  _toggleMute() {
    this._muted = !this._muted;
    this.sound.setMuted(this._muted);
    this.muteButton.children[1].text = this._muted ? '🔇' : '🔊';
  }

  _saveGame() {
    const towers = [];
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const eid = this.towerGrid[row][col];
        if (eid === null) continue;
        towers.push({
          gridX: col,
          gridY: row,
          towerType: TOWER_TYPE_BY_ID[Tower.towerType[eid]],
          level: Tower.level[eid],
          specialization: Tower.specialization[eid],
        });
      }
    }

    const data = {
      currentWave: this.currentWave,
      gold: this.gold,
      lives: this.lives,
      killCount: this.killCount,
      towers,
      endless: this.endless,
      endlessWave: this.endlessWave,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  _readSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  _clearSave() {
    localStorage.removeItem(SAVE_KEY);
  }
}
