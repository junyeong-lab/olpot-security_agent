// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView() {
  return {
    renderIdentity({ me, devices, sessions }) {
      // Render a fresh DOM tree for each snapshot; never retain the previous identity.
      const root = document.createElement('div');
      const text = (value) => typeof value === 'string' && value.trim() ? value : '확인 불가';
      const stateWithCode = (label, status) => `${label} (${text(status)})`;
      const deviceState = (status) => stateWithCode(({
        compliant: '보안 기준 충족',
        noncompliant: '보안 기준 미충족',
        unknown: '확인 불가',
      })[status] || '확인 불가', status);
      const sessionState = (status) => stateWithCode(({
        active: '활성',
        expired: '만료',
        revoked: '철회됨',
        unknown: '확인 불가',
      })[status] || '확인 불가', status);

      const add = (parent, tagName, content) => {
        const node = document.createElement(tagName);
        node.textContent = content;
        parent.appendChild(node);
        return node;
      };

      const section = (heading, resource, showData) => {
        const box = document.createElement('section');
        add(box, 'h3', heading);
        const mode = resource?.mode;
        if (mode === 'demo') add(box, 'p', '예제 자료');
        else if (mode === 'disconnected') add(box, 'p', '연결 없음');
        else if (mode === 'unknown') add(box, 'p', '확인 불가');

        if (resource?.status === 'loading') {
          add(box, 'p', '불러오는 중');
        } else if (resource?.status === 'error') {
          add(box, 'p', '연결 실패: ' + text(resource?.error?.message));
        } else if (resource?.status === 'ok') {
          showData(box, resource.data);
        } else {
          add(box, 'p', '확인 불가');
        }
        root.appendChild(box);
      };

      section('현재 계정·기기·세션', me, (box, data) => {
        const user = data?.user;
        const device = data?.device;
        const session = data?.session;
        add(box, 'p', '사용자: ' + text(user?.label) + ' (ID: ' + text(user?.id) + ')');
        add(box, 'p', '현재 기기: ' + text(device?.label) + ' (ID: ' + text(device?.id) + ') · 상태: ' + deviceState(device?.status));
        add(box, 'p', '현재 세션: ' + text(session?.id) + ' · 상태: ' + sessionState(session?.status));
      });

      section('기기 목록', devices, (box, data) => {
        if (!Array.isArray(data)) return add(box, 'p', '기기 정보 확인 불가');
        if (!data.length) return add(box, 'p', '표시할 기기가 없습니다.');
        const list = document.createElement('ul');
        for (const device of data) {
          add(list, 'li', text(device?.label) + ' (ID: ' + text(device?.id) + ') · 상태: ' + deviceState(device?.status));
        }
        box.appendChild(list);
      });

      section('세션 목록', sessions, (box, data) => {
        if (!Array.isArray(data)) return add(box, 'p', '세션 정보 확인 불가');
        if (!data.length) return add(box, 'p', '표시할 세션이 없습니다.');
        const list = document.createElement('ul');
        for (const session of data) {
          add(list, 'li', '세션 ID: ' + text(session?.id) + ' · 상태: ' + sessionState(session?.status));
        }
        box.appendChild(list);
      });

      return root;
    },
    renderDecision({ status, mode, data, error, appId } = {}) {
      // Only display the currently selected app's decision; the provided UI owns the request button.
      const root = document.createElement('section');
      const safeText = (value) =>
        typeof value === 'string' && value.trim() ? value : '확인 불가';
      const addText = (tagName, value) => {
        const node = document.createElement(tagName);
        node.textContent = value;
        root.appendChild(node);
      };

      const currentAppId = typeof appId === 'string' && appId.trim()
        ? appId
        : (status === 'ok' ? safeText(data?.appId) : '미선택');

      addText('h3', '업무 앱 접근 판정');
      if (mode === 'demo') addText('p', '예제 자료: 실제 접근 판정이 아닙니다.');
      else if (mode === 'disconnected') addText('p', '연결 없음');
      else if (mode === 'unknown') addText('p', '연결 상태 확인 불가');

      if (status === 'idle') {
        addText('p', '업무 앱을 선택한 뒤 접속 요청 버튼을 눌러주세요.');
        return root;
      }

      addText('p', '선택한 업무 앱 ID: ' + currentAppId);

      if (status === 'loading') {
        addText('p', '접근 판정 확인 중입니다. 아직 결과가 없습니다.');
        return root;
      }

      if (status === 'error') {
        addText('p', '접근 판정 요청 실패: ' + safeText(error?.message));
        addText('p', '요청 실패는 접근 허용(allow) 또는 접근 거부(deny) 판정이 아닙니다.');
        return root;
      }

      if (status !== 'ok') {
        addText('p', '판정 상태 확인 불가. 접근 허용으로 판단할 수 없습니다.');
        return root;
      }

      const labels = {
        allow: '접근 허용',
        deny: '접근 거부',
        challenge: '추가 인증 또는 확인 필요',
        unknown: '판정 확인 불가',
      };
      const rawDecision = data?.decision;
      const decision = typeof rawDecision === 'string'
        && Object.hasOwn(labels, rawDecision) ? rawDecision : 'unknown';

      addText('p', '접근 판정: ' + labels[decision] + ' (' + decision + ')');
      if (decision !== rawDecision && typeof rawDecision === 'string' && rawDecision.trim()) {
        addText('p', '인식되지 않은 서버 상태 코드: ' + rawDecision);
      }
      addText('p', '판정 이유: ' + safeText(data?.reason));
      addText('p', '판정 시각: ' + safeText(data?.checkedAt));

      if (decision === 'allow') {
        addText('p', '정책상 접근 허용이며 실제 업무 앱 접속 성공을 보장하지 않습니다.');
      } else if (decision === 'challenge') {
        addText('p', '추가 인증 또는 확인이 필요합니다. 이 보안 Agent가 인증 절차를 대신 수행하지 않습니다.');
      } else if (decision === 'unknown') {
        addText('p', '접근 허용 여부를 확인할 수 없습니다. 허용된 것으로 취급하지 않습니다.');
      }
      return root;
    },
    renderEvents({ status, mode, data, error } = {}) {
      const root = document.createElement('section');
      const add = (parent, tag, value) => {
        const node = document.createElement(tag);
        node.textContent = value;
        parent.appendChild(node);
        return node;
      };
      const readable = (value) =>
        typeof value === 'string' && value.trim() ? value : '확인 불가';
      const appKey = (event) =>
        typeof event?.appId === 'string' ? event.appId : '';

      add(root, 'h3', '내 접속 기록·XDR 경보');
      add(root, 'p', '서버에서 전달받은 본인 범위의 최근 접속 기록과 저장된 XDR 경보입니다. 전체 직원 이력이나 실시간 위협 탐지가 아닙니다.');
      if (mode === 'demo') add(root, 'p', '예제 자료: 실제 계정 기록이 아닙니다.');
      else if (mode === 'disconnected') add(root, 'p', '연결 없음');
      else if (mode === 'unknown') add(root, 'p', '연결 상태 확인 불가');

      if (status === 'loading') {
        add(root, 'p', '보안 기록을 불러오는 중입니다.');
        return root;
      }
      if (status === 'error') {
        const message = readable(error?.message);
        add(root, 'p', '기록을 불러오지 못했습니다: ' + message);
        if (error?.code === 'CONTRACT_MISMATCH' || error?.code === 'ENGINE_RESULT_UNVERIFIED') {
          add(root, 'p', '응답 형식 또는 원천 자료를 확인할 수 없습니다. 이전 기록을 표시하지 않습니다.');
        }
        return root;
      }
      if (status !== 'ok' || !Array.isArray(data)) {
        add(root, 'p', '기록을 불러오지 못했습니다: 자료를 확인할 수 없습니다.');
        return root;
      }
      if (data.length === 0) {
        add(root, 'p', '표시할 기록이 없습니다.');
        return root;
      }

      // Work only on a copy. Date.parse handles offsets as well as ISO timestamps.
      const timestamp = (event) => {
        const value = Date.parse(event?.at);
        return Number.isFinite(value) ? value : null;
      };
      const records = [...data].sort((a, b) => {
        const left = timestamp(a);
        const right = timestamp(b);
        if (left === null) return right === null ? 0 : 1;
        if (right === null) return -1;
        return right - left;
      });

      const names = {
        access: { allowed: '접근 허용', denied: '접근 거부', unknown: '확인 불가' },
        session: { active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가' },
        device: { compliant: '보안 기준 충족', noncompliant: '보안 기준 미충족', unknown: '확인 불가' },
      };
      const stateLabel = (group, raw) => {
        const valid = typeof raw === 'string' && Object.hasOwn(names[group], raw);
        const code = valid ? raw : 'unknown';
        const extra = !valid && typeof raw === 'string' && raw.trim()
          ? ' · 원본 코드: ' + raw : '';
        return names[group][code] + '(' + code + ')' + extra;
      };
      const kindLabel = (kind) => kind === 'access'
        ? '접속 기록(access)' : kind === 'xdr'
          ? 'XDR 경보(xdr)' : '확인 불가(' + readable(kind) + ')';

      const filters = document.createElement('div');
      root.appendChild(filters);
      const filterSelect = (title, values, describe) => {
        const label = document.createElement('label');
        label.textContent = title;
        const select = document.createElement('select');
        select.setAttribute('aria-label', title);
        const all = document.createElement('option');
        all.value = 'all';
        all.textContent = '전체';
        select.appendChild(all);
        for (const value of [...new Set(values)]) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = describe(value);
          select.appendChild(option);
        }
        label.appendChild(select);
        filters.appendChild(label);
        return select;
      };

      const kindFilter = filterSelect('기록 종류', records.map(event => event.kind), kindLabel);
      const appFilter = filterSelect('업무 앱', records.map(appKey),
        value => value ? value : '앱 확인 불가');
      const accessFilter = filterSelect('접속 상태',
        records.map(event => event.state?.access ?? 'unknown'),
        value => stateLabel('access', value));

      const count = add(root, 'p', '');
      const list = document.createElement('ul');
      root.appendChild(list);

      const addReferences = (parent, heading, references) => {
        add(parent, 'h4', heading);
        if (!Array.isArray(references) || references.length === 0) {
          add(parent, 'p', '없음');
          return;
        }
        const entries = document.createElement('ul');
        for (const item of references) {
          add(entries, 'li', 'ID: ' + readable(item?.id) + ' · 내용: ' + readable(item?.text));
        }
        parent.appendChild(entries);
      };

      const showDetail = (event) => {
        const detail = document.createElement('section');
        detail.setAttribute('data-student-event-detail', readable(event?.id));
        add(detail, 'h4', '기록 상세: ' + readable(event?.id));
        add(detail, 'p', '사건 ID: ' + readable(event?.id));
        add(detail, 'p', '업무 앱 ID: ' + (appKey(event) || '앱 확인 불가'));
        add(detail, 'p', '발생 시각: ' + readable(event?.at));
        addReferences(detail, '근거(evidence)', event?.evidence);
        addReferences(detail, '규칙(rules)', event?.rules);
        add(detail, 'h4', '사건 당시 상태');
        add(detail, 'p', '접속 상태: ' + stateLabel('access', event?.state?.access));
        add(detail, 'p', '세션 상태: ' + stateLabel('session', event?.state?.session));
        add(detail, 'p', '기기 상태: ' + stateLabel('device', event?.state?.device));
        // A supplied action is only a disabled notice: never send execution requests.
        if (Array.isArray(event?.supportedActions) && event.supportedActions.length > 0) {
          add(detail, 'p', '아직 지원하지 않는 조치입니다. 조치 실행 연결은 준비 중이며 어떤 조치도 실행하지 않습니다.');
          for (const action of event.supportedActions) {
            const unavailable = document.createElement('button');
            unavailable.type = 'button';
            unavailable.disabled = true;
            unavailable.setAttribute('aria-disabled', 'true');
            unavailable.textContent = readable(action) + ' 미지원';
            detail.appendChild(unavailable);
          }
        }
        return detail;
      };

      const draw = () => {
        // Filter only the provided array, with no new server request.
        const visible = records.filter(event =>
          (kindFilter.value === 'all' || event.kind === kindFilter.value) &&
          (appFilter.value === 'all' || appKey(event) === appFilter.value) &&
          (accessFilter.value === 'all' || (event.state?.access ?? 'unknown') === accessFilter.value));
        count.textContent = '표시 중인 본인 기록: ' + visible.length + '건 / 전달받은 ' + records.length + '건';
        list.replaceChildren(); // Also removes any expanded details on filter changes.
        if (visible.length === 0) {
          add(list, 'li', '선택한 조건에 맞는 기록이 없습니다.');
          return;
        }
        for (const event of visible) {
          const row = document.createElement('li');
          row.setAttribute('data-student-event-id', readable(event?.id));
          add(row, 'p', '사건 ID: ' + readable(event?.id));
          add(row, 'p', '시각: ' + readable(event?.at));
          add(row, 'p', '종류: ' + kindLabel(event?.kind));
          add(row, 'p', '업무 앱 ID: ' + (appKey(event) || '앱 확인 불가'));
          add(row, 'p', '요약: ' + readable(event?.summary));
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = readable(event?.id) + ' 상세';
          button.setAttribute('aria-expanded', 'false');
          let expanded = null;
          button.addEventListener('click', () => {
            if (expanded) {
              expanded.remove();
              expanded = null;
              button.setAttribute('aria-expanded', 'false');
            } else {
              expanded = showDetail(event);
              row.appendChild(expanded);
              button.setAttribute('aria-expanded', 'true');
            }
          });
          row.appendChild(button);
          list.appendChild(row);
        }
      };
      kindFilter.addEventListener('change', draw);
      appFilter.addEventListener('change', draw);
      accessFilter.addEventListener('change', draw);
      draw();
      return root;
    },
    renderStatus({ devices, sessions, notifications, diagnostics, mode } = {}) {
      const root = document.createElement('section');
      const add = (parent, tagName, content) => {
        const element = document.createElement(tagName);
        element.textContent = content;
        parent.appendChild(element);
        return element;
      };
      const safeText = (value) =>
        typeof value === 'string' && value.trim() ? value : '확인 불가';
      const statusText = (raw, labels) => {
        const recognized = typeof raw === 'string' && Object.hasOwn(labels, raw);
        const code = recognized ? raw : 'unknown';
        return labels[code] + ' (' + code + ')';
      };
      const devicesLabels = {
        compliant: '보안 기준 충족',
        noncompliant: '보안 기준 미충족',
        unknown: '확인 불가',
      };
      const sessionsLabels = {
        active: '활성',
        expired: '만료',
        revoked: '철회됨',
        unknown: '확인 불가',
      };
      const retryText = '재조회하려면 위쪽 「다시 불러오기」 버튼을 직접 누르세요. 자동 재요청하지 않습니다.';
      const modeText = {
        connected: '연결됨',
        demo: '예제 자료 · 실제 연결이 아닙니다',
        disconnected: '연결 없음',
        unknown: '연결 상태 확인 불가',
      };

      add(root, 'h3', '기기·세션·알림·도움정보');
      if (typeof mode === 'string' && Object.hasOwn(modeText, mode)) {
        add(root, 'p', '전체 연결 모드: ' + modeText[mode] + ' (' + mode + ')');
      }
      add(root, 'p', '기기는 현재 사용자에게 등록된 최대 100대까지 확인합니다. 세션은 현재 검증된 연결 1개만 조회하며 과거 세션 전체 목록이 아닙니다.');

      const resourceMode = (parent, resource) => {
        if (typeof resource?.mode === 'string' && Object.hasOwn(modeText, resource.mode)) {
          add(parent, 'p', '자료 모드: ' + modeText[resource.mode] + ' (' + resource.mode + ')');
        }
      };
      const errorLine = (parent, source, resource) => {
        const error = resource?.error;
        const code = safeText(error?.code);
        add(parent, 'p', source + ' 불러오기 실패: ' + safeText(error?.message) + ' · 오류 코드: ' + code);
        if (/TIMEOUT|TIMED_OUT/i.test(code) || /시간 초과|시간이 초과/.test(safeText(error?.message))) {
          add(parent, 'p', source + ' 조회 시간이 초과됐습니다.');
        }
        add(parent, 'p', retryText);
      };

      const renderList = (name, resource, labels, isDevice) => {
        const block = document.createElement('section');
        add(block, 'h4', name);
        resourceMode(block, resource);
        if (resource?.status === 'loading') {
          add(block, 'p', name + ' 정보를 불러오는 중입니다.');
        } else if (resource?.status === 'error') {
          errorLine(block, name, resource);
        } else if (resource?.status === 'ok') {
          if (!Array.isArray(resource.data)) {
            add(block, 'p', name + ' 자료를 확인할 수 없습니다.');
            add(block, 'p', retryText);
          } else if (resource.data.length === 0) {
            add(block, 'p', isDevice ? '등록된 기기가 없습니다.' : '현재 연결이 없습니다.');
          } else {
            const list = document.createElement('ul');
            for (const item of resource.data) {
              const label = isDevice ? safeText(item?.label) + ' (ID: ' + safeText(item?.id) + ')' : '세션 ID: ' + safeText(item?.id);
              add(list, 'li', label + ' · 상태: ' + statusText(item?.status, labels));
            }
            block.appendChild(list);
          }
        } else {
          add(block, 'p', name + ' 정보는 아직 조회되지 않았습니다.');
        }
        root.appendChild(block);
      };

      renderList('등록 기기', devices, devicesLabels, true);
      renderList('현재 세션', sessions, sessionsLabels, false);

      const alerts = document.createElement('section');
      add(alerts, 'h4', '보안 알림');
      if (Array.isArray(notifications) && notifications.length > 0) {
        const list = document.createElement('ul');
        for (const notice of notifications) {
          add(list, 'li', '자료(resource): ' + safeText(notice?.resource)
            + ' · 코드(code): ' + safeText(notice?.code)
            + ' · 메시지: ' + safeText(notice?.message));
        }
        alerts.appendChild(list);
      } else if (Array.isArray(notifications)) {
        add(alerts, 'p', '주의할 알림이 없습니다.');
      } else {
        add(alerts, 'p', '알림 목록을 확인할 수 없습니다.');
      }
      root.appendChild(alerts);

      const support = document.createElement('section');
      add(support, 'h4', '도움정보');
      resourceMode(support, diagnostics);
      add(support, 'p', '도움 요청에 필요한 비밀 없는 진단 항목만 표시합니다. 복사는 사용자가 아래 버튼을 눌렀을 때만 실행됩니다.');
      const safeDiagnosticValue = (value) => {
        if (typeof value !== 'string' || !value.trim() || value.length > 160
          || /(?:bearer\s+|sk-[A-Za-z0-9_-]{12,}|(?:token|secret|password|api.?key|private.?key)\s*[:=])/i.test(value)) {
          return '확인 불가';
        }
        return value;
      };
      let copyText = null;
      if (diagnostics?.status === 'loading') {
        add(support, 'p', '도움정보를 불러오는 중입니다.');
      } else if (diagnostics?.status === 'error') {
        errorLine(support, '도움정보', diagnostics);
        add(support, 'p', '진단 정보를 다시 조회하려면 제공 화면의 「도움정보 불러오기」 버튼을 직접 누르세요.');
      } else if (diagnostics?.status === 'ok') {
        const data = diagnostics.data;
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          add(support, 'p', '진단 정보 형식을 확인할 수 없습니다.');
        } else {
          // Explicit allowlist: never copy other server fields, credentials, AI data or configuration.
          const approved = {
            requestId: safeDiagnosticValue(data.requestId),
            component: safeDiagnosticValue(data.component),
            version: safeDiagnosticValue(data.version),
            checkedAt: safeDiagnosticValue(data.checkedAt),
            engine: {
              mode: safeDiagnosticValue(data.engine?.mode),
              code: safeDiagnosticValue(data.engine?.code),
            },
          };
          add(support, 'p', 'requestId: ' + approved.requestId);
          add(support, 'p', 'component: ' + approved.component);
          add(support, 'p', 'version: ' + approved.version);
          add(support, 'p', 'checkedAt: ' + approved.checkedAt);
          add(support, 'p', 'engine.mode: ' + approved.engine.mode);
          add(support, 'p', 'engine.code: ' + approved.engine.code);
          copyText = JSON.stringify(approved, null, 2);
          add(support, 'pre', copyText);
        }
      } else {
        add(support, 'p', '도움정보를 아직 조회하지 않았습니다. 제공 화면의 「도움정보 불러오기」 버튼을 직접 누르세요.');
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = '도움정보 복사';
      button.setAttribute('aria-label', '도움정보 복사');
      button.disabled = copyText === null;
      support.appendChild(button);
      const copyResult = add(support, 'p', '');
      if (copyText !== null) {
        button.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(copyText);
            copyResult.textContent = '도움정보를 복사했습니다. 복사 내용에 비밀번호·토큰·API 키가 없는지 확인한 후 공유하세요.';
          } catch {
            copyResult.textContent = '자동 복사를 사용할 수 없습니다. 위에 표시된 안전한 도움정보만 선택해 Ctrl+C로 직접 복사하세요.';
          }
        });
      }
      root.appendChild(support);
      return root;
    },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection({ status, mode, data, error, checkedAt, explanationAccepted } = {}) {
      const root = document.createElement('section');
      const line = (tag, value) => {
        const node = document.createElement(tag);
        node.textContent = value;
        root.appendChild(node);
        return node;
      };
      // Input errors are already normalized by the provided UI. Still suppress credentials
      // and unbounded/raw provider details before rendering them.
      const safeCode = (value) => typeof value === 'string'
        && /^[A-Z][A-Z0-9_]{1,79}$/.test(value) ? value : 'AI_REQUEST_UNVERIFIED';
      const safeMessage = (value) => typeof value === 'string' && value.length > 0
        && value.length <= 500
        && !/(?:bearer\s+\S+|sk-[A-Za-z0-9_-]{12,}|(?:api[_ -]?key|token|password|secret|private[_ -]?key)\s*[:=]\s*\S+|eyJ[A-Za-z0-9_-]{20,})/i.test(value)
        ? value : 'AI 연결 또는 응답을 안전하게 확인할 수 없습니다.';
      const modes = {
        demo: '예제 데이터(demo) · 실제 AI 연결 아님',
        disconnected: '연결 없음(disconnected)',
        unknown: '연결 상태 확인 불가(unknown)',
        connected: '연결됨(connected)',
      };
      line('h3', '알레프게이트 AI 연결 상태');
      if (typeof mode === 'string' && Object.hasOwn(modes, mode)) {
        line('p', '연결 모드: ' + modes[mode]);
      }

      if (status === 'idle') {
        line('p', 'AI 연결 점검 전입니다. 이전 점검 결과는 현재 결과가 아닙니다.');
        line('p', '보호 현황의 계정 연결과 앱 권한을 확인한 다음, 사용자가 「현재 API 연결 점검」을 직접 눌러주세요.');
        return root;
      }
      if (status === 'loading') {
        line('p', '현재 로그인과 앱 권한으로 AI 모델 응답을 점검하는 중입니다.');
        line('p', '아직 점검 결과나 사건 설명 결과가 없습니다. 필요하면 제공 화면의 「취소」를 직접 누르세요.');
        return root;
      }
      if (status === 'error') {
        const code = safeCode(error?.code);
        line('p', 'AI 연결 점검 실패 · 오류 코드: ' + code);
        line('p', '오류 메시지: ' + safeMessage(error?.message));
        const guidance = {
          ON_AI_PROVISIONING_PENDING: '운영 측 학생 앱 계정·이용 권한 준비 중입니다. 담당자에게 연결 및 앱 권한을 확인받으세요.',
          SUBJECT_SCOPE_UNVERIFIED: '현재 로그인·프로젝트·사건 범위를 확인할 수 없습니다. 담당자에게 계정 연결을 확인받으세요.',
          WB_CLCO_AUTH_REQUIRED: '인증 실패: 계정 및 앱 전용 연결을 다시 확인하고 담당자에게 문의하세요. Workbench 열쇠를 복사하지 마세요.',
          WB_CLCO_ACCESS_BLOCKED: '접근 제한: 학생 앱 이용 권한을 담당자에게 확인받으세요.',
          ON_AI_AUTHORIZATION_CHANGED: '앱 권한이 점검 도중 변경됐습니다. 담당자에게 현재 권한을 확인받으세요.',
          WB_CLCO_COHORT_BUDGET_EXHAUSTED: '반의 AI 사용량이 소진됐습니다. 담당자에게 확인받으세요.',
          WB_CLCO_LIMIT_REACHED: 'AI 이용 한도에 도달했습니다. 담당자에게 확인받으세요.',
          WB_CLCO_SESSION_CLOSED: '현재 AI 이용 시간이 아닙니다. 이용 가능 시간을 확인하세요.',
          WB_CLCO_RATE_LIMITED: '요청 제한 중입니다. 잠시 뒤 사용자가 직접 다시 점검하세요.',
          WB_CLCO_TIMEOUT: 'AI 연결 점검 시간이 초과됐습니다. 잠시 뒤 직접 다시 점검하세요.',
          REQUEST_TIMEOUT: 'AI 연결 요청 시간이 초과됐습니다. 잠시 뒤 직접 다시 점검하세요.',
          ENGINE_TIMEOUT: '원천 확인 시간이 초과됐습니다. 잠시 뒤 직접 다시 점검하세요.',
          TIMEOUT: 'AI 연결 응답 시간이 초과됐습니다. 잠시 뒤 직접 다시 점검하세요.',
          WB_CLCO_CANCELLED: '요청이 취소됐습니다. 이전 응답은 현재 결과가 아닙니다.',
          CANCELLED: '요청이 취소됐습니다. 이전 응답은 현재 결과가 아닙니다.',
          REQUEST_CANCELLED: '요청이 취소됐습니다. 이전 응답은 현재 결과가 아닙니다.',
          NETWORK_ERROR: '네트워크 연결을 확인한 뒤 사용자가 직접 다시 점검하세요.',
          SERVICE_UNAVAILABLE: 'AI 연결 서버 이용이 어렵습니다. 네트워크 상태를 확인하고 담당자에게 문의하세요.',
          MODEL_NOT_CONFIGURED: '서버에서 이용할 AI 모델이 설정되지 않았습니다. 담당자에게 모델 설정을 확인받으세요.',
          ON_AI_MODEL_LIST_EMPTY: '현재 앱에서 사용할 수 있는 AI 모델이 없습니다. 담당자에게 모델 허용 설정을 확인받으세요.',
          ON_AI_INVALID_INPUT: '사건 입력 자료를 검증할 수 없습니다. 기존 보안 기록을 확인하세요.',
          ON_AI_INVALID_OUTPUT: 'AI 응답 형식과 근거를 검증할 수 없습니다. 기존 보안 기록을 확인하세요.',
          AI_REQUEST_UNVERIFIED: 'AI 연결·이용 권한 또는 응답을 확인할 수 없습니다. 담당자에게 확인받으세요.',
        };
        line('p', '확인 및 복구 방법: ' + (guidance[code] ||
          '연결 또는 권한 상태를 확인할 수 없습니다. 담당자에게 확인받고 직접 다시 점검하세요.'));
        line('p', '점검 실패는 접근 성공이나 사건 설명 성공이 아닙니다. 자동 재시도하지 않습니다.');
        return root;
      }

      if (status !== 'ok') {
        line('p', 'AI 연결 상태를 확인할 수 없습니다. 점검에 성공한 것으로 표시하지 않습니다.');
        return root;
      }

      if (data?.transportChecked !== true || !Number.isInteger(data?.modelCount)
        || data.modelCount < 0 || !['test', 'verified'].includes(data?.audienceAuthorization)
        || typeof checkedAt !== 'string' || !Number.isFinite(Date.parse(checkedAt))) {
        line('p', 'AI 점검 응답을 검증할 수 없습니다. 정상 연결로 간주하지 않습니다.');
        return root;
      }

      if (data.audienceAuthorization === 'test') {
        line('p', 'AI 연결 상태: 시험 연결 점검(test) · 실제 게이트 앱 권한 확인 아님');
      } else {
        line('p', 'AI 연결 상태: 앱 권한 확인 후 점검(verified) · 해당 시각 기준의 모델 응답 확인');
      }
      line('p', '모델 응답 점검: 수행됨 (transportChecked: true)');
      line('p', '응답 모델 수(modelCount): ' + String(data.modelCount));
      line('p', '점검 시각(checkedAt): ' + checkedAt);
      if (data.modelCount === 0) {
        line('p', '사용 가능한 모델이 0개입니다. 담당자에게 모델 허용 상태를 확인받으세요.');
      }
      line('p', '모델 연결 점검만 수행했습니다. 사건 설명은 아직 실행하지 않았습니다.');
      line('p', '실제 사건 설명은 보안 기록에서 사건 하나를 선택해 별도로 요청·검증해야 합니다.');
      if (explanationAccepted === true) {
        // A check response never proves an explanation; use the separate explanation resource.
        line('p', '사건 설명 수용 여부는 이 점검 결과로 확정하지 않습니다.');
      }
      return root;
    },
    renderExplanation({ event, explanation, checkedAt } = {}) {
      // Each render returns a fresh tree: old explanations and success markers are not reused.
      const root = document.createElement('section');
      const line = (tag, value) => {
        const element = document.createElement(tag);
        element.textContent = value;
        root.appendChild(element);
        return element;
      };
      const lines = (heading, values) => {
        line('h4', heading);
        const list = document.createElement('ul');
        for (const value of values) {
          const item = document.createElement('li');
          item.textContent = value;
          list.appendChild(item);
        }
        root.appendChild(list);
      };
      const safeCode = (value) => typeof value === 'string'
        && /^[A-Z][A-Z0-9_]{1,79}$/.test(value) ? value : 'AI_REQUEST_UNVERIFIED';
      const safeMessage = (value) => typeof value === 'string' && value.length > 0
        && value.length <= 500
        && !/(?:bearer\s+\S+|sk-[A-Za-z0-9_-]{12,}|(?:api[_ -]?key|token|password|secret|private[_ -]?key)\s*[:=]\s*\S+|eyJ[A-Za-z0-9_-]{20,})/i.test(value)
        ? value : 'AI 사건 설명 응답을 안전하게 확인할 수 없습니다.';
      const state = explanation?.status;
      const eventId = typeof event?.id === 'string' && event.id.trim() ? event.id : null;
      line('h3', '선택한 보안 사건의 AI 설명');

      // A failure must be visible even when the provider could not select an event.
      if (state === 'error') {
        const code = safeCode(explanation?.error?.code);
        line('p', 'AI 설명 실패 · 오류 코드: ' + code);
        line('p', '오류 메시지: ' + safeMessage(explanation?.error?.message));
        if (code === 'ON_AI_INVALID_INPUT') {
          line('p', '근거 부족 또는 입력 오류: 설명에 필요한 사건 근거·규칙을 확인할 수 없어 설명할 수 없습니다.');
        } else if (code === 'ON_AI_INVALID_OUTPUT') {
          line('p', 'AI 설명을 사용할 수 없습니다. 근거 ID 누락·불일치, 지원하지 않는 조치, 비밀값 포함 또는 실행 완료 주장 등은 검증 실패 사유입니다.');
          line('p', 'AI가 이미 실행했다고 답한 설명은 사용할 수 없습니다. 실행 여부를 성공으로 간주하지 않습니다.');
        }
        if (eventId) line('p', '요청했던 사건 ID: ' + eventId);
        line('p', '보안 기록은 그대로 유지됩니다. AI 설명 실패는 과제 실패나 보안 조치 실행을 뜻하지 않습니다.');
        line('p', '실패·취소·시간 초과 후 이전 설명은 현재 결과가 아닙니다. 자동 재요청은 하지 않습니다.');
        return root;
      }
      if (!eventId) {
        line('p', '보안 기록에서 기록을 먼저 고르세요. 선택한 사건이 없어 AI 설명을 표시할 수 없습니다.');
        return root;
      }
      if (state === 'loading') {
        line('p', '설명 요청 중 · 아직 확인된 AI 설명은 없습니다.');
        line('p', '요청한 사건 ID: ' + eventId);
        return root;
      }
      if (!explanation || state === 'idle') {
        line('p', 'AI 사건 설명 요청 전입니다. 보안 기록에서 선택한 사건의 설명을 직접 요청하세요.');
        return root;
      }
      if (state !== 'ok') {
        line('p', 'AI 설명 상태를 확인할 수 없습니다. 보안 기록은 그대로 유지됩니다.');
        return root;
      }

      const data = explanation.data;
      const evidence = Array.isArray(event.evidence) ? event.evidence : [];
      const rules = Array.isArray(event.rules) ? event.rules : [];
      const supportedActions = Array.isArray(event.supportedActions) ? event.supportedActions : [];
      const evidenceIds = Array.isArray(data?.evidenceIds) ? data.evidenceIds : [];
      const proposals = Array.isArray(data?.proposals) ? data.proposals : null;
      const evidenceById = new Map(evidence.map((item) => [item?.id, item?.text]));
      const evidenceMatches = evidence.length > 0 && evidenceIds.length === evidence.length
        && new Set(evidenceIds).size === evidenceIds.length
        && new Set(evidence.map((item) => item?.id)).size === evidence.length
        && evidence.every((item) => typeof item?.id === 'string' && typeof item?.text === 'string' && item.text.trim())
        && evidenceIds.every((id) => typeof id === 'string' && evidenceById.has(id));
      const rulesPresent = rules.length > 0
        && rules.every((rule) => typeof rule?.id === 'string' && typeof rule?.text === 'string' && rule.text.trim());
      const validSummary = typeof data?.summary === 'string' && data.summary.trim().length > 0;
      const proposalsValid = proposals !== null && proposals.every((proposal) =>
        typeof proposal?.action === 'string' && supportedActions.includes(proposal.action)
        && typeof proposal.reason === 'string' && proposal.reason.trim()
        && Array.isArray(proposal.evidenceIds) && proposal.evidenceIds.length > 0
        && new Set(proposal.evidenceIds).size === proposal.evidenceIds.length
        && proposal.evidenceIds.every((id) => evidenceById.has(id)));
      const notExecuted = data?.executed === false && data?.requiresHumanConfirmation === true;

      // The upstream validator also checks this contract; reject malformed snapshots defensively.
      if (!validSummary || !evidenceMatches || !rulesPresent || !proposalsValid || !notExecuted) {
        line('p', 'AI 설명을 사용할 수 없습니다. 선택한 사건의 근거·규칙·응답 검증에 실패했습니다.');
        if (evidence.length === 0 || rules.length === 0) {
          line('p', '근거 부족 또는 입력 오류: 사건 근거·규칙이 없어 설명할 수 없습니다.');
        }
        if (!evidenceMatches) {
          line('p', '근거 불일치: AI가 인용한 근거 ID가 현재 사건의 근거 ID와 일치하지 않거나 누락·중복되었습니다. 없는 근거를 만들지 않습니다.');
        }
        if (data?.executed === true) {
          line('p', 'AI가 이미 실행했다고 답한 설명은 사용할 수 없습니다. 조치 실행 사실을 확인하지 않았습니다.');
        }
        if (!proposalsValid) {
          line('p', '지원하지 않는 조치나 잘못된 제안 근거는 사용할 수 없습니다.');
        }
        if (explanation?.error?.code) line('p', '오류 코드: ' + safeCode(explanation.error.code));
        line('p', '보안 기록은 그대로이며 보안 조치는 실행되지 않았습니다.');
        return root;
      }

      // Mark success only after matching every cited ID and rejecting invalid proposals.
      root.setAttribute('data-student-explanation-event', eventId);
      line('h4', 'AI 설명(참고용)');
      line('p', '사건 ID: ' + eventId);
      line('p', 'AI 설명 요약: ' + data.summary);
      if (typeof checkedAt === 'string' && Number.isFinite(Date.parse(checkedAt))) {
        line('p', '설명 응답 확인 시각: ' + checkedAt);
      }
      line('p', 'AI 설명은 참고용 해석입니다. 사실 판단은 사건 근거와 연동 시스템이 알려 준 현재 상태를 기준으로 합니다.');

      lines('인용한 근거 ID 및 근거 글', evidenceIds.map((id) => id + ' — ' + evidenceById.get(id)));
      lines('적용 규칙 ID 및 규칙 글', rules.map((rule) => rule.id + ' — ' + rule.text));

      line('h4', '현재 상태(원천 기록)');
      const stateItems = [
        ['access', '접속'], ['session', '세션'], ['device', '기기'],
      ];
      const unknownItems = [];
      for (const [key, label] of stateItems) {
        const value = event.state?.[key];
        if (value === 'unknown') {
          line('p', label + ': 확인 불가(unknown)');
          unknownItems.push(label + ': 확인 불가(unknown)');
        } else {
          line('p', label + ': ' + (typeof value === 'string' && value ? value : '확인 불가(값 없음)'));
        }
      }
      line('p', '확인 불가 상태: ' + (unknownItems.length > 0 ? unknownItems.join(', ') : '없음'));

      line('h4', '조치 제안');
      if (proposals.length === 0) {
        line('p', supportedActions.length === 0
          ? '연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상).'
          : 'AI가 이 사건에 제안한 조치가 없습니다. 근거를 확인하고 담당자가 판단하세요.');
      } else {
        lines('AI 조치 제안(미실행)', proposals.map((proposal) =>
          proposal.action + ' — 이유: ' + proposal.reason
          + ' · 근거 ID: ' + proposal.evidenceIds.join(', ')
          + ' · 사람 확인이 필요하며 아직 실행되지 않았습니다.'));
      }
      line('p', 'AI 제안은 실행 명령이 아닙니다. 사람 확인이 필요하며 어떤 보안 조치도 실행되지 않았습니다(executed:false).');
      return root;
    },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
