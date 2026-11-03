// 본인 PC의 비식별 상태만 읽는다. 원격 호출·OS 설정 변경·권한 상승은 하지 않는다.
import os from 'node:os';
import {statfs} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';

const execute = promisify(execFile);
const diskRoot = fileURLToPath(new URL('../', import.meta.url));
// 명령과 조회 범위는 고정이다. 이벤트 본문·사용자·호스트·주소를 출력하지 않는다.
const WINDOWS_READ = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$result = @{}
function Read-FailureReason($failure) {
  if ($failure.Exception -is [System.UnauthorizedAccessException] -or $failure.FullyQualifiedErrorId -match 'AccessDenied|Unauthorized' -or $failure.CategoryInfo.Category -eq 'PermissionDenied') { return 'permission_denied' }
  return 'query_failed'
}
try {
  $profiles = @(Get-NetFirewallProfile -ErrorAction Stop | ForEach-Object {
    $enabled = switch ([string]$_.Enabled) { 'True' { $true }; 'False' { $false }; default { $null } }
    @{ name = [string]$_.Name; enabled = $enabled }
  })
  $result.firewall = @{ state = 'ok'; profiles = $profiles }
} catch { $result.firewall = @{ state = 'unavailable'; reason = (Read-FailureReason $_) } }
$since = (Get-Date).AddHours(-24)
try {
  $events = @()
  foreach ($log in @('System','Application')) {
    try { $events += @(Get-WinEvent -FilterHashtable @{ LogName = $log; StartTime = $since; Level = @(2,3) } -MaxEvents 5001 -ErrorAction Stop) }
    catch { if ($_.FullyQualifiedErrorId -notlike 'NoMatchingEventsFound*') { throw } }
  }
  $truncated = $events.Count -gt 5000
  $sample = @($events | Sort-Object -Property TimeCreated -Descending | Select-Object -First 5000)
  # Only aggregate error provider, event ID and count; do not return event message or identity.
  $topErrors = @($sample | Where-Object { $_.Level -eq 2 } |
    Group-Object -Property ProviderName, Id |
    Sort-Object -Property Count -Descending |
    Select-Object -First 3 |
    ForEach-Object {
      $entry = $_.Group[0]
      @{ providerName = [string]$entry.ProviderName; eventId = [int]$entry.Id; count = [int]$_.Count }
    })
  $result.events = @{ state = 'ok'; warningCount = @($sample | Where-Object { $_.Level -eq 3 }).Count; errorCount = @($sample | Where-Object { $_.Level -eq 2 }).Count; topErrors = @($topErrors); truncated = $truncated; sampleLimit = 5000; since = $since.ToUniversalTime().ToString('o') }
} catch {
  $result.events = @{ state = 'unavailable'; reason = (Read-FailureReason $_) }
}

