import {readFile,writeFile} from 'node:fs/promises';
import {SOURCE,filterFeed} from './filter.mjs';
const upstream=await fetch(SOURCE,{signal:AbortSignal.timeout(30000)});
if(!upstream.ok)throw Error('Public source returned '+upstream.status);
const source=await upstream.text();
if(source.length>5000000)throw Error('Source too large');
const {xml,stats}=filterFeed(source);
if(stats.included<50)throw Error('Unexpectedly small catalog: preserve previous version for review');
const normalize=x=>x.replace(/<yml_catalog date="[^"]*">/,'<yml_catalog>');
let prior='';try{prior=await readFile('menu.yml','utf8')}catch{}
if(normalize(prior)!==normalize(xml))await writeFile('menu.yml',xml);
console.log(JSON.stringify(stats));
