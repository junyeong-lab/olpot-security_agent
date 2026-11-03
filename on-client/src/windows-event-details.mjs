// Windows System/Application 이벤트의 비식별 메타데이터만 로컬에서 읽는다.
// 메시지 원문·사용자명·SID·IP·명령줄·경로 등 민감한 내용은 수집하지 않는다.
// 읽기 전용이며 이벤트 로그 설정 변경·권한 상승·원격 전송·영구 저장을 하지 않는다.
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';

const execute = promisify(execFile);
const LIMIT = 200;
const HOURS = 24;
const unavailable = reason => ({state:'unavailable', reason});
const isCount = value => Number.isSafeInteger(value) && value >= 0;
const safeProvider = value => typeof value === 'string' && value.length >= 1 &&
  value.length <= 120 && value.trim() === value && !/[\x00-\x1f\x7f<>]/.test(value);
const validTime = value => typeof value === 'string' &&
  /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));

// System/Application의 경고·오류만 채널별 최대 201개 조회 후 최신 200개 반환.
// PowerShell 이벤트 본문(Message, Properties, UserId 등)은 내보내지 않는다.
const WINDOWS_EVENTS_READ = String.raw`$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$since = (Get-Date).AddHours(-24)
try {
  $collected = @()
  foreach ($name in @('System', 'Application')) {
    try {
      $items = @(Get-WinEvent -FilterHashtable @{ LogName = $name; StartTime = $since; Level = @(2, 3) } -MaxEvents 201 -ErrorAction Stop)
    } catch {
      if ($_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*') { continue }
      throw
    }
    foreach ($item in $items) {
      $collected += [pscustomobject]@{
        time = $item.TimeCreated.ToUniversalTime().ToString('o')
        channel = [string]$name
        level = $(if ($item.Level -eq 2) { 'error' } else { 'warning' })
        eventId = [int]$item.Id
        provider = [string]$item.ProviderName
        recordId = [string]$item.RecordId
      }
    }
  }
  $recent = @($collected | Sort-Object -Property time -Descending | Select-Object -First 200)
  $result = @{
    state = 'ok'
    source = 'windows-event-log'
    hours = 24
    sampleLimit = 200
    truncated = ($collected.Count -gt 200)
    rows = @($recent)
  }
} catch {
  $reason = 'query_failed'
  if ($_.Exception -is [System.UnauthorizedAccessException] -or
      $_.FullyQualifiedErrorId -match 'AccessDenied|Unauthorized' -or
      $_.CategoryInfo.Category -eq 'PermissionDenied') { $reason = 'permission_denied' }
  $result = @{ state = 'unavailable'; reason = $reason }
}
$result | ConvertTo-Json -Depth 4 -Compress`;

export function normalizeWindowsEventDetails(raw) {
  if (raw?.state === 'unavailable') return unavailable(raw.reason === 'permission_denied' ? 'permission_denied' : 'query_failed');
  if (!raw || raw.state !== 'ok' || raw.source !== 'windows-event-log' ||
      raw.hours !== HOURS || raw.sampleLimit !== LIMIT || typeof raw.truncated !== 'boolean' ||
      !Array.isArray(raw.rows) || raw.rows.length > LIMIT) return unavailable('invalid_response');
  const events = [];
  for (const row of raw.rows) {
    if (!row || !validTime(row.time) || !['System','Application'].includes(row.channel) ||
        !['error','warning'].includes(row.level) || !isCount(row.eventId) || row.eventId > 65535 ||
        !safeProvider(row.provider) || typeof row.recordId !== 'string' ||
        !/^[1-9]\d{0,19}$/.test(row.recordId)) return unavailable('invalid_response');
    // 의도적으로 허용한 필드만 반환한다. 원본 메시지·사용자 식별 정보는 출력하지 않는다.
    events.push({time:row.time, channel:row.channel, level:row.level,
      eventId:row.eventId, provider:row.provider, recordId:row.recordId});
  }
  for (let i = 1; i < events.length; i++) {
    if (Date.parse(events[i - 1].time) < Date.parse(events[i].time)) return unavailable('invalid_response');
  }
  if (new Set(events.map(e => e.channel + ':' + e.recordId)).size !== events.length) return unavailable('invalid_response');
  return {state:'ok', source:'windows-event-log', hours:HOURS, sampleLimit:LIMIT,
    truncated:raw.truncated, events};
}

export function createWindowsEventDetailsReader({platform = os.platform(), run = execute, clock = () => new Date()} = {}) {
  return async function read({signal} = {}) {
    signal?.throwIfAborted();
    const measuredAt = clock().toISOString();
    if (platform !== 'win32') return {schema:'aleph.on.windows-events.v1', source:'local-pc', measuredAt, ...unavailable('unsupported')};
    let details;
    try {
      const executable = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      const {stdout} = await run(executable,
        ['-NoLogo','-NoProfile','-NonInteractive','-Command',WINDOWS_EVENTS_READ],
        {windowsHide:true, encoding:'utf8', timeout:8000, maxBuffer:128*1024, signal});
      details = normalizeWindowsEventDetails(JSON.parse(stdout.trim()));
    } catch (error) {
      const reason = signal?.aborted ? 'cancelled'
        : error?.killed || error?.code === 'ETIMEDOUT' ? 'timeout' : 'query_failed';
      details = unavailable(reason);
    }
    signal?.throwIfAborted();
    // 정규화 결과의 source(windows-event-log)가 API의 source(local-pc)를 덮지 않도록 마지막에 지정한다.
    return {schema:'aleph.on.windows-events.v1', measuredAt, ...details, source:'local-pc'};
  };
}

export const readWindowsEventDetails = createWindowsEventDetailsReader();
