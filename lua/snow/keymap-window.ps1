param(
    [Parameter(Mandatory = $true)]
    [string]$CommandFile
)

Add-Type -AssemblyName PresentationCore, PresentationFramework, WindowsBase

$createdNew = $false
$mutex = [System.Threading.Mutex]::new($true, "Local\SnowPinyinKeymapWindow", [ref]$createdNew)
if (-not $createdNew) {
    $mutex.Dispose()
    exit 0
}

$window = [System.Windows.Window]::new()
$window.Title = "Snow Pinyin Keymap"
$window.WindowStyle = [System.Windows.WindowStyle]::None
$window.ResizeMode = [System.Windows.ResizeMode]::NoResize
$window.AllowsTransparency = $true
$window.Background = [System.Windows.Media.Brushes]::Transparent
$window.ShowInTaskbar = $false
$window.ShowActivated = $false
$window.Topmost = $true
$window.SizeToContent = [System.Windows.SizeToContent]::Manual

$image = [System.Windows.Controls.Image]::new()
$image.Stretch = [System.Windows.Media.Stretch]::Uniform
$image.SnapsToDevicePixels = $true

$border = [System.Windows.Controls.Border]::new()
$border.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString("#FFFDF9")
$border.BorderBrush = [System.Windows.Media.BrushConverter]::new().ConvertFromString("#66756F")
$border.BorderThickness = [System.Windows.Thickness]::new(1.5)
$border.CornerRadius = [System.Windows.CornerRadius]::new(12)
$border.Padding = [System.Windows.Thickness]::new(8)
$border.Child = $image
$window.Content = $border

$window.Add_MouseLeftButtonDown({
    param($sender, $eventArgs)
    if ($eventArgs.ButtonState -eq [System.Windows.Input.MouseButtonState]::Pressed) {
        $window.DragMove()
    }
})
$window.Add_MouseRightButtonUp({ $window.Hide() })
$window.Add_KeyDown({
    param($sender, $eventArgs)
    if ($eventArgs.Key -eq [System.Windows.Input.Key]::Escape) {
        $window.Hide()
    }
})

$currentImage = ""
$lastCommand = ""

function Set-KeymapImage {
    param([string]$Path)

    if (-not [System.IO.File]::Exists($Path)) {
        return
    }
    $bitmap = [System.Windows.Media.Imaging.BitmapImage]::new()
    $bitmap.BeginInit()
    $bitmap.CacheOption = [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad
    $bitmap.UriSource = [System.Uri]::new($Path, [System.UriKind]::Absolute)
    $bitmap.EndInit()
    $bitmap.Freeze()
    $image.Source = $bitmap

    $workArea = [System.Windows.SystemParameters]::WorkArea
    $maximumWidth = $workArea.Width * 0.78
    $maximumHeight = $workArea.Height * 0.72
    $scale = [Math]::Min($maximumWidth / $bitmap.PixelWidth, $maximumHeight / $bitmap.PixelHeight)
    $scale = [Math]::Min($scale, 1.0)
    $image.Width = [Math]::Max(360, $bitmap.PixelWidth * $scale)
    $image.Height = [Math]::Max(140, $bitmap.PixelHeight * $scale)
    $window.Width = $image.Width + 19
    $window.Height = $image.Height + 19
    $window.Left = $workArea.Right - $window.Width - 24
    $window.Top = $workArea.Bottom - $window.Height - 24
    $script:currentImage = $Path
}

$timer = [System.Windows.Threading.DispatcherTimer]::new()
$timer.Interval = [TimeSpan]::FromMilliseconds(80)
$timer.Add_Tick({
    try {
        if (-not [System.IO.File]::Exists($CommandFile)) {
            return
        }
        $command = [System.IO.File]::ReadAllText($CommandFile, [System.Text.Encoding]::UTF8)
        if ([string]::IsNullOrWhiteSpace($command) -or $command -eq $script:lastCommand) {
            return
        }
        $script:lastCommand = $command
        $separator = $command.IndexOf("`t")
        if ($separator -lt 0) {
            return
        }
        $path = $command.Substring($separator + 1)
        if ($path -eq $script:currentImage -and $window.IsVisible) {
            $window.Hide()
            return
        }
        if ($path -ne $script:currentImage) {
            Set-KeymapImage -Path $path
        }
        if ($image.Source) {
            $window.Show()
        }
    }
    catch {
        # A deploy can briefly replace an asset; the next key press retries it.
    }
})
$timer.Start()

$application = [System.Windows.Application]::new()
$application.ShutdownMode = [System.Windows.ShutdownMode]::OnExplicitShutdown
try {
    $application.Run() | Out-Null
}
finally {
    $timer.Stop()
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
