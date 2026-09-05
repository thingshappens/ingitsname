const Stripe=require('stripe');
const {createService}=require('./service');
function createWebhook({service=createService(),env=process.env}={}){
  return async function(req,res){
    if(req.method!=='POST')return res.status(405).end();
    const secret=env.THE_EDIT_WEBHOOK_SECRET,key=env.THE_EDIT_STRIPE_SECRET_KEY;
    if(!secret||!key)return res.status(503).end();
    let event;
    try{
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>1024*1024)return res.status(413).end();chunks.push(chunk);}
      const stripe=new Stripe(key);
      event=stripe.webhooks.constructEvent(Buffer.concat(chunks),req.headers['stripe-signature'],secret);
      if(event.livemode!==(env.VERCEL_ENV==='production'))return res.status(400).end();
      if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))await service.paid(event.data.object,stripe);
      return res.status(200).json({received:true});
    }catch(error){return res.status(event?503:400).json({error:event?'Delivery will retry':'Invalid webhook'});}
  };
}
module.exports={createWebhook};
