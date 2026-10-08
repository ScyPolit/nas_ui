export async function filesFromDataTransfer(transfer: DataTransfer): Promise<File[]> {
  const entries = [...transfer.items]
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => entry !== null && entry !== undefined)
  if (!entries.length) return [...transfer.files]
  const files: File[] = []
  for (const entry of entries) await visit(entry, '', files)
  return files
}

async function visit(entry: FileSystemEntry, parent: string, output: File[]): Promise<void> {
  const relativePath = parent ? `${parent}/${entry.name}` : entry.name
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry
    const file = await new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject))
    try {
      Object.defineProperty(file, 'webkitRelativePath', { configurable: true, value: relativePath })
    } catch {
      // Browsers that expose a non-configurable property still upload the file itself.
    }
    output.push(file)
    return
  }
  if (!entry.isDirectory) return
  const reader = (entry as FileSystemDirectoryEntry).createReader()
  while (true) {
    const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
    if (!entries.length) break
    for (const child of entries) await visit(child, relativePath, output)
  }
}
