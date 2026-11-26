param([ValidateRange(1,2)][int]$Parallelism=2,[string]$OutputBase='output/corpus-benchmark-current',[string[]]$Schemes=@('sipin','oc21-shape','oc21-tone','qingyun','rc26-shape','rc26-tone','liandao','zhudao','classic-shape','classic-tone','sbxh','flypy'))
$ErrorActionPreference='Stop'
$root=(Get-Location).Path
$base=[IO.Path]::GetFullPath($OutputBase)
[IO.Directory]::CreateDirectory($base)|Out-Null
bun scripts/experiments/benchmark-long-inputs.ts $base
if($LASTEXITCODE -ne 0){throw 'Input fingerprint check failed'}
$pending=[Collections.Generic.Queue[string]]::new()
foreach($scheme in $Schemes){$pending.Enqueue($scheme)}
$active=[Collections.Generic.List[object]]::new()
$peak=0L
$minimumFree=[long]::MaxValue
$elapsedBefore=0.0
$statusPath=Join-Path $base 'resources.json'
if(Test-Path -LiteralPath $statusPath){
 $previous=Get-Content -LiteralPath $statusPath -Raw | ConvertFrom-Json
 $peak=[long]$previous.sampledPeakWorkerBytes
 $minimumFree=[long]$previous.minimumFreeBytes
 $elapsedBefore=[double]$previous.wallSeconds
}
$timer=[Diagnostics.Stopwatch]::StartNew()
try{
 while($pending.Count -gt 0 -or $active.Count -gt 0){
  $free=[long](Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory*1024
  $minimumFree=[Math]::Min($minimumFree,$free)
  $usage=0L
  foreach($job in $active){$job.Process.Refresh();if(!$job.Process.HasExited){$usage+=$job.Process.WorkingSet64}}
  $peak=[Math]::Max($peak,$usage)
  if($free -lt 8GB -or $usage -gt 4GB){throw "Memory limit reached: free=$free workers=$usage"}
  foreach($job in @($active.ToArray())){if($job.Process.HasExited){if($job.Process.ExitCode -ne 0){throw "Worker failed: $($job.Scheme)"};$active.Remove($job)|Out-Null}}
  while($pending.Count -gt 0 -and $active.Count -lt $Parallelism -and $free -gt 11GB){
   $scheme=$pending.Dequeue()
   $arguments=@('scripts/experiments/benchmark-long-corpus.ts',$scheme,$base)
   $quoted=($arguments|ForEach-Object {'"'+$_+'"'}) -join ' '
   $process=Start-Process bun -ArgumentList $quoted -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $base "$scheme.stdout.log") -RedirectStandardError (Join-Path $base "$scheme.stderr.log") -PassThru
   $process.PriorityClass='BelowNormal'
   $active.Add(@{Process=$process;Scheme=$scheme})
  }
  if($active.Count -eq 0 -and $pending.Count -gt 0){throw 'Insufficient memory to start a worker'}
  $status=@{parallelism=$Parallelism;wallSeconds=$elapsedBefore+$timer.Elapsed.TotalSeconds;sampledPeakWorkerBytes=$peak;minimumFreeBytes=$minimumFree;active=@($active|ForEach-Object{$_.Scheme});pending=$pending.Count} | ConvertTo-Json
  $temporary=Join-Path $base 'resources.next.json'
  [IO.File]::WriteAllText($temporary,$status)
  for($attempt=0;$attempt -lt 10;$attempt++){
   try{Move-Item -LiteralPath $temporary -Destination $statusPath -Force;break}
   catch{if($attempt -eq 9){Write-Warning 'Resource status file temporarily locked; next sample will retry'};Start-Sleep -Milliseconds 50}
  }
  Start-Sleep -Milliseconds 500
 }
}finally{
 foreach($job in $active){if(!$job.Process.HasExited){Stop-Process -Id $job.Process.Id -Force}}
}
bun scripts/experiments/benchmark-long-inputs.ts $base
if($LASTEXITCODE -ne 0){throw 'Input fingerprint changed during benchmark'}
