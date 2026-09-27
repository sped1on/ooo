// Материалы Three.js для скинов: поле, рамка, стены, фишки, финиш.

import * as THREE from 'three';
import { genTexture, toTexture } from './textures.js';
import { findSkin, PLAYER_COLORS } from '../data/skins.js';

const cache = new Map();

function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

// Размер текстур: на слабых экранах поменьше, чтобы не тратить память
const HQ = Math.min(window.devicePixelRatio || 1, 2) * Math.min(screen.width, screen.height) > 900;
export const SURF_SIZE = HQ ? 1024 : 768;
export const TEX_SIZE = HQ ? 512 : 384;

function texturedMaterial(recipe, params, size, opts = {}) {
  const t = genTexture(recipe, params, size);
  const transparent = opts.opacity !== undefined && opts.opacity < 1;
  const Mat = transparent || opts.clearcoat ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const mat = new Mat({
    map: toTexture(t.map),
    roughness: opts.rough ?? 0.6,
    metalness: opts.metal ?? 0,
  });
  if (t.emissive && (opts.glow ?? 1) > 0) {
    mat.emissive = new THREE.Color(0xffffff);
    mat.emissiveMap = toTexture(t.emissive);
    mat.emissiveIntensity = opts.glow ?? 1;
  }
  if (transparent) {
    mat.transparent = true;
    mat.opacity = opts.opacity;
    mat.clearcoat = 1;
    mat.clearcoatRoughness = 0.08;
    mat.depthWrite = false;
  }
  return mat;
}

// ---------- Поле ----------

export function fieldMaterials(id, size = SURF_SIZE) {
  const skin = findSkin('field', id);
  return cached(`field:${skin.id}:${size}`, () => {
    const surface = texturedMaterial(skin.surf.r, skin.surf.p, size, { rough: skin.rough, metal: skin.metal, glow: skin.glow ?? 1 });
    const frame = texturedMaterial(skin.frame.r, skin.frame.p, Math.min(TEX_SIZE, size), { rough: 0.7, metal: skin.frame.r === 'metal' ? 0.5 : 0.05, glow: 1 });
    const baseColor = new THREE.Color(skin.frame.p.c || '#1a1d24').multiplyScalar(0.45);
    const base = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.85 });
    // Дно борозд — заметно темнее поверхности
    const groove = new THREE.MeshStandardMaterial({ color: new THREE.Color(skin.surf.p.c || '#222').multiplyScalar(0.16), roughness: 0.9 });
    return { surface, frame, base, groove, skin };
  });
}

// Клетчатая плитка стартового/финишного ряда
export function finishTileMaterial() {
  return cached('finish-tile', () => {
    const t = genTexture('checker', { grid: 4 }, 128);
    const map = toTexture(t.map);
    map.magFilter = THREE.NearestFilter;
    return new THREE.MeshStandardMaterial({ map, roughness: 0.5, metalness: 0.05 });
  });
}

// ---------- Стены ----------

export function wallMaterial(id) {
  const skin = findSkin('walls', id);
  return cached(`wall:${skin.id}`, () => {
    const mat = texturedMaterial(skin.r, skin.p, TEX_SIZE, { rough: skin.rough, metal: skin.metal, opacity: skin.opacity, glow: skin.glow ?? 1 });
    if (skin.plain && skin.glowColor) {
      mat.emissive = new THREE.Color(skin.glowColor);
      mat.emissiveIntensity = 0.9;
      mat.toneMapped = false;
    }
    return mat;
  });
}

export function wallGlowColor(id) {
  return findSkin('walls', id).glowColor || null;
}

// ---------- Фишки ----------

export function pawnMaterial(id, player) {
  const skin = findSkin('pawns', id);
  const pc = PLAYER_COLORS[player];
  return cached(`pawn:${skin.id}:${player}`, () => {
    switch (skin.style) {
      case 'metal':
        return new THREE.MeshPhysicalMaterial({ color: skin.c, metalness: 1, roughness: skin.rough ?? 0.25, clearcoat: 0.6, clearcoatRoughness: 0.1 });
      case 'glass':
        return new THREE.MeshPhysicalMaterial({
          color: skin.c,
          metalness: 0,
          roughness: 0.04,
          transparent: true,
          opacity: skin.opacity ?? 0.7,
          clearcoat: 1,
          clearcoatRoughness: 0.03,
          emissive: skin.c,
          emissiveIntensity: skin.emissive ?? 0.3,
          flatShading: !!skin.faceted,
        });
      case 'neon':
        return new THREE.MeshStandardMaterial({ color: '#0a0a14', emissive: skin.c, emissiveIntensity: 2.4, roughness: 0.35, toneMapped: false });
      case 'tex':
        return texturedMaterial(skin.r, skin.p, TEX_SIZE, { rough: skin.rough, metal: skin.metal, glow: skin.glow ?? 1, clearcoat: true });
      default:
        return new THREE.MeshPhysicalMaterial({
          color: skin.c || pc,
          roughness: skin.rough ?? 0.3,
          metalness: 0.02,
          clearcoat: (skin.rough ?? 0.3) > 0.8 ? 0 : 0.8,
          clearcoatRoughness: 0.12,
        });
    }
  });
}

export function pawnIsFaceted(id) {
  return !!findSkin('pawns', id).faceted;
}

// ---------- Финиш ----------

export function finishGlow(id, player) {
  return findSkin('finish', id).glowColor || PLAYER_COLORS[player];
}

export function finishMaterial(id, player) {
  const skin = findSkin('finish', id);
  return cached(`finish:${skin.id}:${player}`, () => {
    if (skin.plain) return new THREE.MeshBasicMaterial({ color: finishGlow(id, player), toneMapped: false });
    const mat = texturedMaterial(skin.r, skin.p, 256, { rough: 0.4, metal: skin.metal, glow: 1.4 });
    if (!mat.emissiveMap) mat.emissive = new THREE.Color(skin.glowColor).multiplyScalar(0.25);
    return mat;
  });
}
