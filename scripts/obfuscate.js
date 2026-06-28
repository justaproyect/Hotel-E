const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

function obfuscateDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      obfuscateDirectory(fullPath);
    } else if (entry.name.endsWith('.js')) {
      const code = fs.readFileSync(fullPath, 'utf8');
      const obfuscated = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.4,
        debugProtection: true,
        disableConsoleOutput: false,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        rotateStringArray: true,
        selfDefending: true,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75,
        transformObjectKeys: true,
        unicodeEscapeSequence: false,
      });
      fs.writeFileSync(fullPath, obfuscated.getObfuscatedCode(), 'utf8');
      console.log(`[Obfuscated] ${path.relative(distDir, fullPath)}`);
    }
  }
}

console.log('Starting obfuscation...');
obfuscateDirectory(distDir);
console.log('Obfuscation complete.');
