const esbuild = require('esbuild');
esbuild.buildSync({ entryPoints: ['.validation/core-tests.ts'], outfile: '.validation/core-tests.mjs', bundle:true, platform:'node', format:'esm' });
