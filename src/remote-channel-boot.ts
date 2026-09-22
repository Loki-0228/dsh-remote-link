/**
 * Parse-time remote-channel boot patch. The browser half installs its channel
 * rewrite when this plugin's boot entry runs, but `dsh-client-connection`
 * boots earlier and opens its event streams unrewritten — on a non-loopback
 * origin the fence rejects them and the workspace list never loads. The host
 * therefore inlines this classic script into the served index, so the
 * fetch/WebSocket/EventSource/src rewrite is active before ANY boot entry
 * executes; the client apply later adopts the installed seat instead of
 * patching twice.
 *
 * The script also flips the official UI into host mode by installing the
 * transport hook `__DSH_TRANSPORT__ = { ownsHost: true }` before the
 * connection plugin reads it, so a paired remote device gets the full
 * configuration surface while every call still rides the gated channel. It
 * self-skips on loopback origins and never throws.
 * @module dsh-remote-link/remote-channel-boot
 */

import {
  REMOTE_CHANNEL_BOOT_GLOBAL,
  REMOTE_CHANNEL_RULES,
  type RemoteChannelRules,
} from './remote-methods.ts'

/**
 * Build the inline boot script. The result contains no `</script` sequence
 * (the injection contract) and installs a seat on the window global.
 * @param rules - the rewrite table (defaults to the live rule set).
 * @returns the classic script body.
 */
