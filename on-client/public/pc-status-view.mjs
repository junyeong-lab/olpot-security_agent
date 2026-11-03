// 이 PC의 조회 결과만 표시한다. SDP 연결 표시·AI 입력·원격 전송과 독립적이다.
const REASONS = {
  permission_denied: '읽기 권한이 없습니다. 관리자 권한으로 바꾸기 전에 담당자에게 확인하세요.',
  unsupported: '이 운영체제에서는 이 항목을 조회하지 않습니다.',
  timeout: '조회 시간이 초과됐습니다. 잠시 후 다시 확인하세요.',
};
const bytes = n => `${(n / 1024 ** 3).toFixed(1)} GB`;
const number = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const percent = n => number(n) && n <= 100;
const counter = n => Number.isSafeInteger(n) && n >= 0;

export function pcMetricText(key, metric) {
  if (metric?.state !== 'ok') return {text: '확인 불가', note: REASONS[metric?.reason] ?? '이번 조회에서 값을 확인하지 못했습니다. 다시 확인해 주세요.', state: 'unavailable'};
  let text, note;
  if (key === 'cpu' && percent(metric.usagePercent)) {
    text = `${metric.usagePercent.toFixed(1)}% 사용`; note = '짧은 구간의 실측값입니다. 계속 높으면 사용 중인 앱을 확인하세요.';
  } else if (key === 'memory' && number(metric.usedBytes) && number(metric.totalBytes) && metric.totalBytes > 0 && metric.usedBytes <= metric.totalBytes) {
    text = `${bytes(metric.usedBytes)} / ${bytes(metric.totalBytes)}`; note = metric.usedBytes / metric.totalBytes >= .85 ? '메모리 사용량이 높습니다. 필요한 작업을 저장하고 사용 중인 앱을 확인하세요.' : '사용 중인 메모리와 전체 메모리입니다.';
  } else if (key === 'disk' && number(metric.freeBytes) && number(metric.totalBytes) && metric.totalBytes > 0 && metric.freeBytes <= metric.totalBytes) {
    text = `${bytes(metric.freeBytes)} 여유 / ${bytes(metric.totalBytes)}`; note = metric.freeBytes / metric.totalBytes < .1 ? '남은 공간이 적습니다. 삭제하기 전에 파일을 확인하고 백업하세요.' : '현재 앱이 있는 디스크의 여유 공간입니다.';
  } else if (key === 'network' && counter(metric.interfaceCount) && counter(metric.ipv4Count)) {
    text = `네트워크 인터페이스 ${metric.interfaceCount}개 · IPv4 구성 ${metric.ipv4Count}개`; note = '로컬 구성 요약입니다. 인터넷 접속이나 ZTNA 허용을 확인한 결과는 아닙니다.';
  } else if (key === 'firewall' && Array.isArray(metric.profiles) && metric.profiles.length === 3 && ['Domain', 'Private', 'Public'].every(name => metric.profiles.some(p => p.name === name && typeof p.enabled === 'boolean'))) {
    text = metric.profiles.map(p => `${p.name} ${p.enabled ? '켜짐' : '꺼짐'}`).join(' · '); note = 'Windows 방화벽 설정을 읽었습니다. 앱이 설정을 바꾸지 않습니다. 보호 전체의 안전 판정은 아닙니다.';
  } else if (key === 'events' && counter(metric.warningCount) && counter(metric.errorCount) && metric.warningCount + metric.errorCount <= 5000 && metric.sampleLimit === 5000 && typeof metric.truncated === 'boolean') {
    text = `최근 24시간 경고 ${metric.warningCount}건 · 오류 ${metric.errorCount}건${metric.truncated ? ' (일부 집계)' : ''}`;
    const top = Array.isArray(metric.topErrors) && metric.topErrors.length && metric.topErrors[0];
    note = top && typeof top.providerName === 'string' && counter(top.eventId) && counter(top.count) && top.count <= metric.errorCount
      ? `주요 반복 오류: ${top.providerName} (이벤트 ${top.eventId}) ${top.count}건. System·Application 최대 5,000건 표본이며 침해 사고 판정이 아닙니다.`
      : 'System·Application 기록을 최대 5,000건까지 읽습니다. 오류 건수는 침해 사고 판정이 아닙니다.';
  } else if (key === 'vpn' && metric.scope === 'current-user-windows-vpn' && counter(metric.configuredCount) && counter(metric.connectedCount) && metric.connectedCount <= metric.configuredCount) {
    text = `Windows VPN 연결 ${metric.connectedCount}개 / 등록 ${metric.configuredCount}개`;
    note = '현재 사용자의 Windows 내장 VPN만 확인했습니다. OpenVPN 등 타사 VPN 및 VPN 서버 접속 성공 여부는 별도 확인이 필요합니다.';
  } else if (key === 'antivirus' && metric.provider === 'microsoft-defender' && typeof metric.realtimeEnabled === 'boolean') {
    text = `Microsoft Defender 실시간 보호 ${metric.realtimeEnabled ? '켜짐' : '꺼짐'}`;
    note = 'Microsoft Defender만 확인했습니다. 타사 백신 보호 여부나 PC 전체의 안전을 판정하지 않습니다.';
  } else if (key === 'avProducts' && metric.source === 'windows-security-center' &&
    Array.isArray(metric.productNames) && metric.productNames.length <= 8 &&
    metric.productNames.every(name => typeof name === 'string' && name.length > 0 && name.length <= 100) &&
    typeof metric.truncated === 'boolean') {
    text = metric.productNames.length
      ? `등록 백신 ${metric.productNames.length}종: ${metric.productNames.join(' · ')}${metric.truncated ? ' 외' : ''}`
      : '등록된 백신 제품 확인되지 않음';
    note = 'Windows 보안 센터에 등록된 제품명입니다. 등록만으로 실시간 보호·업데이트·안전을 판단할 수 없습니다. 실제 보호 상태는 Windows 보안에서 확인하세요.';
  } else if (key === 'signins' && counter(metric.successCount) && counter(metric.failureCount) && metric.successCount + metric.failureCount <= 1000 && metric.sampleLimit === 1000 && typeof metric.truncated === 'boolean') {
    text = `최근 24시간 로그인 성공 ${metric.successCount}건 · 실패 ${metric.failureCount}건${metric.truncated ? ' (일부 집계)' : ''}`;
    note = 'Windows Security 4624·4625의 대화형 로그인 표본 최대 1,000건입니다. 사용자 정보·IP·로그 본문은 표시하지 않습니다. 감사 정책·접근 권한에 따라 일부 기록이 없을 수 있습니다.';
  }
  return text ? {text, note, state: 'measured'} : {text: '확인 불가', note: '응답의 값이나 단위를 확인할 수 없습니다. 정상으로 판단하지 마세요.', state: 'unavailable'};
}

