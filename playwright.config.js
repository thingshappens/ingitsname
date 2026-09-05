const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'./test/browser',use:{baseURL:'http://127.0.0.1:4173',headless:true},webServer:{command:'npm run dev -- --port 4173',url:'http://127.0.0.1:4173/edit/',reuseExistingServer:true},reporter:'list'});
