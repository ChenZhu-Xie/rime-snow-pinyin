param(
  [string]$BuildDirectory = (Join-Path $PSScriptRoot '../target/release'),
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '../../../output/keymap-desktop/windows')
)

$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'This native launcher check requires Windows.' }
$repository = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$output = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $output -Force | Out-Null
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
    public static object Diagnostics;
    [StructLayout(LayoutKind.Sequential)] public struct Rect {
        public int Left, Top, Right, Bottom;
    }
    [StructLayout(LayoutKind.Sequential)] struct Point { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] struct BitmapInfo {
        public uint Size;
        public int Width, Height;
        public ushort Planes, BitCount;
        public uint Compression, SizeImage;
        public int XPelsPerMeter, YPelsPerMeter;
        public uint ClrUsed, ClrImportant;
    }
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate int Launch(IntPtr state);
    delegate bool EnumWindow(IntPtr hwnd, IntPtr data);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr LoadLibraryW(string path);
    [DllImport("kernel32.dll", CharSet=CharSet.Ansi)] static extern IntPtr GetProcAddress(IntPtr module, string name);
    [DllImport("kernel32.dll")] static extern bool FreeLibrary(IntPtr module);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", SetLastError=true)] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] static extern IntPtr GetThreadDpiAwarenessContext();
    [DllImport("user32.dll")] static extern IntPtr GetWindowDpiAwarenessContext(IntPtr hwnd);
    [DllImport("user32.dll")] static extern int GetAwarenessFromDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern uint GetDpiForSystem();
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
    [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr hwnd, out Rect rect);
    [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr hwnd, ref Point point);
    [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(Point point);
    [DllImport("user32.dll", EntryPoint="GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindow callback, IntPtr data);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowTextW(IntPtr hwnd, StringBuilder text, int length);
    [DllImport("gdi32.dll")] static extern uint GetPixel(IntPtr dc, int x, int y);
    [DllImport("gdi32.dll")] static extern int GetClipBox(IntPtr dc, out Rect rect);
    [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr hwnd);
    [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr hwnd, IntPtr dc);
    [DllImport("dwmapi.dll")] static extern int DwmFlush();
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr hwnd, uint attribute, out int value, int size);
    [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr dc);
    [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr dc);
    [DllImport("gdi32.dll")] static extern IntPtr CreateDIBSection(IntPtr dc, ref BitmapInfo info, uint usage, out IntPtr bits, IntPtr section, uint offset);
    [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc, IntPtr value);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr value);
    [DllImport("gdi32.dll")] static extern bool BitBlt(IntPtr target, int x, int y, int width, int height, IntPtr source, int sourceX, int sourceY, uint operation);
    [DllImport("gdi32.dll")] static extern bool GdiFlush();

    static object DescribeWindow(IntPtr hwnd) {
        Rect rect; GetWindowRect(hwnd, out rect);
        var title = new StringBuilder(256);
        GetWindowTextW(hwnd, title, title.Capacity);
        uint pid; GetWindowThreadProcessId(hwnd, out pid);
        int cloaked; int cloakResult = DwmGetWindowAttribute(hwnd, 14, out cloaked, sizeof(int));
        return new { handle = hwnd.ToInt64(), pid, title = title.ToString(), rect,
            dpi = GetDpiForWindow(hwnd), awareness = GetAwarenessFromDpiAwarenessContext(GetWindowDpiAwarenessContext(hwnd)),
            style = GetWindowLongPtr(hwnd, -16).ToInt64().ToString("X"),
            extended_style = GetWindowLongPtr(hwnd, -20).ToInt64().ToString("X"),
            cloak_result = cloakResult, cloaked };
    }

    static uint ReadPixel(IntPtr hwnd, int x, int y, out int clipKind, out Rect clip) {
        clipKind = 0; clip = new Rect();
        IntPtr dc = GetDC(hwnd);
        if (dc == IntPtr.Zero) return UInt32.MaxValue;
        try {
            clipKind = GetClipBox(dc, out clip);
            return GetPixel(dc, x, y);
        } finally { ReleaseDC(hwnd, dc); }
    }

    static void SaveClientBitmap(IntPtr hwnd, Rect client, string path) {
        int width = client.Right - client.Left, height = client.Bottom - client.Top;
        if (width <= 0 || height <= 0 || width > 16384 || height > 16384) return;
        IntPtr source = GetDC(hwnd), target = IntPtr.Zero, bitmap = IntPtr.Zero, previous = IntPtr.Zero;
        try {
            if (source == IntPtr.Zero) return;
            target = CreateCompatibleDC(source);
            var info = new BitmapInfo { Size = (uint)Marshal.SizeOf(typeof(BitmapInfo)), Width = width, Height = -height, Planes = 1, BitCount = 32 };
            IntPtr pixels;
            bitmap = CreateDIBSection(source, ref info, 0, out pixels, IntPtr.Zero, 0);
            if (target == IntPtr.Zero || bitmap == IntPtr.Zero) return;
            previous = SelectObject(target, bitmap);
            if (!BitBlt(target, 0, 0, width, height, source, client.Left, client.Top, 0x00cc0020)) return;
            GdiFlush();
            byte[] data = new byte[checked(width * height * 4)];
            Marshal.Copy(pixels, data, 0, data.Length);
            using (var file = new BinaryWriter(File.Create(path))) {
                file.Write((ushort)0x4d42); file.Write(54 + data.Length); file.Write(0); file.Write(54);
                file.Write(40); file.Write(width); file.Write(-height); file.Write((ushort)1); file.Write((ushort)32);
                file.Write(0); file.Write(data.Length); file.Write(0); file.Write(0); file.Write(0); file.Write(0);
                file.Write(data);
            }
        } finally {
            if (previous != IntPtr.Zero) SelectObject(target, previous);
            if (bitmap != IntPtr.Zero) DeleteObject(bitmap);
            if (target != IntPtr.Zero) DeleteDC(target);
            if (source != IntPtr.Zero) ReleaseDC(hwnd, source);
        }
    }

    public static object Run(string library, string helper, string output) {
        // GetWindowRect is DPI virtualized, but GDI DC pixel coordinates are physical.
        // Match winit's per-monitor context for geometry, sample positions and screenshots.
        var previousDpi = SetThreadDpiAwarenessContext(new IntPtr(-4));
        if (previousDpi == IntPtr.Zero) throw new Exception("Cannot select physical DPI coordinates: " + Marshal.GetLastWin32Error());
        try { return RunWithPhysicalCoordinates(library, helper, output); }
        finally { SetThreadDpiAwarenessContext(previousDpi); }
    }

    static object RunWithPhysicalCoordinates(string library, string helper, string output) {
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
            // Observe the composed desktop without borrowing the helper's window DC while
            // it paints. Cross-process GetDC(window)/ReleaseDC can interfere with its
            // retained softbuffer DC during the first frame. Use physical coordinates
            // throughout, and verify the sample belongs to this window before accepting it.
            bool painted = false;
            uint lastPixel = 0;
            Point sample = new Point();
            while (watch.Elapsed.TotalSeconds < 10 && !painted) {
                sample = new Point();
                if (!ClientToScreen(window, ref sample)) throw new Exception("Cannot locate keymap client area");
                sample.X += (bounds.Right - bounds.Left) / 2;
                sample.Y += 10;
                IntPtr dc = GetDC(IntPtr.Zero);
                if (dc != IntPtr.Zero) {
                    lastPixel = GetPixel(dc, sample.X, sample.Y);
                    painted = lastPixel == 0x00ecf2f5 && WindowFromPoint(sample) == window;
                    ReleaseDC(IntPtr.Zero, dc);
                }
                if (!painted) Thread.Sleep(5);
            }
            bool sameForeground = GetForegroundWindow() == foreground;
            Rect client; GetClientRect(window, out client);
            var origin = new Point(); ClientToScreen(window, ref origin);
            // Diagnose only after the original paint assertion has reached its result.
            // A foreign window DC can expose clipping/desktop contents; record the screen
            // independently and do not let a diagnostic flush make the assertion pass.
            int flushResult = DwmFlush();
            int windowClipKind, screenClipKind; Rect windowClip, screenClip;
            uint windowPixel = ReadPixel(window, (bounds.Right - bounds.Left) / 2, 10, out windowClipKind, out windowClip);
            uint screenPixel = ReadPixel(IntPtr.Zero, sample.X, sample.Y, out screenClipKind, out screenClip);
            Diagnostics = new { helper = DescribeWindow(window), foreground = DescribeWindow(foreground),
                current_foreground = DescribeWindow(GetForegroundWindow()), client, client_origin = origin,
                sample, window_at_sample = DescribeWindow(WindowFromPoint(sample)), pixel = lastPixel.ToString("X"),
                dwm_flush_hresult = flushResult, window_pixel_after_dwm = windowPixel.ToString("X"),
                screen_pixel_after_dwm = screenPixel.ToString("X"), window_clip_kind = windowClipKind,
                window_clip = windowClip, screen_clip_kind = screenClipKind, screen_clip = screenClip,
                foreground_changed_during_paint = GetForegroundWindow() != foreground,
                thread_awareness = GetAwarenessFromDpiAwarenessContext(GetThreadDpiAwarenessContext()),
                system_dpi = GetDpiForSystem(),
                launch_ms = returned, visible_ms = visible, centered, same_foreground = sameForeground, painted };
            if (!painted) {
                SaveClientBitmap(window, client, Path.Combine(output, "client.bmp"));
                SaveClientBitmap(IntPtr.Zero, bounds, Path.Combine(output, "screen.bmp"));
                throw new Exception("Keymap did not paint its background: pixel=" + lastPixel.ToString("X") + " rect=" + bounds.Left + "," + bounds.Top + "," + bounds.Right + "," + bounds.Bottom + " visible_ms=" + visible + " centered=" + centered + "; diagnostics: " + output);
            }
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
$originalTrace = [System.Environment]::GetEnvironmentVariable('SNOW_KEYMAP_TRACE', 'Process')
try {
  [System.Environment]::SetEnvironmentVariable('TEMP', $stage, 'Process')
  [System.Environment]::SetEnvironmentVariable('SNOW_KEYMAP_TRACE', (Join-Path $output 'helper.trace'), 'Process')
  [SnowNativeLaunchProbe]::Run($launcher, $helper, $output) | ConvertTo-Json | Tee-Object -FilePath (Join-Path $output 'measurement.json')
} finally {
  [System.Environment]::SetEnvironmentVariable('TEMP', $originalTemp, 'Process')
  [System.Environment]::SetEnvironmentVariable('SNOW_KEYMAP_TRACE', $originalTrace, 'Process')
  if ([SnowNativeLaunchProbe]::Diagnostics) {
    [SnowNativeLaunchProbe]::Diagnostics | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output 'diagnostics.json') -Encoding utf8
  }
  # Delete only this freshly created, resolved staging directory under the system temp.
  $resolvedStage = [System.IO.Path]::GetFullPath($stage)
  $expectedParent = [System.IO.Path]::GetDirectoryName($resolvedStage)
  if ($expectedParent -ne [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\')) { throw "Unexpected staging path: $resolvedStage" }
  Remove-Item -LiteralPath $resolvedStage -Recurse -Force
}