// 직원에게 필요한 요약만 제공한다. Windows 백신 등록과 서버 연결을 안전/승인 판정으로 바꾸지 않는다.
export function employeePcSummary(metrics = {}) {
  const av = metrics.avProducts;
  let antivirus = {text: '보호 상태 확인 필요', note: 'Windows 보안에서 백신의 실제 보호 상태를 확인하세요.', state: 'unavailable'};
  if (av?.state === 'ok' && av.source === 'windows-security-center' && Array.isArray(av.productNames) && av.productNames.length > 0) {
    const names = av.productNames.filter(v => typeof v === 'string' && v.length > 0).slice(0, 2);
    if (names.length) antivirus = {
      text: `${names.join(' · ')}${av.productNames.length > 2 || av.truncated ? ' 외' : ''} 등록`,
      note: '등록 정보만 확인했습니다. 백신이 실제로 보호 중인지는 Windows 보안에서 확인하세요.',
      state: 'measured'
    };
  } else if (metrics.antivirus?.state === 'ok' && metrics.antivirus.provider === 'microsoft-defender' && metrics.antivirus.realtimeEnabled === true) {
    antivirus = {text: 'Microsoft Defender 실시간 보호 켜짐', note: 'Defender 조회 결과이며 PC 전체의 안전 판정은 아닙니다.', state: 'measured'};
  }
  const profiles = metrics.firewall?.profiles;
  let firewall = {text: '방화벽 설정 확인 필요', note: '방화벽 상태를 읽지 못했습니다.', state: 'unavailable'};
  if (metrics.firewall?.state === 'ok' && Array.isArray(profiles) && profiles.length === 3 && ['Domain','Private','Public'].every(name => profiles.some(p => p.name === name && typeof p.enabled === 'boolean'))) {
    firewall = profiles.every(p => p.enabled)
      ? {text: 'Windows 방화벽 켜짐', note: '3개 프로필 설정 확인. 전체 보안 상태 판정은 아닙니다.', state: 'measured'}
      : {text: '방화벽 설정 점검 필요', note: '꺼진 프로필이 있습니다. IT 담당자에게 문의하세요.', state: 'attention'};
  }
  let storage = {text: '저장 공간 확인 필요', note: '디스크 조회 결과가 없습니다.', state: 'unavailable'};
  const disk = metrics.disk;
  if (disk?.state === 'ok' && number(disk.totalBytes) && disk.totalBytes > 0 && number(disk.freeBytes) && disk.freeBytes <= disk.totalBytes) {
    storage = disk.freeBytes / disk.totalBytes < 0.1
      ? {text: `${bytes(disk.freeBytes)} 남음`, note: '저장 공간이 부족할 수 있습니다. 업무 파일을 임의 삭제하지 마세요.', state: 'attention'}
      : {text: `${bytes(disk.freeBytes)} 남음`, note: '이 앱이 있는 디스크의 여유 공간입니다.', state: 'measured'};
  }
  const connection = {text: '회사 연결 별도 확인', note: 'VPN 프로필 개수만으로 ZTNA·업무 시스템 접속을 판단하지 않습니다. 상단 연결 상태를 확인하세요.', state: 'unavailable'};
  return {antivirus, firewall, connection, storage};
}

