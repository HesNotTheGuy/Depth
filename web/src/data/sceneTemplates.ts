import type { ObjectPreset } from '../store/useSceneStore';

export interface SceneTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  state: {
    objectType?: ObjectPreset;
    objectColor?: string;
    objectMaterial?: 'matte' | 'glossy' | 'metallic' | 'glass' | 'plastic';
    objectRoughness?: number;
    objectMetalness?: number;
    objectTransmission?: number;
    objectIor?: number;
    objectClearcoat?: number;
    objectOpacity?: number;
    objectReflectivity?: number;
    objectPosition?: { x: number; y: number; z: number };
    objectRotation?: { x: number; y: number; z: number };
    objectScale?: number;
    brightness?: number;
    lightAngle?: number;
    lightElevation?: number;
    lightColor?: string;
    shadowOpacity?: number;
    shadowSoftness?: number;
    shadowColor?: string;
  };
}

export const sceneTemplates: SceneTemplate[] = [
  {
    id: 'product-hero',
    name: 'Product Hero',
    description: 'Centered sphere with glass material and bright lighting',
    icon: '💎',
    state: {
      objectType: 'sphere',
      objectMaterial: 'glass',
      objectColor: '#E8E8E8',
      objectRoughness: 0.05,
      objectMetalness: 0,
      objectTransmission: 1.0,
      objectIor: 1.5,
      objectOpacity: 0.2,
      objectReflectivity: 0.5,
      objectPosition: { x: 0, y: 0.5, z: 0 },
      objectRotation: { x: 0, y: 0, z: 0 },
      objectScale: 1,
      brightness: 1.4,
      lightAngle: 45,
      lightElevation: 0.7,
      lightColor: '#ffffff',
      shadowOpacity: 0.7,
      shadowSoftness: 0.4,
    },
  },
  {
    id: 'phone-mockup',
    name: 'Phone Mockup',
    description: 'Tilted phone with dark plastic finish',
    icon: '📱',
    state: {
      objectType: 'phone',
      objectMaterial: 'plastic',
      objectColor: '#1A1A1A',
      objectRoughness: 0.4,
      objectMetalness: 0,
      objectClearcoat: 0.5,
      objectOpacity: 1.0,
      objectPosition: { x: 0, y: 0.5, z: 0 },
      objectRotation: { x: 0.05, y: 0.35, z: 0 },
      objectScale: 1,
      brightness: 1.0,
      lightAngle: 40,
      lightElevation: 0.6,
      lightColor: '#ffffff',
      shadowOpacity: 0.5,
      shadowSoftness: 0.5,
    },
  },
  {
    id: 'coffee-table',
    name: 'Coffee Table',
    description: 'Warm mug with soft ceramic look',
    icon: '☕',
    state: {
      objectType: 'mug',
      objectMaterial: 'matte',
      objectColor: '#FFFFFF',
      objectRoughness: 0.85,
      objectMetalness: 0,
      objectOpacity: 1.0,
      objectPosition: { x: 0, y: 0.5, z: 0 },
      objectRotation: { x: 0, y: 0, z: 0 },
      objectScale: 1,
      brightness: 1.1,
      lightAngle: 50,
      lightElevation: 0.5,
      lightColor: '#FFF5E0',
      shadowOpacity: 0.4,
      shadowSoftness: 0.7,
    },
  },
  {
    id: 'wine-display',
    name: 'Wine Display',
    description: 'Glass bottle with dark dramatic lighting',
    icon: '🍷',
    state: {
      objectType: 'bottle',
      objectMaterial: 'glass',
      objectColor: '#2D5A3D',
      objectRoughness: 0.05,
      objectMetalness: 0,
      objectTransmission: 1.0,
      objectIor: 1.5,
      objectOpacity: 0.3,
      objectReflectivity: 0.5,
      objectPosition: { x: 0, y: 0.5, z: 0 },
      objectRotation: { x: 0, y: 0, z: 0 },
      objectScale: 1,
      brightness: 0.6,
      lightAngle: 30,
      lightElevation: 0.8,
      lightColor: '#ffffff',
      shadowOpacity: 0.8,
      shadowSoftness: 0.3,
    },
  },
  {
    id: 'business-card',
    name: 'Business Card',
    description: 'Flat card with clean overhead light',
    icon: '💳',
    state: {
      objectType: 'card',
      objectMaterial: 'matte',
      objectColor: '#FFFFFF',
      objectRoughness: 0.9,
      objectMetalness: 0,
      objectOpacity: 1.0,
      objectPosition: { x: 0, y: 0.5, z: 0 },
      objectRotation: { x: 0, y: 0, z: 0 },
      objectScale: 1,
      brightness: 1.2,
      lightAngle: 0,
      lightElevation: 0.9,
      lightColor: '#ffffff',
      shadowOpacity: 0.2,
      shadowSoftness: 0.3,
    },
  },
  {
    id: 'shopping-bag',
    name: 'Shopping Bag',
    description: 'Bright even lighting for retail display',
    icon: '🛍️',
    state: {
      objectType: 'bag',
      objectMaterial: 'plastic',
      objectColor: '#E8E8E8',
      objectRoughness: 0.4,
      objectMetalness: 0,
      objectClearcoat: 0.5,
      objectOpacity: 1.0,
      objectPosition: { x: 0, y: 0.5, z: 0 },
      objectRotation: { x: 0, y: 0, z: 0 },
      objectScale: 1,
      brightness: 1.3,
      lightAngle: 45,
      lightElevation: 0.5,
      lightColor: '#ffffff',
      shadowOpacity: 0.4,
      shadowSoftness: 0.5,
    },
  },
  {
    id: 'floating-product',
    name: 'Floating Product',
    description: 'Elevated metallic sphere with strong shadow',
    icon: '✨',
    state: {
      objectType: 'sphere',
      objectMaterial: 'metallic',
      objectColor: '#C4956A',
      objectRoughness: 0.3,
      objectMetalness: 1.0,
      objectOpacity: 1.0,
      objectPosition: { x: 0, y: 1.0, z: 0 },
      objectRotation: { x: 0, y: 0, z: 0 },
      objectScale: 1,
      brightness: 1.1,
      lightAngle: 60,
      lightElevation: 0.6,
      lightColor: '#ffffff',
      shadowOpacity: 0.6,
      shadowSoftness: 0.8,
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean box with neutral lighting, no shadow',
    icon: '◻️',
    state: {
      objectType: 'box',
      objectMaterial: 'matte',
      objectColor: '#FFFFFF',
      objectRoughness: 0.9,
      objectMetalness: 0,
      objectOpacity: 1.0,
      objectPosition: { x: 0, y: 0.5, z: 0 },
      objectRotation: { x: 0, y: 0, z: 0 },
      objectScale: 1,
      brightness: 1.0,
      lightAngle: 45,
      lightElevation: 0.6,
      lightColor: '#ffffff',
      shadowOpacity: 0,
      shadowSoftness: 0.5,
    },
  },
];
