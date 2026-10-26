# olpot 보안 Agent — 학생 실행 설명서와 시스템 구성도 (21단계)

**기록 기준:** 2026-10-26. 저장소: https://github.com/junyeong-lab/olpot-security_agent. 기존 시작 틀 버전: **0.2.11** (on-client/package.json 원본 확인). 이 문서는 학생이 추가한 실행 설명서이며, 제공 README·서버·화면·설정·판정 코드는 수정하지 않습니다.

**확인 등급:** **원본 확인** = GitHub 소스 및 제공 문서 읽음 / **PC 확인** = 사용자가 실제 PowerShell 결과 또는 앱 화면 열림을 보고함 / **모의 검증** = 가상의 데이터·요청으로 학생 화면/제공 흐름 검사 / **기다림(UNV)** = 실제 계정·시스템·브라우저 동작을 확인하지 못함. 모의 검증이나 공식 과제 소스 판정은 실제 운영 연결 증거가 아닙니다.

**이름:** 사용자가 정한 개인 보안 Agent 이름은 **olpot**입니다. 제공 앱이 출력하는 이름은 **케셰브**, package.json 이름은 **alekov-client-starter**입니다. 프로젝트 이름을 정해도 기존 스크립트·화면·폴더명은 자동으로 변경되지 않습니다.

## 1. 프로젝트의 목적, 기능과 실제 지원 환경

본 프로젝트는 직원 **본인 범위**의 사용자·기기·세션 상태, 업무 앱 접근 판정, 접속·XDR 기록을 표시하는 로컬 웹 보안 Agent입니다. 사건 근거에 대한 AI 설명, 조치 제안과 서버 접수/실제 효과의 구분, 설치 패키지의 공개 OSV 취약점 조회 상태도 별도 화면에 표시합니다. 학생 화면은 직접 접근 제어, AI 모델 호출 또는 보안 조치 실행을 대신하지 않습니다.

| 항목 | 저장소·실행에서 확인한 값 | 확인 등급 |
|---|---|---|
| 앱 버전·패키지 | on-client/package.json: 버전 **0.2.11**, 이름 **alekov-client-starter**, 모듈 타입 module | 원본 확인. **제품 v1.0 아님** |
| Node.js | package.json 기준 **24.19.0**. 시작 도구는 **22~24**를 허용하고 24.19.0을 권장 | 원본 확인. **이 PC의 설치 Node 버전은 아직 미확인** |
| 운영 체제·실행 | Windows PowerShell, on-client/tools/start-alekov.ps1 | 원본 확인 + 사용자 PC에서 실행 보고 |
| npm 의존성 | package.json에 외부 dependencies/devDependencies가 없으며 README는 의존성 0개 안내 | 원본 확인. 불필요한 npm install·패키지 교체 금지 |
| lock 파일 | GitHub의 **on-client/package-lock.json 경로는 조회되지 않음(404)** | 원본 확인. 현재 PC에서 해당 파일 및 node_modules 실제 설치 여부 **미확인** |
| 브라우저 주소 | http://127.0.0.1:5189/ | src/server.mjs의 loopback 바인딩 확인 + 사용자 PC에서 화면 열림 보고 |
| 메뉴 | **보호 현황 / 업무 앱 / 보안 기록** | public/index.html 원본 확인 |
| 실제 외부 연결 | 기본 실행은 SDP·AI 연결 설정 없음 | 사용자 PC에서 엔진 disconnected/AI configured false 확인. 실연결 **UNV** |

외부 npm 설치 명령이나 임의 패키지 다운그레이드를 21단계 실행 필수 절차로 넣지 않습니다. OSV 조회 결과가 없다는 이유로 보안 상태를 안전이라고 단정하지 않습니다.

## 2. 프로젝트 및 작업 폴더 구조

사용자 PC에서 확인된 Git 최상위 폴더:

~~~text
C:\Users\User\AppData\Local\ALEPH\Workbench\projects\olpot-security_agent\
~~~

그 아래 **on-client**가 실행 폴더입니다. 다음 경로는 GitHub 원본에서 확인했습니다.