export function mountPcStatus(host, {fetchImpl = globalThis.fetch?.bind(globalThis), intervalMs = 10000, timeoutMs = 10000} = {}) {
  const doc = host.ownerDocument, win = doc.defaultView;
  const make = (tag, text, cls) => {const node = doc.createElement(tag); if (text) node.textContent = text; if (cls) node.className = cls; return node;};
  const heading = make('h2', '내 PC 보안 상태');
  const intro = make('p', '회사 업무에 필요한 기본 상태를 먼저 확인합니다. 확인되지 않은 항목은 정상으로 판단하지 않습니다. PC 조회 결과는 AI나 외부 서버로 자동 전송하지 않습니다.', 'muted');
  const refresh = make('button', '내 PC 확인', 'btn'); refresh.type = 'button';
  const label = make('label', '', 'pc-auto'); const auto = doc.createElement('input'); auto.type = 'checkbox';
  label.append(auto, doc.createTextNode(' 10초마다 확인 (앱 탭이 보이는 동안)'));
  const status = make('p', '아직 조회하지 않았습니다.', 'muted'); status.setAttribute('role', 'status');
  const summaryGrid = make('div', '', 'pc-summary');
  const summaryRows = new Map();
  for (const [key, title] of Object.entries({antivirus:'백신',firewall:'방화벽',connection:'회사 연결',storage:'저장 공간'})) {
    const article=make('article','','pc-summary-card');
    const label=make('h3',title);
    const value=make('p','아직 확인하지 않음','pc-summary-value');
    const note=make('p','「내 PC 확인」을 눌러 주세요.','muted');
    article.append(label,value,note); summaryGrid.append(article);
    summaryRows.set(key,{article,value,note});
  }
  // 평소에는 직원용 요약만 표시하고, 요청할 때 같은 카드 안에서 전체 진단을 펼친다.
  const details=doc.createElement('details');
  details.className='pc-details';
  details.append(make('summary','상세 PC 정보 보기'));
  const grid = make('div', '', 'pc-metrics');
  const rows = new Map();
  for (const [key, title] of Object.entries({cpu: 'CPU', memory: '메모리', disk: '디스크', network: '네트워크', firewall: 'Windows 방화벽', events: 'Windows 기록', vpn: 'Windows VPN', antivirus: 'Microsoft Defender', avProducts: '등록된 백신', signins: 'Windows 로그인 기록'})) {
    const article = make('article', '', 'pc-metric'), value = make('p', '아직 조회하지 않음', 'pc-value'), note = make('p', '', 'muted');
    article.append(make('h3', title), value, note); grid.append(article); rows.set(key, {article, value, note});
  }
  details.append(grid);
  host.replaceChildren(heading, intro, refresh, label, status, summaryGrid, details);
  let disposed = false, controller = null, generation = 0, timer = null;
  function stopTimer() {if (timer !== null) win.clearTimeout(timer); timer = null;}
  function next() {stopTimer(); if (!disposed && auto.checked && !doc.hidden) timer = win.setTimeout(() => {void read();}, Math.max(10000, intervalMs));}
  function unavailable() {
    for (const row of [...rows.values(), ...summaryRows.values()]) {
      row.article.dataset.state='unavailable'; row.value.textContent='이번 조회 확인 불가';
      row.note.textContent='이전 값을 현재 상태로 표시하지 않습니다.';
    }
  }
  async function read() {
    if (disposed || doc.hidden) return;
    stopTimer(); controller?.abort(); const own = ++generation, abort = new AbortController(); controller = abort;
    refresh.disabled = true; status.textContent = '이 PC에서 읽는 중…';
    let timedOut = false;
    const deadline = win.setTimeout(() => {timedOut = true; abort.abort();}, timeoutMs);
    try {
      const stopped = new Promise((_, reject) => abort.signal.addEventListener('abort', () => reject(Error('cancelled')), {once: true}));
      const result = await Promise.race([Promise.resolve().then(async () => {
        const response = await fetchImpl('/api/pc/status', {cache: 'no-store', signal: abort.signal});
        if (!response.ok) throw Error('failed'); return response.json();
      }), stopped]);
      if (disposed || own !== generation) return;
      const data = result?.ok === true ? result.data : null;
      const measured = typeof data?.measuredAt === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(data.measuredAt) ? Date.parse(data.measuredAt) : NaN;
      if (data?.schema !== 'aleph.on.pc-status.v1' || data.source !== 'local-pc' || !Number.isFinite(measured) || Math.abs(Date.now() - measured) > 60000) throw Error('stale');
      for (const [key, row] of rows) {
        const info = pcMetricText(key, data.metrics?.[key]);
        row.article.dataset.state = info.state; row.value.textContent = info.text; row.note.textContent = info.note;
      }
      const employee = employeePcSummary(data.metrics);
      for (const [key, row] of summaryRows) {
        const info = employee[key];
        row.article.dataset.state=info.state; row.value.textContent=info.text; row.note.textContent=info.note;
      }
      status.textContent = `이 PC 마지막 실측 · ${new Date(measured).toLocaleString('ko-KR')} · 보안 서버 연결 상태와 별도`;
    } catch {
      if (disposed || own !== generation) return;
      unavailable(); status.textContent = timedOut ? REASONS.timeout : '이번 상태를 확인하지 못했습니다. 앱이 실행 중인지 확인하고 다시 조회하세요.';
    } finally {
      win.clearTimeout(deadline);
      if (!disposed && own === generation) {controller = null; refresh.disabled = false; next();}
    }
  }
  const visibility = () => {
    if (doc.hidden) {stopTimer(); generation++; controller?.abort(); controller = null; refresh.disabled = false; unavailable(); status.textContent = '화면을 보지 않는 동안 자동 확인을 멈췄습니다.';}
    else if (auto.checked) void read();
  };
  refresh.addEventListener('click', read);
  const onAuto = () => {if (auto.checked) void read(); else stopTimer();}; auto.addEventListener('change', onAuto);
  doc.addEventListener('visibilitychange', visibility);
  const dispose = () => {if (disposed) return; disposed = true; generation++; stopTimer(); controller?.abort(); refresh.removeEventListener('click', read); auto.removeEventListener('change', onAuto); doc.removeEventListener('visibilitychange', visibility); win.removeEventListener('pagehide', dispose);};
  win.addEventListener('pagehide', dispose, {once: true});
  return {read, dispose};
}
