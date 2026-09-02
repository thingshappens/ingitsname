module.exports=async function(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const requested=process.env.PRODUCER_PACK_ENABLED!=='false';
  return res.status(200).json({
    producerPackEnabled:requested,
    producerPackCheckoutReady:false
  });
};
