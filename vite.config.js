const {defineConfig}=require('vite');
const {resolve}=require('node:path');
module.exports=defineConfig({build:{rollupOptions:{input:{atelier:resolve(__dirname,'index.html'),edit:resolve(__dirname,'edit/index.html')}}}});