export function buildRemoteChannelBootScript(rules: RemoteChannelRules = REMOTE_CHANNEL_RULES): string {
  const json = JSON.stringify(rules)
  const seat = JSON.stringify(REMOTE_CHANNEL_BOOT_GLOBAL)
  return '(function(){' +
    'try{' +
    'var w=window,loc=w.location,h=loc.hostname;' +
    // Loopback origins keep the original paths.
    "if(h==='localhost'||h==='::1'||/^127(\\.\\d{1,3}){3}$/.test(h))return;" +
    // Host mode: a paired remote device presents itself as the machine owner.
    'try{if(w.__DSH_TRANSPORT__===undefined)w.__DSH_TRANSPORT__={};w.__DSH_TRANSPORT__.ownsHost=true}catch(e){}' +
    'var R=' + json + ';' +
    // The cookieless device credential is read lazily: the /pair-app capture
    // script sets it in head AFTER this boot script ran, and it writes both
    // stores — sessionStorage for this tab, localStorage so a restored tab (or
    // a fresh one) still has the credential when the pairing cookie was never
    // usable (WebView storage reclaim, cookie-less in-app browsers).
    'function rdv(){try{var v=w.sessionStorage.getItem(R.deviceKey);' +
    'return v!==null?v:w.localStorage.getItem(R.deviceKey)}catch(e){return null}}' +
    'function att(init){' +
    'var dv=rdv();' +
    'if(dv===null)return init;' +
    'var h=init&&init.headers;' +
    'if(typeof Headers!=="undefined"&&h instanceof Headers){try{h.set(R.deviceHeader,dv)}catch(e){}return init}' +
    'if(typeof h==="object"&&h!==null){var o={};for(var k in h)o[k]=h[k];o[R.deviceHeader]=dv;return Object.assign({},init,{headers:o})}' +
    'return init}' +
    'function sf(p){' +
    'if(p.indexOf(R.pairPrefix)===0)return false;' +
    'if(p.indexOf(R.updatePrefix)===0)return false;' +
    'if(p===R.settingsBridgePrefix||p.indexOf(R.settingsBridgePrefix+"/")===0)return false;' +
    'if(p.indexOf(R.apiPrefix)===0)return true;' +
    'if(p.indexOf(R.sidebarPrefix)===0||p==="/sidebar")return true;' +
    'if(p.indexOf(R.gitPrefix)===0||p==="/git")return true;' +
    'return false}' +
    'function sw(p){return R.wsPaths.indexOf(p)!==-1}' +
    'function rp(p){return R.remotePrefix+p}' +
    'function so(u){return u.origin===loc.origin}' +
    'function rr(raw){var u;try{u=new URL(raw,loc.href)}catch(e){return raw}' +
    'if(u.origin!==loc.origin)return raw;' +
    'if(!sf(u.pathname))return raw;' +
    'u.pathname=rp(u.pathname);' +
    'if(raw.charAt(0)==="/"&&raw.charAt(1)!=="/")return u.pathname+u.search+u.hash;' +
    'return u.href}' +
    // The unpaired code reader mirrors isUnpairedDenied's envelope shapes.
    'function uc(v){' +
    'if(typeof v!=="object"||v===null)return undefined;' +
    'var n=v.result;' +
    'if(typeof n==="object"&&n!==null){' +
    'var e=n.error;' +
    'if(typeof e==="object"&&e!==null&&typeof e.code==="string")return e.code}' +
    'var t=v.error;' +
    'if(typeof t==="object"&&t!==null&&typeof t.code==="string")return t.code;' +
    'return undefined}' +
    'var seat={onUnpaired:null,onPaired:null,pendingUnpaired:false,restore:function(){}};' +
    'function denied(res){' +
    'if(res.status!==403)return false;' +
    'return res.clone().json().then(function(b){return uc(b)==="unpaired"}).catch(function(){return false})}' +
    'function signal(unpaired){' +
    'if(unpaired){' +
    'if(seat.onUnpaired)seat.onUnpaired();else seat.pendingUnpaired=true' +
    '}else{' +
    'seat.pendingUnpaired=false;' +
    'if(seat.onPaired)seat.onPaired()}}' +
    'var of=w.fetch;' +
    'w.fetch=function(input,init){' +
    'var raw=typeof input==="string"||input instanceof URL?input.toString():input.url;' +
    'var url=new URL(raw,loc.href);' +
    'if(so(url)&&sf(url.pathname)){' +
    'var next=new URL(url);' +
    'next.pathname=rp(url.pathname);' +
    'var target=typeof input==="string"||input instanceof URL?next.toString():new Request(next,input);' +
    'return Promise.resolve(of.call(w,target,att(init))).then(function(res){' +
    'void Promise.resolve(denied(res)).then(signal);' +
    'return res})}' +
    'return of.call(w,input,init)};' +
    'var OW=w.WebSocket;' +
    'w.WebSocket=function(url,protocols){' +
    'var p=new URL(url.toString(),loc.href);' +
    'var o=p.protocol==="wss:"?"https://"+p.host:p.protocol==="ws:"?"http://"+p.host:"";' +
    'if(o!==""&&o===loc.origin&&sw(p.pathname)){' +
    'var nx=new URL(p);' +
    'nx.pathname=rp(p.pathname);' +
    'var dvv=rdv();' +
    'if(dvv!==null)nx.searchParams.set(R.deviceQuery,dvv);' +
    'return protocols!==undefined?new OW(nx,protocols):new OW(nx)}' +
    'return protocols!==undefined?new OW(url,protocols):new OW(url)};' +
    'w.WebSocket.prototype=OW.prototype;' +
    'w.WebSocket.CONNECTING=OW.CONNECTING;w.WebSocket.OPEN=OW.OPEN;w.WebSocket.CLOSING=OW.CLOSING;w.WebSocket.CLOSED=OW.CLOSED;' +
    'var OE=w.EventSource;' +
    'if(OE!==undefined){' +
    'w.EventSource=function(url,cfg){' +
    'var p=new URL(url.toString(),loc.href);' +
    'if(so(p)&&sf(p.pathname)){' +
    'var nx=new URL(p);' +
    'nx.pathname=rp(p.pathname);' +
    'var dvv=rdv();' +
    'if(dvv!==null)nx.searchParams.set(R.deviceQuery,dvv);' +
    'return new OE(nx,cfg)}' +
    'return new OE(url,cfg)};' +
    'w.EventSource.prototype=OE.prototype}' +
    'var restores=[];' +
    'function patchSrc(C){' +
    'if(C===undefined)return;' +
    'var d=Object.getOwnPropertyDescriptor(C.prototype,"src");' +
    'if(d===undefined||d.configurable===false||d.set===undefined)return;' +
    'var os=d.set;' +
    'Object.defineProperty(C.prototype,"src",{configurable:true,enumerable:d.enumerable!==false,get:d.get,set:function(v){os.call(this,rr(String(v)))}});' +
    'restores.push(function(){Object.defineProperty(C.prototype,"src",d)})}' +
    'patchSrc(w.HTMLImageElement);patchSrc(w.HTMLScriptElement);patchSrc(w.HTMLIFrameElement);' +
    'seat.restore=function(){' +
    'w.fetch=of;' +
    'w.WebSocket=OW;' +
    'if(OE!==undefined)w.EventSource=OE;' +
    'for(var i=0;i<restores.length;i++)restores[i]();' +
    'try{delete w[' + seat + ']}catch(e){w[' + seat + ']=undefined}};' +
    'w[' + seat + ']=seat' +
    '}catch(e){}' +
    '})();'
}

/** The script this plugin contributes to the served index. */
export const REMOTE_CHANNEL_BOOT_SCRIPT: string = buildRemoteChannelBootScript()

/** sessionStorage latch key for the failed-pair notice (browser half). */
export const PAIR_FAILED_MARKER = 'dsh-remote-link-pair-failed'
