import { readFile } from 'node:fs/promises'

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)))
const tauri = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url)))
const cargo = await readFile(new URL('../src-tauri/Cargo.toml', import.meta.url), 'utf8')
const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1]
const tag = process.env.RELEASE_TAG
if (pkg.version !== tauri.version || pkg.version !== cargoVersion) {
  throw new Error(`版本不一致: package=${pkg.version}, tauri=${tauri.version}, cargo=${cargoVersion}`)
}
if (tag && tag !== `desktop-v${pkg.version}`) throw new Error(`标签 ${tag} 与 desktop-v${pkg.version} 不一致`)
console.log(`Desktop version ${pkg.version} is consistent`)
