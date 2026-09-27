// Материалы Three.js для скинов стен, поля и фишек.

import * as THREE from 'three';
import { getTextures } from './textures.js';
import { findSkin, PLAYER_COLORS } from '../data/skins.js';

const cache = new Map();

function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

function surface(skin, tex, seed = 1) {
  const t = getTextures(tex, skin, seed);
  const transparent = skin.opacity !== undefined;
  const Mat = transparent ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const mat = new Mat({
    color: t.map ? 0xffffff : skin.color,
    map: t.map || null,
    roughness: skin.rough ?? 0.6,
    metalness: skin.metal ?? 0,
    roughnessMap: t.roughnessMap || null,
  });
  if (t.emissiveMap) {
    mat.emissive = new THREE.Color(0xffffff);
    mat.emissiveMap = t.emissiveMap;
    mat.emissiveIntensity = tex === 'ice' ? 0.25 : tex === 'space' ? 0.6 : 1.6;
  }
  if (transparent) {
    mat.transparent = true;
    mat.opacity = skin.opacity;
    mat.clearcoat = 1;
    mat.clearcoatRoughness = 0.1;
  }
  return mat;
}

export function wallMaterial(id) {
  const skin = findSkin('walls', id);
  return cached(`wall:${skin.id}`, () => surface(skin, skin.tex, 3));
}

// Материалы поля: плитки (для шахмат — две), рамка, основание
export function fieldMaterials(id) {
  const skin = findSkin('field', id);
  return cached(`field:${skin.id}`, () => {
    const tiles = [surface(skin, skin.tex, 0)];
    if (skin.tex === 'chess') tiles.push(surface(skin, skin.tex, 1));
    const frame = new THREE.MeshStandardMaterial({ color: skin.frame, roughness: 0.55, metalness: 0.25 });
    const base = new THREE.MeshStandardMaterial({ color: skin.base, roughness: 0.8, metalness: 0.1 });
    if (skin.glow) {
      base.emissive = new THREE.Color(skin.glow);
      base.emissiveIntensity = 0.35;
    }
    return { tiles, frame, base, skin };
  });
}

// Материал фишки конкретного игрока
export function pawnMaterial(id, player) {
  const skin = findSkin('pawns', id);
  const color = new THREE.Color(PLAYER_COLORS[player]);
  return cached(`pawn:${skin.id}:${player}`, () => {
    switch (skin.style) {
      case 'gold':
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color('#f1c24e').lerp(color, 0.18),
          metalness: 1,
          roughness: 0.22,
        });
      case 'metal':
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color('#aab4c4').lerp(color, 0.35),
          metalness: 0.95,
          roughness: 0.3,
        });
      case 'glass':
        return new THREE.MeshPhysicalMaterial({
          color: color.clone().lerp(new THREE.Color('#ffffff'), 0.35),
          metalness: 0,
          roughness: 0.05,
          transparent: true,
          opacity: 0.6,
          clearcoat: 1,
          emissive: color,
          emissiveIntensity: 0.25,
        });
      case 'crystal':
        return new THREE.MeshPhysicalMaterial({
          color,
          metalness: 0.1,
          roughness: 0.05,
          transparent: true,
          opacity: 0.8,
          clearcoat: 1,
          emissive: color,
          emissiveIntensity: 0.6,
          flatShading: true,
        });
      case 'neon':
        return new THREE.MeshStandardMaterial({
          color: '#0a0a14',
          emissive: color,
          emissiveIntensity: 2.2,
          roughness: 0.4,
        });
      case 'marble': {
        const t = getTextures('marble', { color: '#f2f2f5', vein: PLAYER_COLORS[player] }, 5 + player);
        return new THREE.MeshStandardMaterial({ map: t.map, roughness: 0.25 });
      }
      case 'lava': {
        const t = getTextures('lava', { color: '#1a1010', glow: PLAYER_COLORS[player] }, 7 + player);
        return new THREE.MeshStandardMaterial({
          map: t.map,
          emissive: 0xffffff,
          emissiveMap: t.emissiveMap,
          emissiveIntensity: 1.8,
          roughness: 0.8,
        });
      }
      default:
        return new THREE.MeshStandardMaterial({
          color,
          roughness: 0.28,
          metalness: 0.05,
          emissive: color,
          emissiveIntensity: 0.05,
        });
    }
  });
}

export function pawnIsFaceted(id) {
  return findSkin('pawns', id).style === 'crystal';
}
