const {settings,createService}=require('../lib/edit/service');
const {voices,InputError,STYLES,filename}=require('../lib/edit/model');
const store=require('../lib/edit/store');
const service=createService();
module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
  const action=req.query?.action;
  try{
    if(req.method==='GET'&&action==='config'){
      let enabled=false;try{settings();enabled=true;}catch{}
      return res.status(200).json({termsUrl:process.env.THE_EDIT_TERMS_URL||null,enabled,preview:process.env.VERCEL_ENV!=='production',voices:voices().map(v=>({id:v.id,name:v.name})),message:enabled?'':'The Edit is being prepared. Orders are not open yet.'});
    }
    if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
    if(action==='checkout'){
      const config=settings();
      if(req.headers.origin!==config.origin)return res.status(403).json({error:'Invalid origin'});
      const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0];
      if(!await store.rateLimit(ip))return res.status(429).json({error:'Please try again later.'});
      const {requestId,accessToken,...selection}=req.body||{};
      return res.status(200).json(await service.checkout(selection,requestId,accessToken,config));
    }
    if(!['status','download'].includes(action))return res.status(404).json({error:'Not found'});
    const {orderId,accessToken,cutId}=req.body||{};
    if(typeof orderId!=='string'||!/^[a-f0-9-]{36}$/.test(orderId))return res.status(403).json({error:'Order link is invalid'});
    const order=await service.authorized(orderId,accessToken);if(!order)return res.status(403).json({error:'Order link is invalid'});
    if(action==='status')return res.status(200).json({id:order.id,status:order.status,error:order.lastError,expiresAt:order.downloadExpiresAt,cuts:order.cuts.map(c=>({id:c.id,name:STYLES[c.style],groove:c.groove,cutAmount:c.cutAmount,renderStatus:c.renderStatus,filename:filename(c,order.bpm)}))});
    if(order.status!=='ready')return res.status(409).json({error:'Your cuts are not ready yet.'});
    if(order.downloadExpiresAt<Date.now())return res.status(410).json({error:'This download has expired. Please contact HSC with your order number.'});
    let body,name;
    {
      const cut=order.cuts.find(c=>c.id===cutId);if(!cut)return res.status(404).json({error:'Cut not found'});
      body=await store.audio(cut.asset);name=filename(cut,order.bpm);res.setHeader('Content-Type','audio/wav');
    }
    res.setHeader('Content-Disposition',`attachment; filename="${name}"`);return res.status(200).send(body);
  }catch(error){return res.status(error instanceof InputError?400:503).json({error:error instanceof InputError?error.message:'The Edit is temporarily unavailable. Please try again shortly.'});}
};
