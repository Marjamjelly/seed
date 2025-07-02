// --- Utility: Seeded RNG ---
function mulberry32(seed) {
  // Simple fast seeded RNG, returns function() for next random
  let t = Math.imul(seed ^ 0xdeadbeef, 2654435761) >>> 0;
  return function() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ t >>> 15, 1 | t);
    r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}

// --- Simple Perlin-like Hash Noise ---
function noise2D(x, y, rng) {
  // Hash-based "smooth" noise; for real Perlin, use a library
  let s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return (s - Math.floor(s)) * 0.5 + 0.5 * rng();
}

// --- Settings ---
const BIOMES = [
  {name: 'water',     color: [38, 70, 129]},
  {name: 'beach',     color: [238, 214, 175]},
  {name: 'grass',     color: [106, 190, 48]},
  {name: 'forest',    color: [34, 139, 34]},
  {name: 'mountain',  color: [118, 120, 123]},
  {name: 'snow',      color: [252, 252, 252]}
];
const RIVER_COLOR = [54, 127, 173];
const TOWN_COLOR = [230, 57, 70];
const ROAD_COLOR = [140, 120, 80];

// --- Map Generation ---
function generateMap(seedStr, size) {
  let canvas = document.getElementById('mapCanvas');
  canvas.width = size;
  canvas.height = size;
  let ctx = canvas.getContext('2d');
  let imgData = ctx.createImageData(size, size);
  let data = imgData.data;

  // RNG setup
  const hash = str => {
    let h=2166136261>>>0;
    for (let i=0; i<str.length; i++) {h^=str.charCodeAt(i);h=Math.imul(h,16777619);}
    return h>>>0;
  };
  let baseSeed = hash(seedStr);
  let rng = mulberry32(baseSeed);

  // Height + moisture maps
  let heights = [];
  let moists = [];
  for (let y = 0; y < size; y++) {
    heights[y] = [];
    moists[y] = [];
    for (let x = 0; x < size; x++) {
      // Normalize x,y for round island, between -1 and 1
      let nx = (x/size-0.5) * 2, ny = (y/size-0.5) * 2;
      let dist = Math.sqrt(nx*nx + ny*ny);
      // Layered noise for natural look
      let h =
        0.70 * noise2D(x*0.023, y*0.023, rng) +
        0.35 * noise2D(x*0.085, y*0.085, rng) +
        0.12 * noise2D(x*0.18, y*0.18, rng);
      h = h / (0.70+0.35+0.12);

      // Island shape: lower near the edges
      h *= (1.0 - 0.65*dist);
      if (dist > 1) h = 0;
      heights[y][x] = h;

      // Moisture: random with some terrain correlation
      let m = noise2D(x*0.11+100, y*0.11-50, rng);
      m = m*0.7 + 0.3*(1-h);
      moists[y][x] = m;
    }
  }

  // --- Place Biomes ---
  function getBiome(h, m) {
    if (h < 0.37) return 0; // water
    else if (h < 0.41) return 1; // beach
    else if (h > 0.86) return 5; // snow
    else if (h > 0.76) return 4; // mountain
    else if (m > 0.63) return 3; // forest
    else return 2; // grass
  }

  // --- Rivers ---
  let riverMap = [];
  for (let y = 0; y < size; y++) riverMap[y] = Array(size).fill(false);

  // Place a few rivers from high to low
  for (let r = 0; r < 4; r++) {
    // Start at a random mountain
    let rx = Math.floor(rng()*size), ry = Math.floor(rng()*size);
    for (let tries=0; tries<100; tries++) {
      if (heights[ry][rx] > 0.78) break;
      rx = Math.floor(rng()*size); ry = Math.floor(rng()*size);
    }
    // River flows down
    let x = rx, y = ry;
    for (let i = 0; i < size*2; i++) {
      riverMap[y][x] = true;
      // Find lowest neighbor
      let lowestH = heights[y][x], next = null;
      for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) {
        let nx=x+dx, ny=y+dy;
        if (nx<0||ny<0||nx>=size||ny>=size||(dx==0&&dy==0)) continue;
        if (heights[ny][nx]<lowestH) {lowestH=heights[ny][nx]; next=[nx,ny];}
      }
      if (!next || lowestH >= heights[y][x]) break;
      [x, y] = next;
      if (heights[y][x] < 0.37) break; // reached water
    }
  }

  // --- Towns ---
  let towns = [];
  rng = mulberry32(baseSeed+99); // separate RNG stream
  for (let t=0; t<6; t++) {
    for (let tries=0; tries<70; tries++) {
      let x = Math.floor(rng()*size), y = Math.floor(rng()*size);
      let h = heights[y][x], m = moists[y][x];
      if (h > 0.42 && h < 0.78 && !riverMap[y][x]) {
        if (towns.every(([tx,ty])=>Math.abs(tx-x)+Math.abs(ty-y)>28))
        { towns.push([x,y]); break; }
      }
    }
  }

  // --- Roads ---
  function drawRoad(x0, y0, x1, y1) {
    // Bresenham's line
    let dx = Math.abs(x1-x0), dy = Math.abs(y1-y0);
    let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx-dy;
    let x = x0, y = y0;
    while (true) {
      let idx = 4*(y*size + x);
      data[idx]=ROAD_COLOR[0]; data[idx+1]=ROAD_COLOR[1]; data[idx+2]=ROAD_COLOR[2];
      data[idx+3]=255;
      if (x===x1 && y===y1) break;
      let e2 = 2*err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
      if (x<0||y<0||x>=size||y>=size) break;
    }
  }

  // --- Render Map ---
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let h = heights[y][x], m = moists[y][x];
      let biome = getBiome(h, m);
      let c = BIOMES[biome].color;
      let idx = 4*(y*size + x);
      data[idx] = c[0]; data[idx+1] = c[1]; data[idx+2] = c[2]; data[idx+3]=255;
      if (riverMap[y][x]) {
        data[idx]=RIVER_COLOR[0]; data[idx+1]=RIVER_COLOR[1]; data[idx+2]=RIVER_COLOR[2];
      }
    }
  }

  // Draw towns
  for (let [x, y] of towns) {
    for (let dy=-2; dy<=2; dy++) for (let dx=-2; dx<=2; dx++) {
      let nx=x+dx, ny=y+dy;
      if (nx>=0&&ny>=0&&nx<size&&ny<size) {
        let idx = 4*(ny*size + nx);
        data[idx]=TOWN_COLOR[0]; data[idx+1]=TOWN_COLOR[1]; data[idx+2]=TOWN_COLOR[2];
      }
    }
  }

  // Draw roads between towns (MST-like: naive nearest chain)
  let connected = [towns[0]], remaining = towns.slice(1);
  while (remaining.length) {
    let best = null, bestDist = 9999, fromIdx=0, toIdx=0;
    for (let i=0; i<connected.length; i++) {
      for (let j=0; j<remaining.length; j++) {
        let [x0,y0]=connected[i], [x1,y1]=remaining[j];
        let d = Math.abs(x0-x1)+Math.abs(y0-y1);
        if (d < bestDist) {bestDist=d; best=[x0,y0,x1,y1]; fromIdx=i; toIdx=j;}
      }
    }
    if (best) {
      drawRoad(best[0],best[1],best[2],best[3]);
      connected.push(remaining[toIdx]);
      remaining.splice(toIdx,1);
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// --- UI ---
function updateMap() {
  const seed = document.getElementById('seedInput').value;
  let size = parseInt(document.getElementById('sizeInput').value,10);
  size = Math.max(32, Math.min(512, size));
  generateMap(seed, size);
}
document.getElementById('generateBtn').onclick = updateMap;
window.onload = updateMap;