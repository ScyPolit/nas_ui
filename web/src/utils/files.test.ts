import { describe, expect, it } from 'vitest'
import { categoryOf, isDirectory, joinPath, parentPath, previewKind } from '@/utils/files'

describe('file helpers', () => {
  it('classifies previews and storage categories consistently', () => {
    expect(categoryOf('照片.JPG')).toBe('image')
    expect(categoryOf('报告.docx')).toBe('document')
    expect(previewKind('README.md')).toBe('markdown')
    expect(previewKind('app.ts')).toBe('code')
  })

  it('normalizes relative paths without adding absolute segments', () => {
    expect(joinPath('/中文目录/', '子目录', '文件.txt')).toBe('中文目录/子目录/文件.txt')
    expect(parentPath('中文目录/子目录/文件.txt')).toBe('中文目录/子目录')
  })

  it('recognizes real and symbolic-link directories', () => {
    expect(isDirectory({ name: 'a', path_type: 'Dir', mtime: 0, size: 0 })).toBe(true)
    expect(isDirectory({ name: 'a', path_type: 'SymlinkDir', mtime: 0, size: 0 })).toBe(true)
    expect(isDirectory({ name: 'a', path_type: 'File', mtime: 0, size: 0 })).toBe(false)
  })
})
