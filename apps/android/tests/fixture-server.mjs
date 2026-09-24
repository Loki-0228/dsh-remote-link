import http from 'node:http'
import { NotificationHub } from '../../../native-notifications/core.mjs'
const hub = new NotificationHub()
const html = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>会话显示测试</title><style>body{margin:20px;font:16px sans-serif;background:#f7f8fb;color:#202734}textarea{box-sizing:border-box;width:100%;height:110px;font:16px sans-serif}main{max-width:900px;margin:auto}</style><main><h2>远程会话测试</h2><p>这是一张测试页面，用于验证旋转后仍显示会话并保留草稿。</p><textarea id="draft" placeholder="在这里输入"></textarea><p id="viewport"></p></main><script>window.instance=String(Math.random());function update(){document.getElementById("viewport").textContent="可用宽度 "+innerWidth+"，高度 "+innerHeight}addEventListener("resize",update);update()</script>'
http.createServer(async (req,res)=>{
  const u=new URL(req.url,'http://localhost')
  if(u.pathname==='/pair-app'){res.writeHead(200,{'content-type':'text/html;charset=utf-8'});res.end(html);return}
  const json=(code,value)=>{res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(value))}
  if(req.headers['x-dsh-remote-device']!=='emulator-test')return json(403,{error:'fixture authorization required'})
  if(u.pathname==='/emit'){
    let raw='';for await(const chunk of req)raw+=chunk
    const input=JSON.parse(raw)
    if(input.kind==='approval'||input.kind==='question')hub.addPending({...input,id:input.id||'pending-fixture'},async()=>{})
    else hub.publish(input)
    return json(200,{cursor:hub.sequence})
  }
  if(u.pathname==='/api/remote-notifications/poll'){
    await new Promise(r=>setTimeout(r,250))
    return json(200,hub.snapshot(u.searchParams.get('epoch')||'',Number(u.searchParams.get('after')||0)))
  }
  json(404,{error:'not found'})
}).listen(48775,'127.0.0.1',()=>console.log('Android notification fixture ready on loopback 48775'))