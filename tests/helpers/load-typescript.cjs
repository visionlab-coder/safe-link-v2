const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');

// Execute repository modules with explicit, local test doubles; never loads env files or API keys.
module.exports = function createLoader(stubs = {}) {
    const cache = new Map();
    function load(file) {
        file = path.resolve(file);
        if (cache.has(file)) return cache.get(file).exports;
        if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
        const mod = { exports: {} };
        cache.set(file, mod);
        const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, resolveJsonModule: true },
        }).outputText;
        const localRequire = name => {
            if (Object.hasOwn(stubs, name)) return stubs[name];
            if (name.startsWith('@/') || name.startsWith('.')) {
                let target = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(file), name);
                if (!path.extname(target)) target += '.ts';
                return load(target);
            }
            return require(name);
        };
        new Function('require', 'module', 'exports', code)(localRequire, mod, mod.exports);
        return mod.exports;
    }
    return file => load(path.resolve(root, file));
};
