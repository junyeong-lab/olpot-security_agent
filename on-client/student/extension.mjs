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
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
