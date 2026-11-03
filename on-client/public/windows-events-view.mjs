// 직원 PC의 Windows 이벤트 메타데이터를 로컬에서 조회한다.
// 기존 ZTNA/XDR 사건 목록·학생 렌더러는 그대로 둔다. 이벤트 원문은 요청하지 않는다.
const LIMIT = 200;
const cleanText = s => typeof s === 'string' && s.length >= 1 && s.length <= 120 &&
  !/[\x00-\x1f\x7f<>]/.test(s) && s.trim() === s;
const validTime = s => typeof s === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(s) &&
  Number.isFinite(Date.parse(s));
const validInt = n => Number.isSafeInteger(n) && n >= 0;
const levels = {error:'오류', warning:'경고'};
const channels = {System:'시스템', Application:'응용 프로그램'};

export function validateWindowsEventResponse(response, now = Date.now()) {
  const data = response?.ok === true ? response.data : null;
  if (!data || data.schema !== 'aleph.on.windows-events.v1' || data.source !== 'local-pc' ||
      data.state !== 'ok' || data.hours !== 24 || data.sampleLimit !== LIMIT ||
      typeof data.truncated !== 'boolean' || !validTime(data.measuredAt) ||
      Math.abs(now - Date.parse(data.measuredAt)) > 60_000 ||
      !Array.isArray(data.events) || data.events.length > LIMIT) return null;
  const set = new Set();
  let last = Infinity;
  const events = [];
  for (const event of data.events) {
    if (!event || !validTime(event.time) || !Object.hasOwn(channels,event.channel) ||
        !Object.hasOwn(levels,event.level) || !validInt(event.eventId) || event.eventId > 65535 ||
        !cleanText(event.provider) || typeof event.recordId !== 'string' ||
        !/^[1-9]\d{0,19}$/.test(event.recordId)) return null;
    const at = Date.parse(event.time), key = event.channel + ':' + event.recordId;
    if (at > last || set.has(key)) return null;
    last = at; set.add(key);
    // 프런트엔드도 허용한 필드만 메모리에 보유한다.
    events.push({time:event.time,channel:event.channel,level:event.level,
      eventId:event.eventId,provider:event.provider,recordId:event.recordId});
  }
  return {measuredAt:data.measuredAt,truncated:data.truncated,events};
}

export function filterWindowsEvents(events, {query = '', level = 'all', channel = 'all'} = {}) {
  const search = query.trim().toLocaleLowerCase('ko-KR');
  return events.filter(row =>
    (level === 'all' || row.level === level) &&
    (channel === 'all' || row.channel === channel) &&
    (!search || [String(row.eventId),row.provider,row.recordId,row.channel]
      .some(s => s.toLocaleLowerCase('ko-KR').includes(search))));
}

export function recurringWindowsEvents(events, limit = 5) {
  const grouped = new Map();
  for (const event of events) {
    const key = event.channel + ':' + event.eventId + ':' + event.provider;
    const current = grouped.get(key);
    if (current) current.count++;
    else grouped.set(key,{channel:event.channel,eventId:event.eventId,
      provider:event.provider,count:1});
  }
  return [...grouped.values()].sort((a,b)=>b.count-a.count ||
    a.eventId-b.eventId || a.provider.localeCompare(b.provider)).slice(0,limit);
}

