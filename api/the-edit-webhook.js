const {createWebhook}=require('../lib/edit/webhook');
module.exports=createWebhook();
module.exports.config={api:{bodyParser:false}};
