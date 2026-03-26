// World dimensions
export const WORLD_SIZE = 2000;
export const WORLD_HALF = WORLD_SIZE / 2;
export const TERRAIN_SEGMENTS = 256;
export const CHUNK_COUNT = 8; // NxN grid of terrain chunks
export const CHUNK_SIZE = WORLD_SIZE / CHUNK_COUNT;

// Terrain generation
export const ARC_COUNT = 250;
export const ARC_MIN_RADIUS = 30;
export const ARC_MAX_RADIUS = 150;
export const ARC_MIN_HEIGHT = 5;
export const ARC_MAX_HEIGHT = 60;

// Water
export const WATER_LEVEL = 8;

// Clouds
export const CLOUD_HEIGHT = 300;
export const CLOUD_COUNT = 60;

// Trees
export const TREE_CLUSTER_COUNT = 120;
export const TREES_PER_CLUSTER_MIN = 8;
export const TREES_PER_CLUSTER_MAX = 35;
export const TREE_MIN_HEIGHT = 8;
export const TREE_MAX_HEIGHT = 18;

// Flight physics
export const GRAVITY = -9.81;
export const LIFT_IMPULSE = 12;
export const DRAG_COEFFICIENT = 0.02;
export const GLIDE_RATIO = 8;
export const MAX_SPEED = 50;
export const TERMINAL_VELOCITY = -30;
export const BANK_RATE = 0.8;

// Camera
export const FOG_NEAR = 100;
export const FOG_FAR = 800;
export const CAMERA_FOV = 75;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 1000;
export const CHASE_DISTANCE = 15;
export const CHASE_HEIGHT = 5;

// Rendering
export const GRASS_TEXTURE_REPEAT = 64;
