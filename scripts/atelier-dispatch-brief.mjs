import { readFile } from 'node:fs/promises';

const source = new URL('../marketing/atelier-dispatch.json', import.meta.url);
const dispatch = JSON.parse(await readFile(source, 'utf8'));
const item = dispatch.items.find(({ status, contentType }) => status === 'ready' && dispatch.contentTypes[contentType]?.enabled);

if (!item) {
  console.log('No ready Atelier Dispatch item. Vocal Cuts are the only enabled v1 format.');
  process.exit(0);
}

const type = dispatch.contentTypes[item.contentType];
const replace = value => value
  .replace('{name}', item.name)
  .replace('{bpm}', String(item.bpm))
  .replace('{character}', item.character);

console.log(`${type.label} · ${dispatch.videoTemplate.format} · ${dispatch.videoTemplate.durationSeconds}s`);
console.log(`Name: ${item.name}`);
console.log(`BPM: ${item.bpm}`);
console.log(`Character: ${item.character}`);
console.log(`Outputs: ${item.outputs.join(' · ')}`);
console.log(`Frames:\n${type.videoSequence.map(replace).join('\n')}`);
console.log(`Caption: ${item.caption}`);
console.log(`CTA: ${item.cta}`);
