import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

export function validatePlugin(root, schema) {
  function walk(path) {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
      throw new Error(`Package policy forbids symlinks: ${path}`);
    }
    if (stat.isDirectory()) {
      for (const entry of readdirSync(path)) walk(join(path, entry));
    } else if (!stat.isFile()) {
      throw new Error(`Package contains a non-regular file: ${path}`);
    }
  }
  walk(root);
  const validate = new Ajv2020({ allErrors: true }).compile(schema);
  const manifest = JSON.parse(readFileSync(join(root, 'plugin.json'), 'utf8'));
  if (!validate(manifest)) {
    throw new Error(`Invalid plugin manifest: ${JSON.stringify(validate.errors)}`);
  }
  const skills = join(root, 'skills');
  if (!lstatSync(skills).isDirectory()) throw new Error('skills must be a directory');
  const discovered = readdirSync(skills).filter((entry) =>
    lstatSync(join(skills, entry)).isDirectory());
  if (discovered.length === 0) throw new Error('Expected at least one packaged skill');
  for (const skill of discovered) {
    if (!lstatSync(join(skills, skill, 'SKILL.md')).isFile()) {
      throw new Error(`Missing immediate-child skill entrypoint: ${skill}`);
    }
    if (!lstatSync(join(skills, skill, 'LICENSE')).isFile()) {
      throw new Error(`Missing skill license: ${skill}`);
    }
  }
  return { name: manifest.name, skills: discovered };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const schema = JSON.parse(readFileSync('.cache/plugin.schema.json', 'utf8'));
  console.log(JSON.stringify(validatePlugin('green-software', schema), null, 2));
}
