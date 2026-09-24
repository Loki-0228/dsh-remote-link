import test from 'node:test'
import { registerHooks } from 'node:module'
import assert from 'node:assert/strict'
import { generateKeyPairSync, verify } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { ApnsBridge, ApnsProvider, deviceHash, pushPayload, validateSubscription } from '../src/apns.mjs'

const subscription = { token:'ab'.repeat(32),topic:'com.dsh.remote',environment:'production',disabled:[],brief:true,previewContent:true }
const event = { id:'event1',kind:'task-completed',title:'DeepSeek 本轮已结束',taskTitle:'导出报表',summary:'已生成 120 行',body:'完整结果',time:Date.now(),sessionId:'session1' }
const directory = () => mkdtempSync(join(tmpdir(),'dsh-apns-test-'))
function hubFixture() {
  let cursor=0;const events=[];const pending=[];const listeners=new Set()
  return {
    snapshot(epoch='',after=0){return {epoch:'test',cursor,reset:epoch!=='test',events:events.filter(e=>e.seq>after),pending:[...pending]}},
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},
    publish(input){events.push({...input,seq:++cursor});for(const fn of listeners)fn()},
    pending,
  }
}
const flush = async bridge => {await Promise.all([...bridge.queues.values()])}
test('ES256 JWT signature, claims and bounded token cache',()=>{
  const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'})
  const provider=new ApnsProvider({teamId:'TEAM123456',keyId:'KEY1234567',topic:'com.dsh.remote',key:privateKey.export({type:'pkcs8',format:'pem'})})
  const value=provider.authorization(100000000),[header,claims,signature]=value.split('.')
  assert.equal(JSON.parse(Buffer.from(header,'base64url')).alg,'ES256')
  assert.equal(JSON.parse(Buffer.from(claims,'base64url')).iss,'TEAM123456')
  assert.ok(verify('sha256',Buffer.from(header+'.'+claims),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')))
  assert.equal(provider.authorization(100000001),value)
  assert.notEqual(provider.authorization(103000000),value)
})
test('validation, content privacy and Apple payload bound',()=>{
  assert.throws(()=>validateSubscription({...subscription,environment:'other'}))
  assert.throws(()=>validateSubscription({...subscription,token:'not-a-token'}))
  assert.throws(()=>validateSubscription({...subscription,disabled:['anything']}))
  const visible=pushPayload(event,subscription)
  assert.equal(visible.aps.alert.title,'本轮结束 · 导出报表')
  assert.equal(visible.aps.alert.body,'已生成 120 行')
  const hidden=JSON.stringify(pushPayload(event,{...subscription,previewContent:false}))
  assert.ok(!hidden.includes('导出报表'));assert.ok(!hidden.includes('session1'))
  assert.ok(Buffer.byteLength(JSON.stringify(pushPayload({...event,body:'字'.repeat(10000),summary:'',title:'字'.repeat(500)}, {...subscription,brief:false})))<=4096)
})
test('new events only; disabled kinds and revoked devices do not receive pushes',async()=>{
  const dir=directory();const hub=hubFixture();const delivered=[];let live=true
  hub.publish({...event,id:'old'})
  const bridge=new ApnsBridge({directory:dir,getHub:()=>hub,isLive:()=>live,enabled:()=>true,provider:{topic:'com.dsh.remote'},sender:async(s,e)=>{delivered.push(e.id);return {status:200}}})
  const key=deviceHash('paired-secret')
  try {
    bridge.register(key,{...subscription,disabled:['task-started']});bridge.start()
    hub.publish({...event,id:'start',kind:'task-started'})
    hub.publish({...event,id:'new'});await flush(bridge)
    assert.deepEqual(delivered,['new'])
    const saved=readFileSync(join(dir,'devices.json'),'utf8')
    assert.ok(!saved.includes('paired-secret'))
    live=false;hub.publish({...event,id:'revoked'});await flush(bridge)
    assert.deepEqual(delivered,['new']);assert.equal(bridge.devices.size,0)
  } finally {bridge.dispose();rmSync(dir,{recursive:true,force:true})}
})
test('queue rechecks cancellation and unregister; invalid APNs tokens are removed',async()=>{
  const dir=directory();const hub=hubFixture();const delivered=[];const key=deviceHash('device')
  const bridge=new ApnsBridge({directory:dir,getHub:()=>hub,isLive:()=>true,enabled:()=>true,provider:{topic:'com.dsh.remote'},sender:async(s,e)=>{delivered.push(e.id);return {status:410,reason:'Unregistered'}}})
  try {
    bridge.register(key,subscription);bridge.start()
    hub.pending.push({id:'request'})
    hub.publish({...event,id:'cancelled',kind:'approval',requestId:'request'})
    hub.pending.length=0;await flush(bridge);assert.equal(delivered.length,0)
    hub.publish({...event,id:'unregistered'});bridge.unregister(key);await flush(bridge);assert.equal(delivered.length,0)
    bridge.register(key,subscription);hub.publish(event);await flush(bridge)
    assert.deepEqual(delivered,['event1']);assert.equal(bridge.devices.size,0)
  } finally {bridge.dispose();rmSync(dir,{recursive:true,force:true})}
})
test('HTTP push routes require paired same-origin devices and isolate registrations',async()=>{
  const dir=directory();process.env.DSH_APNS_DIR=dir
  const hooks = registerHooks({ resolve(specifier, context, next) {
    return next(specifier === 'zod' ? new URL('../vendor/zod/index.js', import.meta.url).href : specifier, context)
  } })
  const {notificationRoutes}=await import('../src/notifications.ts')
  hooks.deregister()
  const cleanups=[];const devices=new Set(['first','second'])
  const service={config:{cookieName:'device'},touchDevice:id=>devices.has(id),hasDevice:id=>devices.has(id),snapshot:()=>({devices:[...devices].map(id=>({id}))})}
  const ctx={get:()=>undefined,effect(fn){cleanups.push(fn())}}
  const [route]=notificationRoutes(ctx,service,()=>true)
  const server=createServer((req,res)=>{void route.handler(req,res)})
  await new Promise(r=>server.listen(0,'127.0.0.1',r))
  const base='http://127.0.0.1:'+server.address().port+'/api/remote-notifications/push/'
  const send=(path,id,body,extra={})=>fetch(base+path,{method:body?'POST':'GET',headers:{'x-dsh-remote-device':id,...extra},...(body?{body:JSON.stringify(body)}:{})})
  try {
    assert.equal((await send('register','unknown',subscription)).status,403)
    assert.equal((await send('register','first',subscription,{'sec-fetch-site':'cross-site'})).status,403)
    assert.equal((await send('register','first',subscription)).status,200)
    assert.equal((await (await send('status','first')).json()).registered,true)
    assert.equal((await (await send('status','second')).json()).registered,false)
    assert.equal((await send('unregister','second',{})).status,200)
    assert.equal((await (await send('status','first')).json()).registered,true)
    devices.delete('first');assert.equal((await send('status','first')).status,403)
  } finally {
    cleanups.forEach(fn=>fn?.());server.closeAllConnections();await new Promise(r=>server.close(r))
    delete process.env.DSH_APNS_DIR;rmSync(dir,{recursive:true,force:true})
  }
})