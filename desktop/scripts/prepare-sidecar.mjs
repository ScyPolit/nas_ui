import { copyFile, mkdir, readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

const target = process.env.TAURI_TARGET || process.argv[2]
if (!target) throw new Error('请通过 TAURI_TARGET 或参数指定 Rust target triple')

const windows = target.includes('windows')
const source = resolve('..', 'target', target, 'release', `dufs${windows ? '.exe' : ''}`)
const fallback = resolve('..', 'target', 'release', `dufs${windows ? '.exe' : ''}`)
const input = await stat(source).then(() => source).catch(() => fallback)
const output = resolve('src-tauri', 'binaries', `dufs-${target}${windows ? '.exe' : ''}`)
const bytes = await readFile(input)

function assertArchitecture() {
  if (windows) {
    if (bytes[0] !== 0x4d || bytes[1] !== 0x5a) throw new Error('Sidecar 不是有效的 Windows PE 文件')
    const pe = bytes.readUInt32LE(0x3c)
    const machine = bytes.readUInt16LE(pe + 4)
    const expected = target.startsWith('aarch64') ? 0xaa64 : 0x8664
    if (machine !== expected) throw new Error(`Sidecar PE 架构不匹配: 0x${machine.toString(16)}`)
    return
  }
  if (target.includes('apple')) {
    const magic = bytes.readUInt32BE(0)
    if (![0xfeedfacf, 0xcffaedfe, 0xcafebabe, 0xbebafeca].includes(magic)) throw new Error('Sidecar 不是有效的 Mach-O 文件')
    return
  }
  if (bytes[0] !== 0x7f || bytes.toString('ascii', 1, 4) !== 'ELF') throw new Error('Sidecar 不是有效的 ELF 文件')
  const machine = bytes.readUInt16LE(18)
  const expected = target.startsWith('aarch64') ? 183 : 62
  if (machine !== expected) throw new Error(`Sidecar ELF 架构不匹配: ${machine}`)
}

assertArchitecture()
await mkdir(dirname(output), { recursive: true })
await copyFile(input, output)
console.log(`Sidecar ready: ${output} (${bytes.length} bytes, ${target})`)