~~~text
olpot-security_agent/                      <- Git 최상위; 커밋·제출 기준
└─ on-client/                               <- PowerShell 앱 실행 위치
   ├─ README.md                             [제공] 앱 소개·버전·실행
   ├─ package.json                          [제공] 실행 스크립트·Node 요구 버전
   ├─ .env.example                          [제공] 비밀 없는 설정 견본
   ├─ tools/
   │  └─ start-alekov.ps1                   [제공] Node 검사·로컬 서버 실행
   ├─ public/
   │  ├─ index.html                         [제공] 메뉴·버튼·학생 출력 영역
   │  ├─ app.js                             [제공] 서버 요청·취소·화면 상태·학생 함수 호출
   │  └─ vulnerabilities-view.mjs          [제공] 패키지 조회 응답 검증·기본 표시
   ├─ src/
   │  ├─ server.mjs                         [제공] 로컬 HTTP 서버
   │  ├─ engine.mjs                         [제공] disconnected·demo·engine adapter
   │  ├─ engine/
   │  │  ├─ sdp-host.mjs                    [제공] 명시 설정을 통한 SDP 연계
   │  │  └─ sdp-host-config.mjs             [제공] 외부 호스트 설정 검증
   │  ├─ ai/service.mjs                     [제공] AI 서비스 경계
   │  ├─ connection/native-context.mjs     [제공] 앱 native 계정 연결 경계
   │  ├─ actions/service.mjs                [제공] 조치 요청 경계
   │  └─ vulnerabilities/project-scan.mjs  [제공] 프로젝트 설치 정보·OSV 스캔
   ├─ student/
   │  ├─ extension.mjs                      [학생] 13~20단계 표시 함수 8개
   │  └─ engine-adapter.mjs                 [기존 제공] SDP host 기능 연결 견본
   └─ docs/
      ├─ STUDENT_PROMPTS.md                 [제공] 공식 단계 계약
      ├─ STUDENT_LAUNCH_GUIDE.md           [제공] 실행·종료
      ├─ CONNECTION_TROUBLESHOOT.md        [제공] 연결 오류 처리
      ├─ SDP_HOST_CONNECTION.md            [제공] SDP host 계약
      ├─ AI_SETUP_GUIDE.md                 [제공] AI 연결 안내
      └─ STUDENT_RUNBOOK.md                [학생] 21단계 문서(이 파일)
~~~

