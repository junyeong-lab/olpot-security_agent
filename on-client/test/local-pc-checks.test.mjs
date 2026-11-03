import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWindowsStatus, createPcStatusReader} from '../src/pc-status.mjs';
import {pcMetricText} from '../public/pc-status-view.mjs';

const since = '2026-11-03T10:00:00.000Z';

test('Windows 추가 상태: 검증된 집계만 내보내고 사용자 정보는 제외한다', () => {
  const m = normalizeWindowsStatus({
    vpn: {state:'ok', scope:'current-user-windows-vpn', configuredCount:2, connectedCount:1, username:'secret'},
    antivirus: {state:'ok', provider:'microsoft-defender', realtimeEnabled:false, product:'secret'},
    signins: {state:'ok', successCount:3, failureCount:2, sampleLimit:1000, truncated:false, since, username:'secret'},
  });
  assert.deepEqual(m.vpn, {state:'ok', scope:'current-user-windows-vpn', configuredCount:2, connectedCount:1});
  assert.deepEqual(m.antivirus, {state:'ok', provider:'microsoft-defender', realtimeEnabled:false});
  assert.deepEqual(m.signins, {state:'ok', successCount:3, failureCount:2, sampleLimit:1000, truncated:false, since});
  assert.equal(JSON.stringify(m).includes('secret'), false);
});

test('미확인·형식 오류는 성공/안전으로 표시하지 않는다', () => {
  const m = normalizeWindowsStatus({
    vpn: {state:'ok', scope:'current-user-windows-vpn', configuredCount:0, connectedCount:1},
    antivirus: {state:'ok', provider:'third-party', realtimeEnabled:true},
    signins: {state:'ok', successCount:1001, failureCount:1, sampleLimit:1000, truncated:false, since},
  });
  for (const key of ['vpn','antivirus','signins']) assert.equal(m[key].state, 'unavailable');
  const denied = normalizeWindowsStatus({vpn:{state:'unavailable',reason:'permission_denied'},signins:{state:'unavailable',reason:'permission_denied'}});
  assert.equal(denied.vpn.reason, 'permission_denied');
  assert.equal(denied.signins.reason, 'permission_denied');
});

test('표시 문구는 Windows VPN·Defender만 확인했다고 명시한다', () => {
  const vpn = pcMetricText('vpn', {state:'ok',scope:'current-user-windows-vpn',connectedCount:1,configuredCount:2});
  assert.match(vpn.text, /Windows VPN 연결 1개/);
  assert.match(vpn.note, /OpenVPN/);
  const defender = pcMetricText('antivirus',{state:'ok',provider:'microsoft-defender',realtimeEnabled:false});
  assert.match(defender.text, /꺼짐/);
  const signins = pcMetricText('signins',{state:'ok',successCount:4,failureCount:2,sampleLimit:1000,truncated:true});
  assert.match(signins.text, /일부 집계/);
  assert.equal(pcMetricText('signins',{state:'unavailable',reason:'permission_denied'}).state,'unavailable');
});

test('비-Windows에서는 Windows 조회를 미지원으로 표시한다', async () => {
  let calls=0;
  const system={
    cpus:()=>{calls++;return [{times:{user:calls*10,nice:0,sys:0,idle:calls*20,irq:0}}];},
    totalmem:()=>100, freemem:()=>60, networkInterfaces:()=>({}),
  };
  const reader=createPcStatusReader({system,platform:'linux',disk:async()=>({blocks:10,bsize:10,bavail:4}),pause:async()=>{}});
  const result=await reader();
  assert.equal(result.metrics.cpu.state,'ok');
  assert.equal(result.metrics.memory.state,'ok');
  for (const key of ['vpn','antivirus','avProducts','signins','firewall','events']) {
    assert.deepEqual(result.metrics[key], {state:'unavailable',reason:'unsupported'});
  }
});

test('Windows 기록 반복 오류 상위 유형만 검증해 표시하며 원문은 제외한다', () => {
  const m = normalizeWindowsStatus({
    events: {state:'ok',warningCount:18,errorCount:361,sampleLimit:5000,truncated:false,since,
      topErrors:[{providerName:'Microsoft-Windows-User Profiles Service',eventId:1552,count:350,message:'secret'}]},
  });
  assert.equal(m.events.topErrors[0].count,350);
  assert.equal(JSON.stringify(m).includes('secret'),false);
  const display=pcMetricText('events',m.events);
  assert.match(display.note,/1552/);
  assert.match(display.note,/350건/);
  const bad=normalizeWindowsStatus({events:{state:'ok',warningCount:0,errorCount:4,sampleLimit:5000,truncated:false,since,
    topErrors:[{providerName:'Bad\\nProvider',eventId:2,count:8}]}});
  assert.equal(bad.events.state,'ok');
  assert.equal(bad.events.topErrors,undefined);
});

test('Windows 보안 센터 백신 등록은 보호 활성 판정이 아니다', () => {
  const m=normalizeWindowsStatus({avProducts:{state:'ok',source:'windows-security-center',
    productNames:['AhnLab V3 Lite','Windows Defender'],truncated:false,productState:266240,username:'secret'}});
  assert.deepEqual(m.avProducts,{state:'ok',source:'windows-security-center',
    productNames:['AhnLab V3 Lite','Windows Defender'],truncated:false});
  const display=pcMetricText('avProducts',m.avProducts);
  assert.match(display.text,/AhnLab V3 Lite/);
  assert.match(display.note,/등록만으로/);
  assert.equal(JSON.stringify(m).includes('secret'),false);
  assert.equal(JSON.stringify(m).includes('266240'),false);
  const invalid=normalizeWindowsStatus({avProducts:{state:'ok',source:'windows-security-center',
    productNames:['AhnLab V3 Lite','AhnLab V3 Lite'],truncated:false}});
  assert.equal(invalid.avProducts.state,'unavailable');
  const denied=normalizeWindowsStatus({avProducts:{state:'unavailable',reason:'permission_denied'}});
  assert.equal(denied.avProducts.reason,'permission_denied');
});
