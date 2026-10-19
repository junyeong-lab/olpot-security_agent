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
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
