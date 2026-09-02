const {isOwner,setOwnerSession}=require('../lib/owner');

module.exports=async function(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!process.env.ELEVENLABS_API_KEY)return res.status(503).json({error:'Voice engine is not connected yet'});
  const voiceResponse=await fetch('https://api.elevenlabs.io/v1/voices',{headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY}});
  const data=await voiceResponse.json();
  if(!voiceResponse.ok)return res.status(502).json({error:data.detail?.message||'Could not load voices'});
  const owner=isOwner(req,req.body?.code);
  if(owner&&req.body?.code)setOwnerSession(res);
  return res.status(200).json({owner,voices:(data.voices||[]).map(({voice_id,name,labels})=>({voice_id,name,labels}))});
};
