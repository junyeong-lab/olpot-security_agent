import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {employeePcSummary} from '../public/pc-status-view.mjs';

test('직원용 요약은 V3 등록을 실제 보호 판정으로 오인하지 않는다', () => {
  const data=employeePcSummary({
    avProducts:{state:'ok',source:'windows-security-center',productNames:['AhnLab V3 Lite','Windows Defender'],truncated:false},
    antivirus:{state:'ok',provider:'microsoft-defender',realtimeEnabled:false},
    firewall:{state:'ok',profiles:[{name:'Domain',enabled:true},{name:'Private',enabled:true},{name:'Public',enabled:true}]},
    disk:{state:'ok',totalBytes:500*1024**3,freeBytes:260*1024**3}
  });
  assert.match(data.antivirus.text,/AhnLab V3 Lite/);
  assert.match(data.antivirus.note,/등록 정보만/);
  assert.doesNotMatch(data.antivirus.text,/보호 중|안전/);
  assert.equal(data.firewall.text,'Windows 방화벽 켜짐');
  assert.match(data.connection.text,/별도 확인/);
  assert.match(data.storage.text,/260.0 GB/);
});

test('확인되지 않은 항목은 직원 화면에서 정상으로 표시하지 않는다', () => {
  const empty=employeePcSummary({});
  assert.equal(empty.antivirus.state,'unavailable');
  assert.equal(empty.firewall.state,'unavailable');
  assert.equal(empty.storage.state,'unavailable');
  assert.equal(empty.connection.state,'unavailable');
  const mixed=employeePcSummary({firewall:{state:'ok',profiles:[
    {name:'Domain',enabled:true},{name:'Private',enabled:false},{name:'Public',enabled:true}
  ]},disk:{state:'ok',totalBytes:100,freeBytes:5}});
  assert.equal(mixed.firewall.state,'attention');
  assert.equal(mixed.storage.state,'attention');
});

test('직원 화면 기본 구성과 개발용 분리 표시가 유지된다', () => {
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
  assert.match(html,/id="pc-status"/);
  assert.match(html,/id="view-apps"/);
  assert.match(html,/id="tech-view-toggle"/);
  assert.match(html,/employee-view\.mjs/);
  assert.match(css,/body:not\(\.show-tech\) \.tech-only/);
  assert.match(css,/body:not\(\.show-tech\) \.card\.student/);
  const view=readFileSync(new URL('../public/pc-status-view.mjs',import.meta.url),'utf8');
  assert.match(view,/상세 PC 진단 보기/);
});
