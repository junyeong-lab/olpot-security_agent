# 올폿 — 로컬 PC 상태 확장 (SI 실습)

이 개발 브랜치는 중앙 관제, Wazuh, XDR, 원격 수집, 자동 차단을 포함하지 않습니다. 기존 프로젝트와 main을 그대로 유지합니다.

## 확인 항목

기존 구현: CPU(200ms 표본), RAM, 앱 실행 위치 디스크, 네트워크 인터페이스 개수, Windows 방화벽, System/Application 오류 및 경고 건수.

추가 구현: Windows 내장 VPN의 현재 사용자 프로필/연결 개수(Get-VpnConnection), Microsoft Defender 실시간 보호 상태(Get-MpComputerStatus), Windows Security 4624·4625 대화형 로그인 유형(2·7·10·11)의 최근 24시간 성공·실패 집계.

Windows VPN 조회는 OpenVPN·WireGuard·Wintun·TAP 연결 상태를 나타내지 않습니다. Defender 결과는 타사 백신 상태를 나타내지 않습니다. 로그인은 최대 1,000건 표본으로, 감사 정책·권한에 따라 누락되거나 확인 불가일 수 있습니다.

로컬 읽기 전용 PowerShell 조회 결과에는 계정명, IP, VPN 프로필명, 백신 제품명, 이벤트 원문, 인증 정보가 포함되지 않습니다. 기존 로컬 전용 HTTP 서버의 호스트·Origin 검증을 그대로 사용합니다.

## 실행

Node.js 권장 환경 24.19.0. on-client 폴더에서 npm start(또는 tools/start-alekov.ps1)를 실행하고 http://127.0.0.1:5189 에 접속하여 보호 현황 > 내 PC 확인을 클릭합니다. 연결되지 않은 다른 업무 시스템 상태를 정상으로 보이지 않습니다.

## 테스트

on-client 폴더에서 다음 명령 실행: node --test test/local-pc-checks.test.mjs

단위 테스트는 변환 로직, 표시 문구, 미지원 플랫폼에서의 처리에 한정됩니다. Windows 실제 PC의 VPN/Defender/Security 로그 동작은 해당 환경에서 별도 검증해야 합니다.

## 보안관제 제외

Wazuh, Suricata, XDR, pfSense 연결 및 사용자별 관제 데이터 표시/차단은 이 브랜치 범위 밖입니다.