const fs = require('fs');
const path = require('path');

const fixFile = (file) => {
  if (fs.statSync(file).isDirectory()) {
    return fs.readdirSync(file).forEach(subFile => fixFile(path.join(file, subFile)));
  }
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return;
  
  let content = fs.readFileSync(file, 'utf8');
  
  content = content.replace(/(`https:\/\/image\.tmdb\.org\/t\/p\/[^`\$]+\$\{([^}]+)\}`)/g, (match, fullString, varName) => {
      const matchUrl = fullString.match(/https:\/\/image\.tmdb\.org\/t\/p\/[a-zA-Z0-9_]+/)[0];
      return `(${varName}?.startsWith('http') ? ${varName} : \`${matchUrl}/\${${varName}?.split('/').pop()}\`)`;
  });
  
  content = content.replace(/"https:\/\/image\.tmdb\.org\/t\/p\/[^\"]+"\s*\+\s*([^ \)\n]+)/g, (match, varName) => {
      return `(${varName}?.startsWith('http') ? ${varName} : ${match})`;
  });

  fs.writeFileSync(file, content);
};

fixFile(path.join(process.cwd(), 'src'));

console.log("Images fixed.");
