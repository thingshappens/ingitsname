import { readFile } from 'node:fs/promises';

const queue = JSON.parse(await readFile(new URL('../marketing/content-queue.json', import.meta.url), 'utf8'));

const phase = process.argv[2] || 'pre-launch';
const item = queue.items.find(entry => entry.phase === phase && entry.status === 'ready');

if (!item) {
  console.log(`No ready ${phase} content item. Check marketing/content-queue.json.`);
  process.exit(0);
}

console.log(`HSC CONTENT BRIEF — ${item.id}`);
console.log(`Platforms: ${queue.platforms.join(' · ')}`);
console.log(`Format: ${item.format}`);
console.log(`Hook: ${item.hook}`);
console.log('Frames:');
item.frames.forEach((frame, index) => console.log(`${index + 1}. ${frame}`));
console.log(`Asset: ${item.asset}`);
console.log(`Caption: ${item.caption}`);
console.log(`CTA: ${item.phase === 'launch' ? queue.launchCta : queue.defaultCta}`);
console.log(`Hashtags: ${item.hashtags.join(' ')}`);
