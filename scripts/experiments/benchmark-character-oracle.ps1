param(
  [ValidateRange(1,4)][int]$Parallelism=1,
  [ValidateSet('compare','batch','collect')][string]$Mode='compare',
  [string[]]$Schemas=@('snow_sipin','snow_sanpin','snow_shenyun_tone','snow_qingyun'),
  [string]$InputPath='scripts/data/character-budgeted-probes.json',
  [string]$OutputBase=''
)
$ErrorActionPreference='Stop'
$root=(Get-Location).Path
$base=if($OutputBase){[IO.Path]::GetFullPath($OutputBase)}else{Join-Path $root "output/oracle-comparison/p$Parallelism-$Mode"}
[IO.Directory]::CreateDirectory($base) | Out-Null
$pending=[Collections.Generic.Queue[string]]::new()
foreach($schema in $Schemas){$pending.Enqueue($schema)}
$active=[Collections.Generic.List[object]]::new()
$peak=0L
$minimumFree=[long]::MaxValue
$timer=[Diagnostics.Stopwatch]::StartNew()
try {
  while($pending.Count -gt 0 -or $active.Count -gt 0){
    $free=[long](Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory*1024
    $minimumFree=[Math]::Min($minimumFree,$free)
    $usage=0L
    foreach($job in $active){$job.Process.Refresh(); if(!$job.Process.HasExited){$usage+=$job.Process.WorkingSet64}}
    $peak=[Math]::Max($peak,$usage)
    if($free -lt 8GB -or $usage -gt 4GB){throw "Memory limit reached: free=$free workers=$usage"}
    foreach($job in @($active.ToArray())){
      if($job.Process.HasExited){
        if($job.Process.ExitCode -ne 0){throw "Worker failed: $($job.Schema), exit $($job.Process.ExitCode)"}
        $active.Remove($job) | Out-Null
      }
    }
    while($pending.Count -gt 0 -and $active.Count -lt $Parallelism){
      if($free-$usage -lt 10GB){break}
      $schema=$pending.Dequeue()
      $destination=Join-Path $base $schema
      [IO.Directory]::CreateDirectory($destination) | Out-Null
      $script=if($Mode -eq 'collect'){'scripts/collect-character-oracle.ts'}else{'scripts/experiments/benchmark-character-oracle.ts'}
      $arguments=@($script,$schema,$InputPath,'output/character-budgeted-round1/results/observations.jsonl',$destination,(Join-Path $root 'output/oracle-comparison/compiled'),$Mode)
      $quoted=($arguments|ForEach-Object {'"'+$_+'"'}) -join ' '
      $process=Start-Process bun -ArgumentList $quoted -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $destination 'stdout.log') -RedirectStandardError (Join-Path $destination 'stderr.log') -PassThru
      $active.Add(@{Process=$process;Schema=$schema})
    }
    if($active.Count -eq 0 -and $pending.Count -gt 0){throw 'Insufficient memory to start a worker'}
    Start-Sleep -Milliseconds 500
  }
  @{parallelism=$Parallelism;mode=$Mode;wallSeconds=$timer.Elapsed.TotalSeconds;sampledPeakWorkerBytes=$peak;minimumFreeBytes=$minimumFree;memoryBudgetBytes=4GB;reserveBytes=8GB} | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $base 'summary.json')
} finally {
  foreach($job in $active){if(!$job.Process.HasExited){Stop-Process -Id $job.Process.Id -Force}}
}
