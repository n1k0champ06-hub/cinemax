const fs = require('fs');
const path = require('path');
const fflate = require('fflate');

const extDir = path.join(__dirname, '../public/cinemax-extension');
const manifest = fs.readFileSync(path.join(extDir, 'manifest.json'));
const content = fs.readFileSync(path.join(extDir, 'content.js'));
const popupHtml = fs.readFileSync(path.join(extDir, 'popup.html'));
const popupJs = fs.readFileSync(path.join(extDir, 'popup.js'));

const zipData = fflate.zipSync({
  'manifest.json': new Uint8Array(manifest),
  'content.js': new Uint8Array(content),
  'popup.html': new Uint8Array(popupHtml),
  'popup.js': new Uint8Array(popupJs)
});

fs.writeFileSync(path.join(__dirname, '../public/cinemax-extension.zip'), zipData);
console.log('Successfully zipped extension to public/cinemax-extension.zip');
