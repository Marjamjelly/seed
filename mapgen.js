// --- Seeded RNG for reproducible maps ---
function mulberry32(seed) {
  let t = Math.imul(seed ^ 0xdeadbeef, 2654435761) >>> 0;
  return function() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ t >>> 15, 1 | t);
    r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}
function hashString(str) {
  let h=2166136261>>>0;
  for (let i=0; i<str.length; i++) {h^=str.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}

// --- Tile Definitions (drawn in JS for demo, swap with images for real art) ---
const TILE_SIZE = 16;
const TILE_TYPES = ['water','sand','grass','forest','road','road_curve','road_t','road_cross','mountain'];
const tileArt = {}; // tileArt[type] = HTMLCanvasElement

function makeTiles() {
  // Each tile is a 16x16 offscreen canvas
  TILE_TYPES.forEach(type => {
    let c = document.createElement('canvas');
    c.width = c.height = TILE_SIZE;
    let ctx = c.getContext('2d');
    // Background fill
    switch(type) {
      case 'water':
        ctx.fillStyle = '#355caa';
        ctx.fillRect(0,0,16,16);
        ctx.fillStyle = '#68aee8'; // waves
        for(let i=0; i<4; ++i) ctx.fillRect(2+i*4, 12, 2, 2);
        break;
      case 'sand':
        ctx.fillStyle = '#e8d28b';
        ctx.fillRect(0,0,16,16);
        ctx.fillStyle = '#ede5b2';
        for(let i=0;i<8;++i)ctx.fillRect(i*2,14,2,1);
        break;
      case 'grass':
        ctx.fillStyle = '#5dbb63';
        ctx.fillRect(0,0,16,16);
        ctx.strokeStyle = '#388e3c';
        for(let i=0;i<6;++i){
          ctx.beginPath();
          ctx.moveTo(3+i*2,12);ctx.lineTo(3+i*2,14);
          ctx.stroke();
        }
        break;
      case 'forest':
        ctx.fillStyle = '#4a7c39';
        ctx.fillRect(0,0,16,16);
        ctx.fillStyle = '#246b2a';
        for(let i=0;i<3;++i)ctx.beginPath(),ctx.arc(4+i*5,8,3,0,2*Math.PI),ctx.fill();
        break;
      case 'mountain':
        ctx.fillStyle = '#bbb9b9';
        ctx.fillRect(0,0,16,16);
        ctx.fillStyle = '#888';
        ctx.beginPath();ctx.moveTo(2,14);ctx.lineTo(8,4);ctx.lineTo(14,14);ctx.closePath();ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();ctx.moveTo(8,4);ctx.lineTo(10,8);ctx.lineTo(6,8);ctx.closePath();ctx.fill();
        break;
      case 'road':
        ctx.fillStyle = '#5dbb63';
        ctx.fillRect(0,0,16,16);
        ctx.fillStyle = '#a2855c'; // straight
        ctx.fillRect(6,0,4,16);
        break;
      case 'road_curve':
        ctx.fillStyle = '#5dbb63';
        ctx.fillRect(0,0,16,16);
        ctx.fillStyle = '#a2855c';
        ctx.fillRect(6,8,4,8);
        ctx.fillRect(8,6,8,4);
        ctx.beginPath();
        ctx.arc(8,8,6,Math.PI,1.5*Math.PI);
        ctx.strokeStyle = '#a2855c';
        ctx.lineWidth=4;
        ctx.stroke();
        break;
      case 'road_t':
        ctx.fillStyle = '#5dbb63';
        ctx.fillRect(0,0,16,16);
        ctx.fillStyle = '#a2855c';
        ctx.fillRect(6,0,4,16);
        ctx.fillRect(0,6,16,4);
        break;
      case 'road_cross':
        ctx.fillStyle = '#5dbb63';
        ctx.fillRect(0,0,16,16);
        ctx.fillStyle = '#a2855c';
        ctx.fillRect(6,0,4,16);
        ctx.fillRect(0,6,16,4);
        break;
    }
    tileArt[type] = c;
  });
}

// --- Terrain Generation ---
function getTileType(h, m, rng) {
  if (h < 0.32) return 'water';
  if (h < 0.36) return 'sand';
  if (h > 0.8) return 'mountain';
  if (m > 0.62) return 'forest';
  return 'grass';
}

// --- Road Auto-Tiling ---
function getRoadTile(x, y, roadMap) {
  // 4-connectivity: up, right, down, left
  let neighbors = [
    roadMap[x]?.[y-1], // up
    roadMap[x+1]?.[y], // right
    roadMap[x]?.[y+1], // down
    roadMap[x-1]?.[y], // left
  ];
  let bitmask = 0;
  for(let i=0; i<4; ++i) if(neighbors[i]) bitmask |= (1<<i);
  switch(bitmask) {
    case 0: case 1: case 4: case 5: return 'road'; // dead end/straight
    case 2: case 8: case 10: return 'road'; // straight
    case 3: case 6: case 9: case 12: return 'road_curve'; // curve
    case 7: case 11: case 13: case 14: return 'road_t'; // T junction
    case 15: return 'road_cross'; // cross
    default: return 'road';
  }
}

// --- Main Map Generation ---
function generateTileMap(seedStr, mapTiles) {
  let size = mapTiles;
  let heightMap = [], moistMap = [];
  let baseSeed = hashString(seedStr);
  let rng = mulberry32(baseSeed);
  // Generate height+moisture maps
  for(let x=0; x<size; x++) {
    heightMap[x] = [];
    moistMap[x] = [];
    for(let y=0; y<size; y++) {
      let nx = (x/size-0.5)*2, ny = (y/size-0.5)*2, dist = Math.sqrt(nx*nx+ny*ny);
      let h = 0.7*noise2D(x*0.08,y*0.08,rng) + 0.3*noise2D(x*0.17+4,y*0.17-4,rng);
      h = h/(0.7+0.3);
      h *= (1.0-0.65*dist);
      if (dist>1) h=0;
      heightMap[x][y]=h;
      let m = noise2D(x*0.13+100,y*0.13-50,rng)*0.8+0.2*(1-h);
      moistMap[x][y]=m;
    }
  }
  // Assign tiles
  let tileMap = [];
  for(let x=0;x<size;x++){
    tileMap[x]=[];
    for(let y=0;y<size;y++){
      tileMap[x][y]=getTileType(heightMap[x][y], moistMap[x][y], rng);
    }
  }
  // Place roads (simple: between two towns)
  let roadMap = [];
  for(let x=0;x<size;x++)roadMap[x]=Array(size).fill(false);
  // Place two towns far apart
  let tx1=4, ty1=4, tx2=size-5, ty2=size-5;
  if(size>24){
    tx1 = Math.floor(4+rng()*6);
    ty1 = Math.floor(4+rng()*6);
    tx2 = Math.floor(size-10+rng()*6);
    ty2 = Math.floor(size-10+rng()*6);
  }
  // Bresenham's line between towns
  function roadLine(x0,y0,x1,y1){
    let dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,err=dx-dy;
    while(true){
      roadMap[x0][y0]=true;
      if(x0===x1&&y0===y1)break;
      let e2=2*err;
      if(e2>-dy){err-=dy;x0+=sx;}
      if(e2<dx){err+=dx;y0+=sy;}
      if(x0<0||y0<0||x0>=size||y0>=size)break;
    }
  }
  roadLine(tx1,ty1,tx2,ty2);
  // Blend roads into tileMap
  for(let x=0;x<size;x++)for(let y=0;y<size;y++){
    if(roadMap[x][y]) tileMap[x][y]='road';
  }
  // Road auto-tiling
  for(let x=0;x<size;x++)for(let y=0;y<size;y++){
    if(tileMap[x][y]==='road') tileMap[x][y]=getRoadTile(x,y,roadMap);
  }
  // Return: {tileMap, towns:[{x,y}], size}
  return {tileMap, towns:[{x:tx1,y:ty1},{x:tx2,y:ty2}], size};
}

// --- Simple Hash Noise for demo ---
function noise2D(x, y, rng) {
  let s = Math.sin(x*127.1+y*311.7)*43758.5453123;
  return (s-Math.floor(s))*0.5 + 0.5*rng();
}

// --- Draw Map ---
function drawTileMap(mapObj) {
  let canvas = document.getElementById('mapCanvas');
  let px = mapObj.size*TILE_SIZE;
  canvas.width = px; canvas.height = px;
  let ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,px,px);
  for(let x=0;x<mapObj.size;x++){
    for(let y=0;y<mapObj.size;y++){
      let tile = mapObj.tileMap[x][y];
      ctx.drawImage(tileArt[tile], x*TILE_SIZE, y*TILE_SIZE);
    }
  }
  // Draw towns as red squares
  for(let t of mapObj.towns){
    ctx.fillStyle='#c81b1b';
    ctx.fillRect(t.x*TILE_SIZE+4, t.y*TILE_SIZE+4, 8, 8);
    ctx.strokeStyle='#fff';ctx.lineWidth=2;
    ctx.strokeRect(t.x*TILE_SIZE+4, t.y*TILE_SIZE+4, 8, 8);
  }
}

// --- UI ---
function updateMap() {
  const seed = document.getElementById('seedInput').value;
  let size = parseInt(document.getElementById('sizeInput').value,10);
  size = Math.max(8, Math.min(128, size));
  const mapObj = generateTileMap(seed, size);
  drawTileMap(mapObj);
}

makeTiles();
document.getElementById('generateBtn').onclick = updateMap;
window.onload = updateMap;