function csvCell(value) {
  const raw = String(value);
  // Excel/스프레드시트 수식 실행 방지. 큰따옴표와 쉼표도 CSV 규약에 따라 인용한다.
  const safe = /^[\s]*[=+\-@]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replaceAll('"','""') + '"';
}
export function windowsEventsCsv(events) {
  const headers = ['발생 시각(UTC)','채널','수준','이벤트 ID','제공자','레코드 번호'];
  const rows = events.map(row => [row.time,row.channel,levels[row.level],row.eventId,row.provider,row.recordId]);
  return '\uFEFF' + [headers,...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function mountWindowsEventAnalysis(host,{fetchImpl = globalThis.fetch?.bind(globalThis),timeoutMs = 10000} = {}) {
  const doc = host.ownerDocument, win = doc.defaultView;
  const make = (tag, text = '', cls = '') => {
    const n=doc.createElement(tag);
    if (text) n.textContent=text;
    if (cls) n.className=cls;
    return n;
  };
  const heading=make('h2','Windows 이벤트 분석');
  const label=make('span','로컬 PC · 읽기 전용','tag');
  heading.append(' ',label);
  const intro=make('p',
    '최근 24시간 Windows System·Application 오류·경고를 최대 200건 조회합니다. 검색·필터·CSV 저장은 이 브라우저 안에서 처리하며, 로그 원문·계정·IP는 수집하지 않습니다. XDR 사건 판정과는 별도입니다.',
    'muted');
  const toolbar=make('div','','win-event-toolbar');
  const read=make('button','Windows 로그 조회','btn');
  read.type='button';
  const exportBtn=make('button','현재 목록 CSV 내보내기','btn');
  exportBtn.type='button'; exportBtn.disabled=true;
  toolbar.append(read,exportBtn);
  const status=make('p','아직 조회하지 않았습니다.','muted');
  status.setAttribute('role','status');
  const panel=make('div','','win-event-panel'); panel.hidden=true;
  const filters=make('div','','win-event-filters');
  const search=make('input','','win-event-search');
  search.type='search'; search.placeholder='이벤트 ID · 제공자 · 레코드 검색';
  search.setAttribute('aria-label','Windows 이벤트 검색');
  const level=make('select');level.setAttribute('aria-label','심각도 필터');
  const channel=make('select');channel.setAttribute('aria-label','이벤트 채널 필터');
  for (const [value,text] of [['all','전체 수준'],['error','오류'],['warning','경고']]) {
    const o=make('option',text);o.value=value;level.append(o);
  }
  for (const [value,text] of [['all','전체 채널'],['System','System'],['Application','Application']]) {
    const o=make('option',text);o.value=value;channel.append(o);
  }
  filters.append(search,level,channel);
  const counters=make('p','','win-event-counts'); counters.setAttribute('role','status');
  const recurring=make('section','','win-event-recurring');
  const tableWrap=make('div','','win-event-table-wrap');
  const table=make('table','','win-event-table');
  const head=make('thead'),header=make('tr');
  for (const text of ['발생 시각','수준','채널','이벤트 ID','제공자','상세']) {
    const th=make('th',text);th.scope='col';header.append(th);
  }
  head.append(header);
  const body=make('tbody');
  table.append(head,body);tableWrap.append(table);
  const details=make('section','','win-event-detail');
  details.setAttribute('aria-label','선택한 이벤트 세부 정보');
  details.append(make('p','행의 「상세」를 누르면 해당 이벤트의 메타데이터가 표시됩니다.','muted'));
  const notice=make('p','이벤트 수준이 오류라도 침해 사고나 악성 행위로 단정할 수 없습니다. 원인 분석에는 관련 시스템 맥락을 추가 확인해야 합니다.','muted');
  panel.append(filters,counters,recurring,tableWrap,details,notice);
  host.replaceChildren(heading,intro,toolbar,status,panel);
  let data=null, selected=null, controller=null, generation=0, disposed=false;

  const rowKey=row=>row.channel+':'+row.recordId;
  function detail(row) {
    details.replaceChildren(make('h3','선택한 이벤트 · '+row.eventId));
    const dl=make('dl','','win-event-kv');
    for (const [name,value] of [
      ['발생 시각',new Date(row.time).toLocaleString('ko-KR')],
      ['채널',row.channel],['심각도',levels[row.level]],['이벤트 ID',String(row.eventId)],
      ['제공자',row.provider],['레코드 번호',row.recordId]]) {
      dl.append(make('dt',name),make('dd',value));
    }
    details.append(dl,make('p','이 화면은 Windows 이벤트 메시지 원문·계정·네트워크 주소를 저장하지 않습니다.','muted'));
  }
  function render() {
    if (!data) return;
    const events=filterWindowsEvents(data.events,{query:search.value,level:level.value,channel:channel.value});
    const errors=data.events.filter(e=>e.level==='error').length;
    const warnings=data.events.length-errors;
    counters.textContent='조회 표본 '+data.events.length+'건 (오류 '+errors+' · 경고 '+warnings+') · 필터 결과 '+events.length+'건'+
      (data.truncated?' · 일부 기록만 조회됨':'')+' · 마지막 조회 '+new Date(data.measuredAt).toLocaleString('ko-KR');
    exportBtn.disabled=events.length===0;
    const top = recurringWindowsEvents(data.events);
    const topHeading=make('h3','반복 이벤트 TOP 5 · 조회 표본 기준');
    const topList=make('ol','','win-event-top');
    for(const entry of top){
      topList.append(make('li','이벤트 '+entry.eventId+' · '+entry.provider+
        ' ('+entry.channel+') — '+entry.count+'건'));
    }
    recurring.replaceChildren(topHeading,topList);
    body.replaceChildren();
    if (events.length===0) {
      const tr=make('tr'),td=make('td','조건에 맞는 이벤트가 없습니다.');td.colSpan=6;
      tr.append(td);body.append(tr);
      details.replaceChildren(make('p','선택할 이벤트가 없습니다.','muted'));
      return;
    }
    if (!events.some(e=>rowKey(e)===selected)) selected=null;
    for (const row of events) {
      const tr=make('tr');
      if (rowKey(row)===selected) tr.dataset.selected='true';
      for (const value of [
        new Date(row.time).toLocaleString('ko-KR'),levels[row.level],row.channel,
        String(row.eventId),row.provider]) tr.append(make('td',value));
      const last=make('td'),button=make('button','상세','btn win-event-detail-btn');
      button.type='button';
      button.setAttribute('aria-label','이벤트 '+row.eventId+' 상세 보기');
      button.setAttribute('aria-pressed',rowKey(row)===selected?'true':'false');
      button.addEventListener('click',()=>{
        selected=rowKey(row);
        detail(row);
        render();
      });
      last.append(button);tr.append(last);body.append(tr);
    }
    if (!selected) details.replaceChildren(make('p','행의 「상세」를 누르면 이벤트 정보가 표시됩니다.','muted'));
  }
  function clear() {
    data=null;selected=null;panel.hidden=true;exportBtn.disabled=true;
    body.replaceChildren();
  }
  async function load() {
    if (disposed)return;
    const gen=++generation;
    controller?.abort();
    controller=new AbortController();
    const active=controller;
    let timer=null, timedOut=false;
    clear(); read.disabled=true;
    status.textContent='이 PC에서 Windows 이벤트를 읽는 중…';
    try {
      timer=win.setTimeout(()=>{timedOut=true;active.abort();},timeoutMs);
      const result=await fetchImpl('/api/pc/events',{cache:'no-store',signal:active.signal});
      if (!result.ok) throw Error('request_failed');
      const response=await result.json();
      if (disposed||gen!==generation)return;
      const normalized=validateWindowsEventResponse(response);
      if (!normalized) {
        if (response?.data?.state==='unavailable' && response.data.reason==='permission_denied') {
          throw Error('permission_denied');
        }
        throw Error('invalid_response');
      }
      data=normalized;
      panel.hidden=false;
      status.textContent='Windows 이벤트 메타데이터 조회 완료 · 보안 서버로 자동 전송하지 않습니다.';
      render();
    } catch(error) {
      if (disposed||gen!==generation)return;
      clear();
      status.textContent=timedOut?'조회 시간이 초과됐습니다.':error?.message==='permission_denied'?
        '로그를 읽을 권한이 없습니다.': '이번 Windows 이벤트 목록을 확인하지 못했습니다. 다시 조회해 주세요.';
    } finally {
      if(timer!==null)win.clearTimeout(timer);
      if (!disposed&&gen===generation){read.disabled=false;controller=null;}
    }
  }
  function onFilter(){render();}
  function onExport(){
    if (!data)return;
    const events=filterWindowsEvents(data.events,{query:search.value,level:level.value,channel:channel.value});
    if(!events.length)return;
    const blob=new Blob([windowsEventsCsv(events)],{type:'text/csv;charset=utf-8'});
    const url=win.URL.createObjectURL(blob);
    const link=make('a');
    link.href=url;link.download='olpot-windows-events-'+new Date(data.measuredAt).toISOString().slice(0,10)+'.csv';
    link.hidden=true;host.append(link);link.click();link.remove();
    win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);
  }
  read.addEventListener('click',load);
  exportBtn.addEventListener('click',onExport);
  for(const node of [search,level,channel])node.addEventListener(node===search?'input':'change',onFilter);
  const dispose=()=>{
    disposed=true;generation++;controller?.abort();read.removeEventListener('click',load);
    exportBtn.removeEventListener('click',onExport);
    for(const node of [search,level,channel])node.removeEventListener(node===search?'input':'change',onFilter);
    win.removeEventListener('pagehide',dispose);
  };
  win.addEventListener('pagehide',dispose,{once:true});
  return {load,dispose};
}