import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateWindowsEventResponse, filterWindowsEvents, windowsEventsCsv, recurringWindowsEvents}
  from '../public/windows-events-view.mjs';

const measuredAt='2026-11-03T14:00:00.000Z';
const row1={time:'2026-11-03T13:45:00.000Z',channel:'System',level:'error',eventId:1552,
  provider:'Microsoft-Windows-User Profiles Service',recordId:'1008',message:'hidden message'};
const row2={time:'2026-11-03T13:44:00.000Z',channel:'Application',level:'warning',eventId:100,
  provider:'+cmd',recordId:'88'};
const envelope={ok:true,data:{schema:'aleph.on.windows-events.v1',source:'local-pc',
  state:'ok',hours:24,sampleLimit:200,truncated:false,measuredAt,events:[row1,row2]}};

test('정상 API 응답은 허용한 이벤트 필드만 화면 측으로 전달한다',()=>{
  const result=validateWindowsEventResponse(envelope,Date.parse(measuredAt));
  assert.equal(result.events.length,2);
  assert.equal(result.events[0].message,undefined);
  assert.equal(result.events[0].eventId,1552);
});

test('오래된 실측 또는 유효하지 않은 이벤트 메타데이터는 버린다',()=>{
  assert.equal(validateWindowsEventResponse(envelope,Date.parse(measuredAt)+61_000),null);
  const broken={...envelope,data:{...envelope.data,events:[{...row1,provider:'a\nb'}]}};
  assert.equal(validateWindowsEventResponse(broken,Date.parse(measuredAt)),null);
  const tooMany={...envelope,data:{...envelope.data,events:Array(201).fill(row1)}};
  assert.equal(validateWindowsEventResponse(tooMany,Date.parse(measuredAt)),null);
  const duplicate={...envelope,data:{...envelope.data,events:[row1,row1]}};
  assert.equal(validateWindowsEventResponse(duplicate,Date.parse(measuredAt)),null);
});

test('검색, 수준, 채널 필터는 실제 로그 제공자 및 ID에 적용된다',()=>{
  const records=[row1,row2];
  assert.equal(filterWindowsEvents(records,{query:'1552'}).length,1);
  assert.equal(filterWindowsEvents(records,{query:'user profiles'}).length,1);
  assert.equal(filterWindowsEvents(records,{level:'warning'}).length,1);
  assert.equal(filterWindowsEvents(records,{channel:'Application'}).length,1);
  assert.equal(filterWindowsEvents(records,{level:'error',channel:'Application'}).length,0);
});

test('CSV 내보내기는 스프레드시트 수식 실행을 피하고 BOM과 줄바꿈을 제공한다',()=>{
  const csv=windowsEventsCsv([row2,{...row1,provider:'quoted"provider'}]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv,/""/);
  assert.match(csv,/"'\+cmd"/);
  assert.ok(csv.endsWith('\r\n'));
});

test('반복 이벤트 TOP 목록은 조회 표본 내 제공자·ID별 발생 횟수만 세어 표시한다',()=>{
  const input=[row1,row2,{...row1,recordId:'1009'},{...row1,recordId:'1010'}];
  const top=recurringWindowsEvents(input);
  assert.equal(top.length,2);
  assert.deepEqual({id:top[0].eventId,count:top[0].count},{id:1552,count:3});
});

test('기존 보안 기록 및 과제 화면을 유지하고 별도의 로컬 이벤트 카드만 추가한다',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const server=readFileSync(new URL('../src/server.mjs',import.meta.url),'utf8');
  assert.match(html,/id="view-records"/);
  assert.match(html,/id="records-list"/);
  assert.match(html,/id="student-events"/);
  assert.match(html,/id="windows-event-analysis"/);
  assert.match(html,/id="student-explanation"/);
  assert.match(app,/mountWindowsEventAnalysis/);
  assert.match(server,/pathname==='\/api\/pc\/events'/);
  assert.match(server,/'\/windows-events-view.mjs'/);
});

test('상세 버튼은 200건 목록 끝이 아니라 선택한 행 바로 아래에 상세를 펼친다',()=>{
  const view=readFileSync(new URL('../public/windows-events-view.mjs',import.meta.url),'utf8');
  assert.match(view,/button\.setAttribute\('aria-expanded',selected===key\?'true':'false'\)/);
  assert.match(view,/if\(selected===key\)\{/);
  assert.match(view,/detailCell\.append\(detail\(row\)\)/);
  assert.match(view,/body\.append\(detailRow\)/);
  assert.match(view,/selected=selected===key\?null:key/);
  assert.match(view,/scrollIntoView/);
  assert.doesNotMatch(view,/panel\.append\(filters,counters,recurring,tableWrap,details,notice\)/);
});