**수정 경계:** 단계 13~20에서 학생이 편집한 것은 student/extension.mjs의 createStudentView()에 있는 표시 함수입니다. public/app.js, src/*, tools/*, 제공 README·문서, 인증·판정 코드는 21단계에서도 변경하지 않습니다. 기존 Git 커밋과 이전 학생 성취 기록을 보존합니다.

## 3. 새 PowerShell 창에서 설치·실행·종료

### 3.1 준비할 프로그램

- **Windows PowerShell**, **Node.js 22~24** (수업·검수 기준 **24.19.0**), Chrome 또는 지원되는 PC 브라우저.
- 현재 PC의 정확한 Node 실행 버전은 **미확인**이므로 Node 24.19.0으로 실행했다고 단정하지 않습니다. 제공 실행 도구는 직접 Node를 찾아 버전을 검사합니다.
- README 기준 외부 npm 의존성이 0개입니다. 검증하지 않은 추가 설치 명령을 만들지 않습니다.
- 기존 폴더에 이미 작업물이 있으므로 새 프로젝트를 만들거나 기존 저장소를 초기화하지 않습니다.

### 3.2 PowerShell 열기 및 실행 — 사용자 PC에서 실행 경험 있음

파일 탐색기로 다음 **실제 앱 폴더**를 열고, 파일 탐색기 주소 표시줄에 **powershell**을 입력하여 새 PowerShell 창을 엽니다.

~~~text
C:\Users\User\AppData\Local\ALEPH\Workbench\projects\olpot-security_agent\on-client
~~~

이미 PowerShell을 열었다면, 실제 사용했던 아래 명령으로 앱 폴더에 들어갑니다.

~~~powershell
cd "$env:LOCALAPPDATA\ALEPH\Workbench\projects\olpot-security_agent\on-client"
~~~

그 폴더에서 제공 시작 스크립트를 실행합니다.

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1
~~~

**정상 시작 신호 — 시작 스크립트 원본 확인:**

~~~text
케셰브가 켜졌습니다. 브라우저에서 http://127.0.0.1:5189/ 을 여세요.
서버가 응답한 것만 확인했습니다. AI 연결 상태는 화면에서 따로 확인해 주세요.
끄려면 이 창에서 Ctrl+C 를 누르세요.
~~~

위 세 줄은 스크립트의 출력문을 읽고 적었습니다. **사용자가 실제로 세 줄 전체를 캡처해 확인한 것은 아니며**, 앱이 열렸다고 보고한 범위까지만 사용자 PC 확인입니다.

브라우저에 http://127.0.0.1:5189/ 를 엽니다. 보호 현황·업무 앱·보안 기록 화면을 확인합니다. **127.0.0.1은 사용자 PC 자신이며 기존 SDP 운영 서버의 주소가 아닙니다.** 앱이 열렸다는 것은 로컬 서버가 응답한다는 뜻이지 SDP/AI 연결 성공이 아닙니다.

### 3.3 종료와 재실행

1. 서버를 실행한 **PowerShell 창에서 Ctrl+C**를 눌러 종료합니다(제공 시작 가이드·스크립트에서 지정). 종료 동작의 독립 재현은 아직 미확인입니다.
2. 앱을 다시 켜려면 같은 on-client 폴더에서 동일한 시작 명령을 실행합니다. 사용자는 이전에 5189 포트에서 리스너가 없었던 상태를 확인한 뒤 이 명령으로 앱을 다시 열었습니다.
3. 소스만 갱신된 뒤 화면이 오래된 상태라면 Chrome에서 **Ctrl+Shift+R**로 다시 불러옵니다. 이것은 외부 연결 설정이나 인증을 바꾸지 않습니다.
4. -Background 옵션과 -Port 5190은 제공 스크립트에 정의돼 있으나 **이 PC의 직접 실행 결과는 미확인**입니다. 기본 실행 검증 절차에 포함하지 않습니다.

### 3.4 실제 실행해 본 읽기 전용 포트 확인

~~~powershell
Get-NetTCPConnection -LocalPort 5189 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, OwningProcess
~~~

사용자는 앱이 꺼져 있을 때 이 명령의 **출력이 비어 있음**을 확인했습니다. 이후 제공 스크립트로 앱이 열렸습니다. 시작 도구는 포트가 이미 사용 중이면 다른 프로그램을 임의 종료하지 않습니다.

## 4. 네 상자의 텍스트 시스템 구성도

아래 화살표는 **의도된 데이터 흐름**입니다. 외부 연계는 별도 설정이 있어야 하며 현재 실제 사용자 계정 연결 완료를 뜻하지 않습니다. 각 상자의 실제 소스 경로 또는 로컬 주소를 함께 적었습니다.

~~~text
+-----------------------------------------------------------+
| [1] PC 브라우저                                            |
| http://127.0.0.1:5189/                                     |
| on-client/public/index.html + public/app.js                 |
| 학생 결과 DOM: on-client/student/extension.mjs             |
+----------------------------+------------------------------+
                             | 로컬 loopback HTTP 요청
                             v
+-----------------------------------------------------------+
| [2] 로컬 Node.js 앱 서버                                  |
| on-client/src/server.mjs / src/engine.mjs                   |
| GET /api/me, /api/events, /api/vulnerabilities 등           |
| 기본 상태: disconnected                                   |
+----------------------+----------------------+-------------+
                       | 조건부                | 조건부
                       | (실제 UNV)             | (실제 UNV)
                       v                      v
+--------------------------------+ +--------------------------------+
| [3] 기존 접속 제어·XDR / SDP    | | [4] CLCO 앱 AI 게이트웨이       |
| src/engine/sdp-host.mjs         | | src/ai/service.mjs              |
| student/engine-adapter.mjs      | | src/connection/native-context.mjs|
| 담당자 SDP 호스트 설정 필요     | | 앱 전용 native 설정·권한 필요    |
| 실제 개인 원천 연결: UNV        | | 실제 앱 AI 연결: UNV             |
+--------------------------------+ +--------------------------------+
~~~

| 경로 | 실제 파일/API 및 책임 | 관측 |
|---|---|---|
| 브라우저 → 로컬 서버 | public/app.js에서 src/server.mjs의 로컬 API 요청; 제공 UI가 오류·취소·세대 관리를 담당 | 사용자가 브라우저 열림을 확인 |
| 로컬 서버 → SDP·접근 제어·XDR | src/engine.mjs, src/engine/sdp-host.mjs, student/engine-adapter.mjs. 승인된 외부 host 설정을 명시해야 함 | 기본 엔진 disconnected, 외부 연결 UNV |
| 로컬 서버 → CLCO 앱 AI | src/ai/service.mjs, src/connection/native-context.mjs. 앱 native 계정 연결 및 앱 권한은 Workbench CLCO와 별개 | 실제 학생 AI 계정·모델·사건 설명 UNV |
| 로컬 서버 → 공개 OSV | src/vulnerabilities/project-scan.mjs, GET /api/vulnerabilities. 프로젝트·공개 패키지 승인 목록 필요 | 실제 OSV 조회 UNV; 승인 목록/프로젝트 임의 수정 안 함 |
| 로컬 서버 → 학생 화면 | public/app.js의 스냅샷 → student/extension.mjs의 render 함수 → 표시 영역 | 학생 소스 및 모의 검증 확인 |

**실제 PC에서 확인된 연결 진단:** GET /api/diagnostics는 HTTP 200 / engine.mode=disconnected / engine.code=ENGINE_NOT_CONNECTED / ai.configured=false였습니다. GET /api/events는 HTTP 503 / ENGINE_NOT_CONNECTED였습니다. 기본 실행에 SDP host·native host 설정이 적용되지 않은 상태로 분석했으며, 이것을 원격 서버 장애나 실제 접근 거절의 증거로 주장하지 않습니다.

공개되지 않은 회사 서버 주소, 학생 개인 인증서, API 키, 토큰, 개인 설정 경로를 문서에 넣지 않습니다.

## 5. 구현한 함수 및 제공 기능의 경계

**학생 구현 위치:** on-client/student/extension.mjs의 createStudentView().

| 단계 | 함수 | 입력·화면 표시 책임 | 검사 수준 |
|---|---|---|---|
| 13 | renderIdentity | me/devices/sessions 각 요청 상태, 사용자·기기·세션 ID와 보안 상태 | 코드 확인, 사용자 공식 단계 통과 보고 |
| 14 | renderDecision | appId, allow/deny/challenge/unknown, 요청 오류, reason·checkedAt | 코드 확인, 사용자 공식 단계 통과 보고 |
| 15 | renderEvents | 접속·XDR 기록, 시각·필터·사건 상세, 근거 ID·규칙, 미지원 조치 표시 | 코드 확인, 사용자 공식 단계 통과 보고 |
| 16 | renderStatus | 기기·세션·알림, 안전 항목만 복사하는 도움정보 | 코드 확인, 사용자 공식 단계 통과 보고 |
| 17 | renderAiConnection | AI 점검 idle/loading/error/ok, test/verified 구분, 오류·권한 안내 | 코드 확인, 사용자 공식 단계 통과 보고 |
| 18 | renderExplanation | 사건 근거·규칙과 AI 응답 대조, 허위 조치 제안·실행 주장 거절 | 코드 확인, 사용자 공식 단계 통과 보고 |
| 19 | renderAction | prepared/executing/pending/unknown/succeeded 구분, ACK와 원천 관측 효과 구분 | 코드 확인 + 모의 검사, 사용자 공식 단계 통과 보고 |
| 20 | renderVulnerabilities | idle/loading/error/ok, complete/partial/not_checked/not_configured/unverifiable, 정확한 설치 버전·OSV ID·시각·부분 실패 구분 | 코드 확인 + **모의 27건/추가 18건**; 공식 20단계 평가 미확인 |

**제공 화면의 실제 버튼과 역할** (public/index.html 및 public/app.js 원본 대조):

| 실제 화면 버튼/메뉴 | 담당 | 구분 |
|---|---|---|
| 보호 현황 / 업무 앱 / 보안 기록 | 제공 UI의 탭 | 학생 함수의 버튼 아님 |
| 설치 패키지 조회 / 패키지 조회 취소 | 제공 UI의 조회·취소 | OSV 조회가 실제로 가능한지는 별개 |
| AI 연결 시작 / AI 연결 점검 | 제공 AI 연결 기능 | 모델 연결·사건 설명의 성공은 미확인 |
| 원천 결과만 재조회 / 조치 화면 취소 | 제공 조치 관리 | 조치 화면 취소는 이미 전달된 효과를 되돌리지 않음 |

**학생 출력 영역:** student-identity / student-decision / student-events / student-status / student-ai-connection / student-explanation / student-action / student-vulnerabilities는 모두 제공 HTML이 만들고 student/extension.mjs의 DOM을 그 안에 표시합니다. 학생 렌더 함수에서 인증 티켓, POST 실행 버튼, 서버 설정값을 새로 만들지 않습니다.

## 6. 오류·진단·복구 순서

| 화면이나 HTTP 코드 | 의미(추측 아닌 원본 기준) | 확인·복구 방법 | 증거 |
|---|---|---|---|
| 127.0.0.1:5189 접속 안 됨, 5189 포트 LISTEN 없음 | 로컬 서버가 꺼져 있을 수 있음 | 기존 앱 폴더에서 시작 도구 재실행. 포트 사용 프로그램 강제 종료 금지 | 사용자 PC에서 재현·복구 경험 |
| 앱 폴더가 아닙니다 / 시작 틀 폴더가 아닙니다 | 실행 위치·package.json 불일치 | Git 최상위가 아닌 on-client에서 스크립트 실행 | 제공 스크립트 |
| Node.js 가 없습니다 / Node 지원 버전 안내 | 설치 버전 문제 | Node 22~24(기준 24.19.0) 확인. 설치는 공식 안내 이용 | 제공 스크립트, 실제 설치 버전 미확인 |
| 포트 5189 사용 중 | 로컬 포트 충돌 | 담당 프로그램 확인 후 제공 안내의 다른 포트 옵션 참고; 강제 종료 금지 | 제공 스크립트 |
| ENGINE_NOT_CONNECTED / GET /api/events = 503 | 기존 SDP 원천 연결이 확인되지 않음 | 로컬 서버 실행과 외부 host 설정을 구분하고 담당자에게 승인 설정 문의 | 사용자 PC에서 확인 |
| NATIVE_HOST_DISABLED / ALEKOV_CONNECT_UNAVAILABLE | 앱 AI/native 연결 미설정 또는 이용 불가 | Workbench AI 연결과 구분; 담당자 앱 설정·권한 안내 기다림 | 제공 문서, 실제 앱 AI 연결 미확인 |
| ON_AI_PROVISIONING_PENDING | 담당자 권한 준비 또는 승인 미완료 | 승인·권한 상태 확인. 비밀값을 프로젝트에 복사하지 않음 | 제공 AI 연결 안내 |
| ON_AI_INVALID_INPUT / ON_AI_INVALID_OUTPUT | 사건 근거 부족 / AI 응답 검증 실패 | 기존 사건·근거·규칙 확인, 설명 또는 조치 성공으로 간주하지 않음 | 학생 소스 및 제공 계약 |
| 조치 pending / unknown | ACK 또는 결과 불명은 효과 확인이 아님 | 제공 화면의 원천 결과만 재조회. 임의 재집행 금지 | 학생 소스 및 제공 코드. 실제 집행 UNV |
| OSV not_configured | 프로젝트 조회 설정 필요 | 운영자 설정 준비; 학생이 대상 경로나 허용 목록을 임의 변경하지 않음 | 제공 계약 |
| OSV not_checked | 승인된 공개 조회 대상 없음 | 아직 조회하지 않은 상태로 기록 | 제공 계약 |
| OSV partial / unverifiable | 일부 패키지 실패 / lock 또는 해당 패키지 확인 불가 | 이미 받은 취약점 ID 보존, 실패를 안전으로 단정하지 않음 | 모의 검사 |
| OSV CANCELLED / TIMEOUT / CONTRACT_MISMATCH | 조회 취소·시간 초과·응답 검증 실패 | 이전 표를 현재 결과로 남기지 않음; 사용자가 제공 화면에서 직접 재조회 | 제공 코드와 모의 요청 18건 검증 |

특히 public/app.js의 **vulnerabilitiesGeneration + AbortController + 세대 비교**는 조회 취소·새 요청·새로고침 시 오래된 응답을 무시하도록 설계돼 있습니다. 학생 renderVulnerabilities는 호출할 때마다 새 DOM을 만들며 loading/error 시 이전 패키지 표를 반환하지 않습니다. 이 동작은 가상 API 응답으로 **추가 18건 통과**했으며 **사용자 PC 네트워크 탭에서 실서버 검증한 것은 아닙니다**.

비밀이 포함되지 않은 도움정보로 오류 상태를 기록하고 필요 시 담당자에게 전달합니다. 인증서·토큰·개인키·비밀번호를 채팅·Git·화면 캡처에 올리지 않습니다.

## 7. 확인한 범위와 기다림(UNV)

| 기능 | 결과 |
|---|---|
| 현재 on-client 시작 도구로 로컬 앱 열기 | **사용자 PC 확인:** 재실행 뒤 브라우저 화면 열림 보고 |
| 13~19단계 학생 화면 소스 | **코드 확인**, 사용자로부터 각 공식 통과 결과 보고 |
| 20단계 학생 화면 | **모의 테스트 45건(27+18) 통과**, GitHub에 코드 반영. 실제 설치 버전·OSV 데이터 대조 및 공식 20단계 통과 여부는 미확인 |
| 21단계 새 문서만 보고 새 PowerShell 창에서 독립 재현 | **미확인:** 이번 단계에서 직접 진행할 확인 |
| PC의 실제 Node 정확한 버전 | **미확인** |
| OSV 대상 프로젝트 package-lock.json과 로컬 node_modules 설치 버전 실제 대조 | **기다림(UNV)**; GitHub의 on-client/package-lock.json 미확인 |
| 개인 SDP/기기/기존 XDR 운영 연결·실판정 | **기다림(UNV)** |
| CLCO 앱 AI 실승인·모델 호출·사건 설명 | **기다림(UNV)** (Workbench AI 연결과 다름) |
| 실제 사람 확인 후 조치 집행 및 원천 효과 관측 | **기다림(UNV)**; 지원 조치 없음 |
| 22단계 새 환경 재현과 v1.0 | **미완료**. 아직 v1.0이라고 적지 않음 |

## 8. 21단계 직접 확인 순서 — 현재는 미확인

- [ ] 기존 로컬 Git 작업을 보존하고 **새 PowerShell 창**을 on-client 폴더에서 열기
- [ ] 3장의 실제 시작 명령과 스크립트 출력문 대조
- [ ] http://127.0.0.1:5189/ 의 탭·버튼·학생 영역과 문서의 표기 대조
- [ ] 실행 창에서 Ctrl+C 종료, 다시 실행. 다른 프로세스가 5189를 사용하면 새 서버 중복 실행 금지
- [ ] 현재 PC Node 정확한 버전, 로컬 package-lock.json 및 node_modules 실제 유무 대조
- [ ] 외부 SDP·AI·OSV·보안 조치는 준비되지 않은 상태를 **기다림(UNV)**으로 유지

사용자가 새 창에서 실제 실행 결과를 제공하기 전에는 위 체크박스를 완료로 바꾸지 않습니다.

## 9. 21·22단계 커밋 및 원문 전달 안내

이 단계는 **새 학생 문서 한 파일을 추가**하고 기존 13~20단계 코드를 변경하지 않으므로, 그 문서를 기존 소스와 함께 **동일한 한 커밋**으로 보존합니다. 이전 Git 커밋과 기존 문서를 덮어쓰지 않습니다.

- **21·22단계는 Workbench의 포털 제출 준비(13~20단계 지원) 대신 과제 화면에서 저장소 주소·40자리 커밋을 직접 입력**합니다.
- 비공개 저장소라면 과제 화면의 **비공개 저장소 원문 준비 방법 → 원문 전달 도구 받기**를 따릅니다. ZIP 도구와 출력 JSON은 프로젝트 밖에 보관합니다. 공개 저장소 전환이 필수는 아닙니다.
- student-source-cli.mjs 도구의 실제 위치·출력 위치·옵션 문구는 **과제 화면을 아직 확인하지 않았으므로 미확인**입니다. 임의 명령을 작성하지 않습니다. 프로젝트 **Git 최상위 폴더**에서 화면에 안내된 명령을 사용하고 --commit에는 실제 제출 커밋의 **40자리 SHA**를 씁니다.
- 원문 JSON 선택 후 저장소·커밋·단계를 확인합니다. **원문 전달 성공 ≠ AI 검토 통과**. 원문 전달만 실패한 경우 기존 접수를 보존하고 **원문만 다시 보내기**를 사용합니다.
- 토큰·비밀번호·API 키·개인키·실제 비밀 설정 파일은 문서·커밋·제출 원문에 넣지 않습니다. 설정은 운영자가 준비하고 Git 저장소 밖에 보관합니다.

## 10. 제공 원문 참고

- [시작 README](../README.md) · [학생 실행 도구 가이드](STUDENT_LAUNCH_GUIDE.md)
- [21단계 공식 안내](STUDENT_PROMPTS.md) · [API 계약](IMPLEMENTATION_CONTRACT.md)
- [오류별 도움](CONNECTION_TROUBLESHOOT.md) · [SDP 호스트 연결](SDP_HOST_CONNECTION.md)
- [AI 연결 안내](AI_SETUP_GUIDE.md)

**문서 작성과 Git 커밋 자체는 21단계 공식 통과나 외부 연결 성공을 증명하지 않습니다.**
