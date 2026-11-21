param(
  [string]$BuildDirectory = (Join-Path $PSScriptRoot '../target/release')
)

$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'This native launcher check requires Windows.' }
$repository = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$stage = Join-Path ([System.IO.Path]::GetTempPath()) ('snow-launch-中文 空格-' + [guid]::NewGuid().ToString('N'))
$binaryDirectory = Join-Path $stage 'lua/snow/bin'
New-Item -ItemType Directory -Path $binaryDirectory | Out-Null
$helper = Join-Path $binaryDirectory 'snow-keymap-windows.exe'
$launcher = Join-Path $binaryDirectory 'snow_keymap_launcher.dll'
Copy-Item -LiteralPath (Join-Path $BuildDirectory 'snow-keymap.exe') -Destination $helper
Copy-Item -LiteralPath (Join-Path $BuildDirectory 'snow_keymap_launcher.dll') -Destination $launcher
$commandFile = Join-Path $stage 'snow-pinyin-keymap-v2.command'
$image = Join-Path $repository 'lua/snow/keymaps/snow_jiandao_toned.svg'
[System.IO.File]::WriteAllText($commandFile, "toggle`tsmoke:1`t$image", [System.Text.UTF8Encoding]::new($false))

Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class SnowNativeLaunchProbe {
    [StructLayout(LayoutKind.Sequential)] public struct Rect {
        public int Left, Top, Right, Bottom;
    }
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate int Launch(IntPtr state);
    delegate bool EnumWindow(IntPtr hwnd, IntPtr data);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr LoadLibraryW(string path);
    [DllImport("kernel32.dll", CharSet=CharSet.Ansi)] static extern IntPtr GetProcAddress(IntPtr module, string name);
    [DllImport("kernel32.dll")] static extern bool FreeLibrary(IntPtr module);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindow callback, IntPtr data);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowTextW(IntPtr hwnd, StringBuilder text, int length);
    [DllImport("gdi32.dll")] static extern uint GetPixel(IntPtr dc, int x, int y);
    [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr hwnd);
    [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr hwnd, IntPtr dc);
    [DllImport("dwmapi.dll")] static extern int DwmFlush();

    public static object Run(string library, string helper) {
        var module = LoadLibraryW(library);
        if (module == IntPtr.Zero) throw new Exception("LoadLibraryW failed: " + Marshal.GetLastWin32Error());
        Process child = null;
        try {
            var address = GetProcAddress(module, "snow_keymap_launch");
            if (address == IntPtr.Zero) throw new Exception("Lua launch export missing");
            var launch = (Launch)Marshal.GetDelegateForFunctionPointer(address, typeof(Launch));
            IntPtr foreground = GetForegroundWindow();
            Rect target;
            bool hasTarget = GetWindowRect(foreground, out target) && target.Right > target.Left && target.Bottom > target.Top;
            var watch = Stopwatch.StartNew();
            if (launch(IntPtr.Zero) != 0) throw new Exception("Launcher must return zero Lua results");
            double returned = watch.Elapsed.TotalMilliseconds;
            IntPtr window = IntPtr.Zero;
            while (watch.Elapsed.TotalSeconds < 10 && window == IntPtr.Zero) {
                if (child == null) {
                    foreach (var candidate in Process.GetProcessesByName("snow-keymap-windows")) {
                        try {
                            if (String.Equals(candidate.MainModule.FileName, helper, StringComparison.OrdinalIgnoreCase)) { child = candidate; break; }
                        } catch {}
                        candidate.Dispose();
                    }
                }
                if (child != null) {
                    EnumWindows((hwnd, data) => {
                        uint pid; GetWindowThreadProcessId(hwnd, out pid);
                        if (pid == child.Id && IsWindowVisible(hwnd)) {
                            var title = new StringBuilder(256);
                            GetWindowTextW(hwnd, title, title.Capacity);
                            if (title.ToString() == "冰雪拼音键位图") { window = hwnd; return false; }
                        }
                        return true;
                    }, IntPtr.Zero);
                }
                if (window == IntPtr.Zero) Thread.Sleep(5);
            }
            if (window == IntPtr.Zero) throw new Exception("Native launcher never showed the keymap");
            double visible = watch.Elapsed.TotalMilliseconds;
            Rect bounds;
            if (!GetWindowRect(window, out bounds)) throw new Exception("Cannot inspect keymap bounds");
            bool centered = !hasTarget || Math.Abs((bounds.Left + bounds.Right) - (target.Left + target.Right)) <= 2 && Math.Abs((bounds.Top + bounds.Bottom) - (target.Top + target.Bottom)) <= 2;
            bool sameForeground = GetForegroundWindow() == foreground;
            // Wait for an actual keymap background pixel, rather than just window visibility.
            bool painted = false;
            uint lastPixel = 0;
            while (watch.Elapsed.TotalSeconds < 10 && !painted) {
                IntPtr dc = GetDC(window);
                if (dc != IntPtr.Zero) {
                    lastPixel = GetPixel(dc, (bounds.Right - bounds.Left) / 2, 10);
                    painted = lastPixel == 0x00ecf2f5;
                    ReleaseDC(window, dc);
                }
                if (!painted) Thread.Sleep(5);
            }
            if (!painted) throw new Exception("Keymap did not paint its background: pixel=" + lastPixel.ToString("X") + " rect=" + bounds.Left + "," + bounds.Top + "," + bounds.Right + "," + bounds.Bottom + " visible_ms=" + visible + " centered=" + centered);
            DwmFlush();
            double presented = watch.Elapsed.TotalMilliseconds;
            if (!centered) throw new Exception("First keymap show was not centered in the trigger window");
            if (!sameForeground) throw new Exception("Native launcher changed foreground focus");
            return new { launch_ms = returned, visible_ms = visible, painted_and_dwm_ms = presented, centered, same_foreground = sameForeground, target_checked = hasTarget };
        } finally {
            if (child != null) {
                try { if (!child.HasExited) { child.Kill(); child.WaitForExit(5000); } } finally { child.Dispose(); }
            }
            FreeLibrary(module);
        }
    }
}
'@

# The native child uses its host's TEMP without touching the real Rime command file.
# Set both the process environment and managed environment for Windows PowerShell/.NET.
$originalTemp = [System.Environment]::GetEnvironmentVariable('TEMP', 'Process')
try {
  [System.Environment]::SetEnvironmentVariable('TEMP', $stage, 'Process')
  [SnowNativeLaunchProbe]::Run($launcher, $helper) | ConvertTo-Json
} finally {
  [System.Environment]::SetEnvironmentVariable('TEMP', $originalTemp, 'Process')
  # Delete only this freshly created, resolved staging directory under the system temp.
  $resolvedStage = [System.IO.Path]::GetFullPath($stage)
  $expectedParent = [System.IO.Path]::GetDirectoryName($resolvedStage)
  if ($expectedParent -ne [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\')) { throw "Unexpected staging path: $resolvedStage" }
  Remove-Item -LiteralPath $resolvedStage -Recurse -Force
}
