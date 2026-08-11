// Paleta de 16 colores estilo pixel art (definida por diseño) + un pequeño
// set de acentos auxiliares para criaturas (fuera de los 16, solo para ojos
// brillantes / pelaje que no pueden expresarse con la paleta base).
//
// Tierra/madera:  #4a2c0a #6b3a1f #8b5a2b #c49a6c
// Naturaleza:     #2d5a1e #4a8c2a #7bc44a #a8d870
// Elementos:      #c43a1a #e87830 #1a5ac4 #6bc4e8
// Metales/UI:     #8a8a8a #c4c4c4 #f0c040 #fafafa

export const PALETTE = {
  brownDark: '#4a2c0a',
  brownMid: '#6b3a1f',
  brownLight: '#8b5a2b',
  beige: '#c49a6c',

  greenDark: '#2d5a1e',
  greenMid: '#4a8c2a',
  greenLight: '#7bc44a',
  greenBright: '#a8d870',

  fireRed: '#c43a1a',
  orange: '#e87830',
  iceBlue: '#1a5ac4',
  iceLight: '#6bc4e8',

  gray: '#8a8a8a',
  silver: '#c4c4c4',
  gold: '#f0c040',
  white: '#fafafa',
};

// Acentos auxiliares (no forman parte de los 16 "oficiales", usados con
// moderación para variedad de criaturas/efectos que la paleta base no cubre).
export const ACCENT = {
  outline: '#1a1208',
  outlineCold: '#0a1420',
  purpleDark: '#241a30',
  purpleMid: '#3b2350',
  redGlow: '#ff3b3b',
  redDeep: '#8a1010',
  boneWhite: '#e8e0c8',
  boneShadow: '#a89a78',
  fireGlowBlue: '#4de3c8',
  fireGlowGreen: '#7bffb0',
  skyTop: '#3a6ea8',
  skyBottom: '#bcd8e8',
  mountainFar: '#5a6b7a',
  mountainNear: '#3f4d5c',
  cloud: '#f4f8fb',
};
