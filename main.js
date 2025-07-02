// Simple LCG for deterministic random numbers from a string seed
function seededRandom(seed) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return function() {
    // LCG parameters from Numerical Recipes
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
}

// Tiny wordlist for fun 90s vibes
const WORDS = [
  "flux", "neon", "matrix", "byte", "giga", "hacker", "modem", "cyber",
  "mainframe", "phreak", "shell", "ascii", "pixel", "terminal", "boot", "dos",
  "synth", "vapor", "disk", "kernel", "bit", "ram", "sprite", "glitch", "script"
];

// Local fallback facts
const LOCAL_FACTS = [
  "ASCII stands for American Standard Code for Information Interchange.",
  "The first computer virus for MS-DOS was called Brain (1986).",
  "The World Wide Web was invented in 1989.",
  "The GIF image format was introduced in 1987.",
  "Wikipedia was launched in 2001.",
  "OEIS, the Online Encyclopedia of Integer Sequences, started in 1964.",
  "The Commodore 64 was released in 1982.",
  "In hexadecimal, 255 is FF.",
  "Phreaking was a form of hacking phone systems in the 80s and 90s.",
  "Y2K was a big scare for computer systems in 1999."
];

// Fetch a random fact from Numbers API (CORS enabled)
// If not available, fallback to local fact
async function randomFact(rng) {
  // Use rng to pick a number fact
  const number = Math.floor(rng() * 1000);
  try {
    const resp = await fetch(`https://numbersapi.com/${number}/trivia?notfound=floor&json`);
    if (resp.ok) {
      const data = await resp.json();
      return data.text;
    }
  } catch (_) {}
  // Fallback local fact
  return LOCAL_FACTS[Math.floor(rng() * LOCAL_FACTS.length)];
}

async function generate(seed) {
  if (!seed) return "Please enter a seed.";
  const rng = seededRandom(seed);

  // Random words
  let words = [];
  for (let i = 0; i < 2; i++) {
    words.push(WORDS[Math.floor(rng() * WORDS.length)]);
  }

  // Random numbers
  let numbers = [];
  for (let i = 0; i < 2; i++) {
    numbers.push(Math.floor(rng() * 100000));
  }

  // Random fact
  const fact = await randomFact(rng);

  // Output
  return (
    `Random Words: ${words.join(', ')}\n` +
    `Random Numbers: ${numbers.join(', ')}\n` +
    `Random Fact: ${fact}`
  );
}

document.getElementById("seedForm").onsubmit = async (e) => {
  e.preventDefault();
  const input = document.getElementById("seedInput").value;
  const output = document.getElementById("output");
  output.textContent = "...generating...";
  const result = await generate(input);
  output.textContent = result;
};