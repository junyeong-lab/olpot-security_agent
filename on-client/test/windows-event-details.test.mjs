import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWindowsEventDetailsReader, normalizeWindowsEventDetails} from '../src/windows-event-details.mjs';

const fixture = {
  state:'ok', source:'windows-event-log', hours:24, sampleLimit:200, truncated:false,
  rows:[
    {time:'2026-11-03T13:45:00.000Z', channel:'System', level:'error', eventId:1552,
      provider:'Microsoft-Windows-User Profiles Service', recordId:'1008',
      message:'PRIVATE EVENT MESSAGE', username:'PRIVATE USER', ip:'192.0.2.1'},
    {time:'2026-11-03T13:44:00.000Z', channel:'Application', level:'warning', eventId:100,
      provider:'Example Provider', recordId:'88'},
  ],
};

test('개별 이벤트는 허용된 메타데이터만 전달하고 원문·사용자·주소는 버린다', () => {
  const result = normalizeWindowsEventDetails(fixture);
  assert.equal(result.state,'ok');
  assert.equal(result.events.length,2);
  assert.deepEqual(result.events[0],{
    time:'2026-11-03T13:45:00.000Z', channel:'System', level:'error', eventId:1552,
    provider:'Microsoft-Windows-User Profiles Service', recordId:'1008',
  });
  for (const secret of ['PRIVATE EVENT MESSAGE','PRIVATE USER','192.0.2.1']) {
    assert.equal(JSON.stringify(result).includes(secret),false);
  }
});

test('오염된 공급자명, 임의 채널, 잘못된 ID와 시간 및 중복 레코드는 거부한다', () => {
  const alterations=[
    {provider:'evil\nprovider'},
    {channel:'Security'},
    {eventId:-1},
    {time:'yesterday'},
    {recordId:'1;Remove-Item'},
  ];
  for (const change of alterations) {
    const data={...fixture,rows:[{...fixture.rows[0],...change}]};
    assert.equal(normalizeWindowsEventDetails(data).state,'unavailable');
  }
  const duplicate={...fixture,rows:[fixture.rows[0],fixture.rows[0]]};
  assert.equal(normalizeWindowsEventDetails(duplicate).state,'unavailable');
});

test('이벤트 표본 200개 한도와 최신순 계약 위반은 유효하지 않은 결과로 취급한다', () => {
  assert.equal(normalizeWindowsEventDetails({...fixture,sampleLimit:999}).state,'unavailable');
  assert.equal(normalizeWindowsEventDetails({...fixture,rows:new Array(201).fill(fixture.rows[0])}).state,'unavailable');
  assert.equal(normalizeWindowsEventDetails({...fixture,rows:fixture.rows.toReversed()}).state,'unavailable');
});

test('비 Windows 실행 시 OS 이벤트 명령을 호출하지 않는다', async () => {
  const reader=createWindowsEventDetailsReader({platform:'linux',run:async()=>{throw Error('must not run');},
    clock:()=>new Date('2026-11-03T14:00:00Z')});
  const result=await reader();
  assert.deepEqual({schema:result.schema,source:result.source,state:result.state,reason:result.reason},
    {schema:'aleph.on.windows-events.v1',source:'local-pc',state:'unavailable',reason:'unsupported'});
});

test('Windows에서는 24시간 경고·오류 로그만 제한 조회하고 응답을 검증한다', async () => {
  let invoked=false;
  const reader=createWindowsEventDetailsReader({platform:'win32',
    clock:()=>new Date('2026-11-03T14:00:00Z'),
    run:async (_exe,args,options)=>{
      invoked=true;
      assert.match(args.at(-1),/Get-WinEvent/);
      assert.match(args.at(-1),/-MaxEvents 201/);
      assert.match(args.at(-1),/System/);
      assert.match(args.at(-1),/Application/);
      assert.equal(options.timeout,8000);
      assert.equal(options.maxBuffer,128*1024);
      return {stdout:JSON.stringify(fixture)};
    }});
  const result=await reader();
  assert.equal(invoked,true);
  assert.equal(result.state,'ok');
  assert.equal(result.events.length,2);
  assert.equal(result.schema,'aleph.on.windows-events.v1');
});

test('권한 오류·명령 실패·시간 초과는 정상 결과로 위장하지 않는다', async () => {
  assert.deepEqual(normalizeWindowsEventDetails({state:'unavailable',reason:'permission_denied'}),
    {state:'unavailable',reason:'permission_denied'});
  const reader=createWindowsEventDetailsReader({platform:'win32',run:async()=>{throw Object.assign(Error('timeout'),{killed:true});}});
  const result=await reader();
  assert.equal(result.state,'unavailable');
  assert.equal(result.reason,'timeout');
});