# Current user's Windows built-in VPN only. Third-party VPNs are out of scope.
try {
  $vpnProfiles = @(Get-VpnConnection -ErrorAction Stop)
  $result.vpn = @{ state = 'ok'; scope = 'current-user-windows-vpn'; configuredCount = $vpnProfiles.Count; connectedCount = @($vpnProfiles | Where-Object { $_.ConnectionStatus -eq 'Connected' }).Count }
} catch { $result.vpn = @{ state = 'unavailable'; reason = (Read-FailureReason $_) } }
# Microsoft Defender only; do not infer third-party antivirus status.
try {
  $defender = Get-MpComputerStatus -ErrorAction Stop
  if ($null -ne $defender -and $defender.RealTimeProtectionEnabled -is [bool]) {
    $result.antivirus = @{ state = 'ok'; provider = 'microsoft-defender'; realtimeEnabled = [bool]$defender.RealTimeProtectionEnabled }
  } else { $result.antivirus = @{ state = 'unavailable'; reason = 'query_failed' } }
} catch { $result.antivirus = @{ state = 'unavailable'; reason = (Read-FailureReason $_) } }
# Names of Windows Security Center registered antivirus products only.
# Registration alone does not prove active protection; productState is intentionally not interpreted.
try {
  $registered = @(Get-CimInstance -Namespace 'root/SecurityCenter2' -ClassName 'AntiVirusProduct' -ErrorAction Stop |
    Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_.displayName) } |
    ForEach-Object { [string]$_.displayName } | Sort-Object -Unique)
  $result.avProducts = @{ state = 'ok'; source = 'windows-security-center'; productNames = @($registered | Select-Object -First 8); truncated = ($registered.Count -gt 8) }
} catch { $result.avProducts = @{ state = 'unavailable'; reason = (Read-FailureReason $_) } }
# Count Security 4624/4625 interactive sign-ins, max 1000 sampled events. No identities or event bodies are returned.
try {
  $security = @()
  try { $security = @(Get-WinEvent -FilterHashtable @{ LogName = 'Security'; Id = @(4624,4625); StartTime = $since } -MaxEvents 1001 -ErrorAction Stop) }
  catch { if ($_.FullyQualifiedErrorId -notlike 'NoMatchingEventsFound*') { throw } }
  $sample = @($security | Select-Object -First 1000)
  $success = 0
  $failure = 0
  foreach ($entry in $sample) {
    $typeIndex = if ($entry.Id -eq 4624) { 8 } else { 10 }
    if ($null -eq $entry.Properties -or $entry.Properties.Count -le $typeIndex) { throw 'EventSchemaUnsupported' }
    $logonType = [string]$entry.Properties[$typeIndex].Value
    if ($logonType -in @('2','7','10','11')) {
      if ($entry.Id -eq 4624) { $success++ }
      elseif ($entry.Id -eq 4625) { $failure++ }
    }
  }
  $result.signins = @{ state = 'ok'; successCount = $success; failureCount = $failure; truncated = ($security.Count -gt 1000); sampleLimit = 1000; since = $since.ToUniversalTime().ToString('o') }
} catch { $result.signins = @{ state = 'unavailable'; reason = (Read-FailureReason $_) } }
$result | ConvertTo-Json -Depth 5 -Compress
`;
const missing = reason => ({state: 'unavailable', reason});
const finite = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const count = n => Number.isSafeInteger(n) && n >= 0;
const cpuTimes = cpus => {
  if (!Array.isArray(cpus) || !cpus.length) return null;
  let idle = 0, total = 0;
  for (const cpu of cpus) {
    const times = cpu?.times;
    if (!times || !['user', 'nice', 'sys', 'idle', 'irq'].every(k => finite(times[k]))) return null;
    idle += times.idle; total += times.user + times.nice + times.sys + times.idle + times.irq;
  }
  return {idle, total};
};
export function cpuUsage(before, after) {
  const a = cpuTimes(before), b = cpuTimes(after);
  if (!a || !b || b.total <= a.total || b.idle < a.idle || b.idle - a.idle > b.total - a.total) return missing('invalid_sample');
  return {state: 'ok', usagePercent: Math.round(1000 * (1 - (b.idle - a.idle) / (b.total - a.total))) / 10};
}
export function normalizeWindowsStatus(raw) {
  const result = {firewall: missing('invalid_response'), events: missing('invalid_response'), vpn: missing('invalid_response'), antivirus: missing('invalid_response'), avProducts: missing('invalid_response'), signins: missing('invalid_response')};
  if (raw?.firewall?.state === 'unavailable') result.firewall = missing(raw.firewall.reason === 'permission_denied' ? 'permission_denied' : 'query_failed');
  const profiles = raw?.firewall?.profiles;
  if (raw?.firewall?.state === 'ok' && Array.isArray(profiles) && profiles.length === 3 && ['Domain', 'Private', 'Public'].every(name => profiles.some(p => p.name === name && typeof p.enabled === 'boolean'))) {
    result.firewall = {state: 'ok', profiles: ['Domain', 'Private', 'Public'].map(name => {const p = profiles.find(v => v.name === name); return {name, enabled: p.enabled};})};
  }
  const e = raw?.events;
  if (e?.state === 'unavailable') result.events = missing(e.reason === 'permission_denied' ? 'permission_denied' : 'query_failed');
  if (e?.state === 'ok' && count(e.warningCount) && count(e.errorCount) && e.warningCount + e.errorCount <= 5000 && e.sampleLimit === 5000 && typeof e.truncated === 'boolean' && typeof e.since === 'string' && Number.isFinite(Date.parse(e.since))) {
    result.events = {state: 'ok', warningCount: e.warningCount, errorCount: e.errorCount, truncated: e.truncated, sampleLimit: 5000, since: e.since};
  }

  // Invalid group details must not invalidate accurate overall event counts.
  const groups = e?.topErrors;
  if (result.events.state === 'ok' && Array.isArray(groups) && groups.length <= 3 &&
    groups.every(v => typeof v?.providerName === 'string' && v.providerName.length >= 1 &&
      v.providerName.length <= 120 && !/[\x00-\x1f\x7f<>]/.test(v.providerName) &&
      Number.isSafeInteger(v.eventId) && v.eventId >= 0 && Number.isSafeInteger(v.count) && v.count > 0) &&
    groups.reduce((sum, v) => sum + v.count, 0) <= result.events.errorCount) {
    result.events.topErrors = groups.map(v => ({providerName: v.providerName, eventId: v.eventId, count: v.count}));
  }

  const failure = item => missing(item?.reason === 'permission_denied' ? 'permission_denied' : 'query_failed');
  if (raw?.vpn?.state === 'unavailable') result.vpn = failure(raw.vpn);
  if (raw?.vpn?.state === 'ok' && raw.vpn.scope === 'current-user-windows-vpn' && count(raw.vpn.configuredCount) && count(raw.vpn.connectedCount) && raw.vpn.connectedCount <= raw.vpn.configuredCount) {
    result.vpn = {state: 'ok', scope: 'current-user-windows-vpn', configuredCount: raw.vpn.configuredCount, connectedCount: raw.vpn.connectedCount};
  }
  if (raw?.antivirus?.state === 'unavailable') result.antivirus = failure(raw.antivirus);
  if (raw?.antivirus?.state === 'ok' && raw.antivirus.provider === 'microsoft-defender' && typeof raw.antivirus.realtimeEnabled === 'boolean') {
    result.antivirus = {state: 'ok', provider: 'microsoft-defender', realtimeEnabled: raw.antivirus.realtimeEnabled};
  }
  if (raw?.avProducts?.state === 'unavailable') result.avProducts = failure(raw.avProducts);
  const products = raw?.avProducts;
  if (products?.state === 'ok' && products.source === 'windows-security-center' &&
    Array.isArray(products.productNames) && products.productNames.length <= 8 &&
    typeof products.truncated === 'boolean' &&
    products.productNames.every(name => typeof name === 'string' && name.length >= 1 &&
      name.length <= 100 && name.trim() === name && !/[\x00-\x1f\x7f<>]/.test(name)) &&
    new Set(products.productNames).size === products.productNames.length) {
    result.avProducts = {state: 'ok', source: 'windows-security-center', productNames: [...products.productNames], truncated: products.truncated};
  }
  if (raw?.signins?.state === 'unavailable') result.signins = failure(raw.signins);
  const v = raw?.signins;
  if (v?.state === 'ok' && count(v.successCount) && count(v.failureCount) && v.successCount + v.failureCount <= 1000 && v.sampleLimit === 1000 && typeof v.truncated === 'boolean' && typeof v.since === 'string' && Number.isFinite(Date.parse(v.since))) {
    result.signins = {state: 'ok', successCount: v.successCount, failureCount: v.failureCount, truncated: v.truncated, sampleLimit: 1000, since: v.since};
  }
  return result;
}

export function createPcStatusReader({system = os, disk = statfs, run = execute, platform = os.platform(), clock = () => new Date(), pause = wait} = {}) {
  return async function read({signal, directory = diskRoot} = {}) {
    signal?.throwIfAborted();
    const metrics = {};
    const cpu = (async () => {
      try {const before = system.cpus(); await pause(200, undefined, {signal}); metrics.cpu = {...cpuUsage(before, system.cpus()), sampleMs: 200};}
      catch {metrics.cpu = missing(signal?.aborted ? 'cancelled' : 'query_failed');}
    })();
    try {
      const totalBytes = system.totalmem(), freeBytes = system.freemem();
      metrics.memory = finite(totalBytes) && totalBytes > 0 && finite(freeBytes) && freeBytes <= totalBytes ? {state: 'ok', usedBytes: totalBytes - freeBytes, totalBytes} : missing('invalid_response');
    } catch {metrics.memory = missing('query_failed');}
    try {
      const entries = Object.values(system.networkInterfaces()).filter(Array.isArray).map(rows => rows.filter(row => row.internal === false));
      metrics.network = {state: 'ok', interfaceCount: entries.filter(rows => rows.length).length, ipv4Count: entries.flat().filter(row => row.family === 'IPv4' || row.family === 4).length};
    } catch {metrics.network = missing('query_failed');}
    const drive = (async () => {
      try {const d = await disk(directory); const totalBytes = Number(d.blocks) * Number(d.bsize), freeBytes = Number(d.bavail) * Number(d.bsize);
        metrics.disk = finite(totalBytes) && totalBytes > 0 && finite(freeBytes) && freeBytes <= totalBytes ? {state: 'ok', totalBytes, freeBytes} : missing('invalid_response');}
      catch {metrics.disk = missing('query_failed');}
    })();
    const windows = (async () => {
      if (platform !== 'win32') {for (const key of ['firewall','events','vpn','antivirus','avProducts','signins']) metrics[key] = missing('unsupported'); return;}
      try {
        const exe = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
        const {stdout} = await run(exe, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', WINDOWS_READ], {windowsHide: true, encoding: 'utf8', timeout: 8000, maxBuffer: 128 * 1024, signal});
        Object.assign(metrics, normalizeWindowsStatus(JSON.parse(stdout.trim())));
      } catch (error) {
        const reason = signal?.aborted ? 'cancelled' : error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ? 'query_failed' : error?.killed || error?.code === 'ETIMEDOUT' ? 'timeout' : 'query_failed';
        for (const key of ['firewall','events','vpn','antivirus','avProducts','signins']) metrics[key] = missing(reason);
      }
    })();
    await Promise.all([cpu, drive, windows]); signal?.throwIfAborted();
    return {schema: 'aleph.on.pc-status.v1', measuredAt: clock().toISOString(), source: 'local-pc', metrics};
  };
}
export const readPcStatus = createPcStatusReader();
