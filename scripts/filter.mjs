// This module operates only on the public Tilda YML export, never admin APIs.
export const SOURCE='https://tsunami.rest/tstore/yml/d66e7f2e6e4622c922bcaeef0a2681d4.yml';
const FOOD=new Set(['Роллы','Закуски','Салаты','Тако и суши','Супы','Горячее','Ланч','Десерты','Б/А напитки']);
const SAFE_SEASONAL=new Set(['Рохан Б/А']);
const DESCRIPTIONS={
 'Мясо':'Мясной ланч: рамен с говяжьей грудинкой, гунканы с омлетом тамаго и гёдза с томлёной говядиной. По будням с 13:00 до 17:00.',
 'Лепешка роти с гуакамоле':'Лепёшка роти с гуакамоле, томатами и кинзой.',
 'Сан-Себастьян':'Баскский чизкейк с маком, солёной карамелью и кокосовым ганашем. Подаётся со свежим инжиром.',
 'Сет тако':'Четыре вида открытых суши в формате тако для компании: угорь с шиитаке, лосось спайси, краб и гребешок с манго.',
 'Рыба':'Рыбный ланч: гунканы с угрём и омлетом тамаго, гёдза с крабом и рыбой, суп суимоно с морепродуктами и вешенками. По будням с 13:00 до 17:00.',
 'Цукэмоно томат':'Томаты черри с сушизой, соком юдзу и кунжутом.',
 'Ананас Кимчи':'Ананас в соусе кимчи с кунжутным маслом и кунжутом.',
 'Сет сашими':'Сашими из лосося, тунца, краба и гребешка в одном сете.',
 'Сет цукэмоно':'Четыре закуски в одном сете: ананас, томат, острые огурцы и древесные грибы.',
 'Хлорофилл Спритц':'Освежающий безалкогольный коктейль с яблочно-мятным вкусом.',
 'Габа Изотоник':'В безалкогольном коктейле раскрывается сочетание зелёного чая с мёдом, дополненное кислыми нотами лайма и кумквата.'
};
const unescape=s=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
const plain=s=>unescape(s).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const field=(s,t)=>s.match(new RegExp('<'+t+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+t+'>','i'))?.[1]||'';
const attr=(s,n)=>s.match(new RegExp('\\b'+n+'=["\u0027]([^"\u0027]*)["\u0027]'))?.[1]||'';
export function filterFeed(source){
 if(!source.includes('<yml_catalog')||!source.includes('</yml_catalog>'))throw Error('Invalid upstream YML');
 const cats=new Map();
 for(const m of source.matchAll(/<category\b([^>]*)>([\s\S]*?)<\/category>/g)){
  const id=attr(m[1],'id');cats.set(id,{id,parent:attr(m[1],'parentId'),name:plain(m[2])});
 }
 const english=id=>{const seen=new Set();while(id&&cats.has(id)&&!seen.has(id)){seen.add(id);const c=cats.get(id);if(c.name==='English menu')return true;id=c.parent;}return false;};
 const offers=[],used=new Set();const stats={upstream:0,included:0,excluded_language:0,excluded_category:0,excluded_image:0,excluded_invalid:0,description_fallback:0};
 for(const m of source.matchAll(/<offer\b([^>]*)>([\s\S]*?)<\/offer>/g)){
  stats.upstream++;const id=attr(m[1],'id'),body=m[2],name=plain(field(body,'name')),categoryId=plain(field(body,'categoryId')),category=cats.get(categoryId)?.name;
  if(english(categoryId)){stats.excluded_language++;continue;}
  if(!FOOD.has(category)&&!SAFE_SEASONAL.has(name)){stats.excluded_category++;continue;}
  const pictures=[...body.matchAll(/<picture(?:\s[^>]*)?>([\s\S]*?)<\/picture>/g)].map(m=>plain(m[1])).filter(p=>/^https?:\/\//.test(p));
  if(!pictures.length){stats.excluded_image++;continue;}
  const price=Number(plain(field(body,'price'))),url=plain(field(body,'url'));
  if(!id||!name||!cats.has(categoryId)||!Number.isFinite(price)||price<=0||attr(m[1],'available')==='false'){stats.excluded_invalid++;continue;}
  let description=plain(field(body,'description'));
  if((!description||/^(Состав:|Пищевая ценность)/i.test(description))&&DESCRIPTIONS[name]){description=DESCRIPTIONS[name];stats.description_fallback++;}
  // The detailed site description is used, not the nutrition/composition field.
  offers.push(`<offer id="${esc(id)}" available="true"><name>${esc(name)}</name><description>${esc(description.slice(0,3000))}</description><price>${price.toFixed(2)}</price><currencyId>RUR</currencyId><categoryId>${esc(categoryId)}</categoryId>${pictures.slice(0,1).map(p=>'<picture>'+esc(p)+'</picture>').join('')}${/^https?:\/\//.test(url)?'<url>'+esc(url)+'</url>':''}</offer>`);
  used.add(categoryId);stats.included++;
 }
 if(!offers.length)throw Error('No eligible offers; refusing an empty replacement');
 for(const id of [...used]){let p=cats.get(id)?.parent;const seen=new Set();while(p&&cats.has(p)&&!seen.has(p)){seen.add(p);used.add(p);p=cats.get(p).parent;}}
 const categoryXml=[...cats.values()].filter(c=>used.has(c.id)).map(c=>`<category id="${esc(c.id)}"${c.parent&&used.has(c.parent)?' parentId="'+esc(c.parent)+'"':''}>${esc(c.name)}</category>`).join('');
 const date=source.match(/<yml_catalog\b[^>]*\bdate="([^"]+)"/)?.[1]||new Date().toISOString();
 const xml=`<?xml version="1.0" encoding="UTF-8"?><yml_catalog date="${esc(date)}"><shop><name>Цунами</name><company>Цунами — ресторанное меню</company><url>https://tsunami.rest/qr</url><currencies><currency id="RUR" rate="1"/></currencies><categories>${categoryXml}</categories><offers>${offers.join('')}</offers></shop></yml_catalog>`;
 return {xml,stats};
}
