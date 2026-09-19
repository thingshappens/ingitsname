const { isCreditStoreConfigured } = require('../lib/credits');

module.exports=async function(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const requested=process.env.PRODUCER_PACK_ENABLED==='true';
  const paddleReady=Boolean(process.env.PADDLE_API_KEY&&process.env.PADDLE_PRICE_ATELIER_4);
  const paddlePackReady=Boolean(process.env.PADDLE_API_KEY&&process.env.PADDLE_PRICE_ATELIER_PACK);
  const checkoutReady=Boolean(process.env.STRIPE_SECRET_KEY||paddleReady);
  const producerPackCheckoutReady=Boolean(requested&&(process.env.STRIPE_SECRET_KEY||paddlePackReady)&&isCreditStoreConfigured());
  return res.status(200).json({
    producerPackEnabled:requested,
    checkoutReady,
    producerPackCheckoutReady,
    generationAvailable:process.env.EXTERNAL_GENERATION_ENABLED!=='false'
  });
};
