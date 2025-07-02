// Seeded RNG
function seededRandom(seed) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return function() {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
}

// Wordlist and facts
const WORDS = [
  "matrix","byte","flux","neon","hacker","modem","cyber","ascii","sprite","glitch","phreak","shell",
  "mainframe","vapor","synth","boot","ram","disk","pixel","demoscene","script","bit","kernel"
];

const LOCAL_FACTS = [
  "ASCII stands for American Standard Code for Information Interchange.",
  "The Commodore 64 was released in 1982.",
  "The GIF image format was introduced in 1987.",
  "The World Wide Web was invented in 1989.",
  "Phreaking was a form of hacking phone systems.",
  "OEIS is the Online Encyclopedia of Integer Sequences.",
  "In hexadecimal, 255 is FF.",
  "The Y2K bug was a major computer event in 1999.",
  "The first computer virus for MS-DOS was called Brain.",
  "Wikipedia was launched in 2001."
];

const LOCAL_BIOS = [
  "Name: Alex Matrix\nOccupation: Net Surfer\nBio: Lives in a world of code and neon. Spends nights cracking mainframes and days dreaming in hexadecimal.",
  "Name: Sam Phreak\nOccupation: Phone Hacker\nBio: Known for blue boxing in the 80s. Still owns a rotary phone and a stack of floppy disks.",
  "Name: Casey Byte\nOccupation: Demo Coder\nBio: Writes code that makes machines dance. Can optimize a Mandelbrot zoom faster than you can say 'DOS prompt'.",
  "Name: Jamie Synth\nOccupation: Cyber DJ\nBio: Mixes beats and bits. Favorite instrument: the SID chip.",
];

// Random number of lines/words to fill the screen
function getAmount(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Randomly pick a mode
function pickMode(rng) {
  // 0: words, 1: numbers, 2: facts, 3: bio
  return Math.floor(rng() * 4);
}

// Fetch a random number fact (with fallback)
async function getFact(rng) {
  const number = Math.floor(rng() * 10000);
  try {
    const resp = await fetch(`https://numbersapi.com/${number}/trivia?notfound=floor&json`);
    if (resp.ok) {
      const data = await resp.json();
      return data.text;
    }
  } catch (_) {}
  return LOCAL_FACTS[Math.floor(rng() * LOCAL_FACTS.length)];
}

// Fetch a random biography (with fallback)
async function getBio(rng) {
  // Try Wikidata: random person born before 2000, in English
  const example = LOCAL_BIOS[Math.floor(rng() * LOCAL_BIOS.length)];
  try {
    // Use a deterministic QID based on seed
    const qids = [
      "Q937",   // Albert Einstein
      "Q5582",  // Ada Lovelace
      "Q7259",  // Alan Turing
      "Q8004",  // Grace Hopper
      "Q8016",  // Linus Torvalds
      "Q472",   // Bill Gates
      "Q312",   // Steve Jobs
      "Q159",   // Isaac Newton
      "Q937857",// John von Neumann
      "Q30558"  // Margaret Hamilton
    ];
    const qid = qids[Math.floor(rng() * qids.length)];
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
    const resp = await fetch(url);
    if (!resp.ok) return example;
    const data = await resp.json();
    const entity = data.entities[qid];
    const label = entity.labels.en.value;
    const desc = entity.descriptions.en.value;
    let bio = `${label}\n${desc}\n`;
    // Get birthdate and occupation if available
    let birth = "";
    let jobs = [];
    if (entity.claims.P569 && entity.claims.P569[0] && entity.claims.P569[0].mainsnak.datavalue) {
      birth = entity.claims.P569[0].mainsnak.datavalue.value.time;
    }
    if (entity.claims.P106) {
      for (let j of entity.claims.P106) {
        const jobid = j.mainsnak.datavalue.value.id;
        if (data.entities[jobid] && data.entities[jobid].labels.en)
          jobs.push(data.entities[jobid].labels.en.value);
      }
    }
    if (birth) bio += `Born: ${birth}\n`;
    if (jobs.length) bio += `Occupation: ${jobs.join(", ")}\n`;
    return bio;
  } catch (_) {
    return example;
  }
}

// Generation logic
async function generate(seed) {
  const rng = seededRandom(seed);
  const mode = pickMode(rng);

  if (mode === 0) {
    // Words
    let n = getAmount(rng, 40, 80);
    let words = [];
    for (let i = 0; i < n; i++) {
      words.push(WORDS[Math.floor(rng() * WORDS.length)]);
    }
    return words.join(" ");
  }
  if (mode === 1) {
    // Numbers
    let n = getAmount(rng, 60, 120);
    let nums = [];
    for (let i = 0; i < n; i++) {
      nums.push(Math.floor(rng() * 100000));
    }
    return nums.join(" ");
  }
  if (mode === 2) {
    // Facts
    let n = getAmount(rng, 10, 14);
    let facts = [];
    for (let i = 0; i < n; i++) {
      // To keep things instant, only fetch 1 fact, rest from local
      if (i === 0) {
        facts.push(await getFact(rng));
      } else {
        facts.push(LOCAL_FACTS[Math.floor(rng() * LOCAL_FACTS.length)]);
      }
    }
    return facts.join("\n\n");
  }
  if (mode === 3) {
    // Biography
    return await getBio(rng);
  }
}

// DOM logic
const form = document.getElementById("seedForm");
form.onsubmit = async (e) => {
  e.preventDefault();
  const v = document.getElementById("seedInput").value;
  document.body.innerHTML = `<div id="output">...</div>`;
  const out = document.getElementById("output");
  out.textContent = await generate(v);
};