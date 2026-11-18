import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)

// Execute TypeScript under Node without loading Electron or launching media tools.
export function createSourceLoader(stubs = {}) {
  const cache = new Map()
  return function load(filePath, extraExports = []) {
    const file = path.resolve(filePath)
    if (cache.has(file)) return cache.get(file).exports
    const source = readFileSync(file, 'utf8') + (extraExports.length ? `\nexport { ${extraExports.join(', ')} };` : '')
    const compiled = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
    }).outputText
    const module = { exports: {} }
    cache.set(file, module)
    const localRequire = (specifier) => {
      if (Object.hasOwn(stubs, specifier)) return stubs[specifier]
      if (specifier === 'electron' || specifier === 'node:child_process') throw new Error(`Unexpected runtime dependency: ${specifier}`)
      if (specifier.startsWith('.')) {
        const base = path.resolve(path.dirname(file), specifier)
        const target = [base, `${base}.ts`, `${base}.tsx`].find(existsSync)
        if (!target) throw new Error(`Cannot resolve ${specifier} from ${file}`)
        return load(target)
      }
      return require(specifier)
    }
    new Function('require', 'module', 'exports', '__filename', '__dirname', compiled)(localRequire, module, module.exports, file, path.dirname(file))
    return module.exports
  }
}

export function fixtureProject(id = 'project-a', title = '测试工程') {
  return {
    version: 1, id, title, workspaceRoot: '', createdAt: '2026-11-18T00:00:00Z', updatedAt: '2026-11-18T00:00:00Z',
    exportPresetId: 'douyin-1080p', durationSeconds: 10,
    tracks: [{ id: 'visual-main', name: '背景', kind: 'visual', groupId: 'background', locked: false, muted: false }],
    timeline: [], assets: [], script: '', aiRecords: [],
    subtitleStyle: { fontFamily: 'Arial', fontSize: 50, color: '#ffffff', outlineColor: '#111111', outlineWidth: 3, position: 'bottom', background: false, backgroundColor: '#111827' }
  }
}
