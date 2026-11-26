#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use std::collections::HashMap;
use std::fs::{File, OpenOptions};
use std::io::{ErrorKind, Read, Seek, SeekFrom, Write};
use std::num::NonZeroU32;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use fs2::FileExt;
use resvg::{tiny_skia, usvg};
use softbuffer::{Context, Surface};
use winit::application::ApplicationHandler;
use winit::dpi::{PhysicalPosition, PhysicalSize};
use winit::event::{ElementState, MouseButton, MouseScrollDelta, Touch, TouchPhase, WindowEvent};
use winit::event_loop::{ActiveEventLoop, EventLoop, EventLoopProxy};
use winit::keyboard::{Key, NamedKey};
use winit::window::{Window, WindowAttributes, WindowId, WindowLevel};

#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::{
    ERROR_SUCCESS, GetLastError, HWND, LPARAM, LRESULT, SetLastError, WPARAM,
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::Graphics::Gdi::{CreateRoundRectRgn, DeleteObject, SetWindowRgn};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GWL_EXSTYLE, GWL_STYLE, GetWindowLongPtrW, STYLESTRUCT, SWP_FRAMECHANGED, SWP_NOACTIVATE,
    SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SetWindowLongPtrW, SetWindowPos, WM_NCACTIVATE,
    WM_NCCALCSIZE, WM_NCDESTROY, WM_NCPAINT, WM_STYLECHANGING, WS_CAPTION, WS_EX_APPWINDOW,
    WS_EX_TOOLWINDOW, WS_MAXIMIZEBOX, WS_MINIMIZEBOX, WS_SYSMENU, WS_THICKFRAME,
};
#[cfg(target_os = "windows")]
use winit::platform::windows::WindowAttributesExtWindows;
use winit::raw_window_handle::{HasWindowHandle, RawWindowHandle};

const POLL_INTERVAL: Duration = Duration::from_millis(30);
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const MIN_ZOOM: f64 = 0.55;
const MAX_ZOOM: f64 = 2.5;

// Opt-in startup measurements; normal use neither creates nor writes a log file.
fn trace(event: &str) {
    static TRACE: OnceLock<(Instant, Option<Mutex<File>>)> = OnceLock::new();
    let (started, output) = TRACE.get_or_init(|| {
        let output = std::env::var_os("SNOW_KEYMAP_TRACE")
            .and_then(|path| OpenOptions::new().create(true).append(true).open(path).ok())
            .map(Mutex::new);
        (Instant::now(), output)
    });
    if let Some(output) = output
        && let Ok(mut file) = output.lock()
    {
        let line = format!("{:.3}\t{event}\n", started.elapsed().as_secs_f64() * 1000.0);
        let _ = file.write_all(line.as_bytes());
    }
}
// Match the outer background rect in the generated keymap SVGs.
#[cfg(target_os = "windows")]
const KEYMAP_CORNER_RADIUS: f64 = 14.0;

#[cfg(target_os = "windows")]
fn tool_window_style(extended_style: isize) -> isize {
    (extended_style | WS_EX_TOOLWINDOW as isize) & !(WS_EX_APPWINDOW as isize)
}

#[cfg(target_os = "windows")]
fn borderless_window_style(style: isize) -> isize {
    style & !((WS_CAPTION | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX) as isize)
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn tool_window_subclass(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    subclass_id: usize,
    _reference_data: usize,
) -> LRESULT {
    // winit rebuilds the extended style when visibility and other window flags change.
    // Keep the borderless tool-window contract in WM_STYLECHANGING, before it is applied;
    // setting it again afterwards leaves a window for tiling managers to misclassify us.
    // SAFETY: Windows supplies a writable STYLESTRUCT for WM_STYLECHANGING. This callback
    // is installed and invoked on the owning event-loop thread and holds no Rust state.
    unsafe {
        if message == WM_NCCALCSIZE || message == WM_NCPAINT {
            // winit only overrides the TRUE/NCCALCSIZE_PARAMS form. The FALSE/RECT form
            // otherwise reaches DefWindowProc and can reserve a caption during a native
            // move. In both forms the proposed window rect is already our client rect.
            return 0;
        }
        if message == WM_NCACTIVATE {
            // Let winit update focus/activation, while -1 asks DefWindowProc to skip
            // non-client painting. Otherwise activating a native move can draw a caption
            // over our pixels even though no space was reserved for it.
            return DefSubclassProc(hwnd, message, wparam, -1);
        }
        if message == WM_STYLECHANGING {
            let styles = &mut *(lparam as *mut STYLESTRUCT);
            match wparam as i32 {
                GWL_EXSTYLE => {
                    styles.styleNew = tool_window_style(styles.styleNew as isize) as u32;
                }
                GWL_STYLE => {
                    styles.styleNew = borderless_window_style(styles.styleNew as isize) as u32;
                }
                _ => {}
            }
        } else if message == WM_NCDESTROY {
            RemoveWindowSubclass(hwnd, Some(tool_window_subclass), subclass_id);
        }
        DefSubclassProc(hwnd, message, wparam, lparam)
    }
}

#[cfg(target_os = "windows")]
fn mark_as_tool_window(window: &Window) -> Result<(), String> {
    let handle = window
        .window_handle()
        .map_err(|error| format!("无法读取键位图窗口句柄：{error}"))?;
    let RawWindowHandle::Win32(handle) = handle.as_raw() else {
        return Err("键位图窗口没有 Win32 句柄".to_owned());
    };
    let hwnd = handle.hwnd.get() as _;

    // SAFETY: hwnd belongs to this event-loop thread and remains valid for the duration of the
    // calls. Clearing LastError distinguishes a legitimate zero style/result from API failure.
    unsafe {
        if SetWindowSubclass(hwnd, Some(tool_window_subclass), 1, 0) == 0 {
            return Err("无法保护键位图工具窗口样式".to_owned());
        }
        SetLastError(ERROR_SUCCESS);
        let extended_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let error = GetLastError();
        if extended_style == 0 && error != ERROR_SUCCESS {
            return Err(format!("无法读取键位图窗口样式：系统错误 {error}"));
        }

        SetLastError(ERROR_SUCCESS);
        let previous = SetWindowLongPtrW(hwnd, GWL_EXSTYLE, tool_window_style(extended_style));
        let error = GetLastError();
        if previous == 0 && error != ERROR_SUCCESS {
            return Err(format!("无法将键位图声明为工具窗口：系统错误 {error}"));
        }

        SetLastError(ERROR_SUCCESS);
        let style = GetWindowLongPtrW(hwnd, GWL_STYLE);
        let error = GetLastError();
        if style == 0 && error != ERROR_SUCCESS {
            return Err(format!("无法读取键位图边框样式：系统错误 {error}"));
        }
        SetLastError(ERROR_SUCCESS);
        let previous = SetWindowLongPtrW(hwnd, GWL_STYLE, borderless_window_style(style));
        let error = GetLastError();
        if previous == 0 && error != ERROR_SUCCESS {
            return Err(format!("无法移除键位图原生标题栏：系统错误 {error}"));
        }
        if SetWindowPos(
            hwnd,
            std::ptr::null_mut(),
            0,
            0,
            0,
            0,
            SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
        ) == 0
        {
            return Err(format!(
                "无法刷新键位图无边框窗口：系统错误 {}",
                GetLastError()
            ));
        }
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn mark_as_tool_window(window: &Window) -> Result<(), String> {
    configure_x11_window(window, None)
}

#[cfg(target_os = "linux")]
fn configure_x11_window(
    window: &Window,
    position: Option<PhysicalPosition<i32>>,
) -> Result<(), String> {
    use winit::raw_window_handle::{HasDisplayHandle, RawDisplayHandle};
    use x11_dl::xlib;

    let handle = window.window_handle().map_err(|error| error.to_string())?;
    let RawWindowHandle::Xlib(handle) = handle.as_raw() else {
        return Ok(());
    };
    let display = window.display_handle().map_err(|error| error.to_string())?;
    let RawDisplayHandle::Xlib(display) = display.as_raw() else {
        return Ok(());
    };
    let display = display.display.ok_or("X11 显示连接为空")?.as_ptr().cast();
    let xlib = xlib::Xlib::open().map_err(|error| error.to_string())?;
    let timestamp: std::ffi::c_ulong = 0;
    // SAFETY: these handles belong to this live window on the event-loop thread.
    // EWMH defines timestamp zero as a request not to focus a newly mapped window.
    // Unlike WM_HINTS.input=false, it still allows focus when the user clicks it.
    unsafe {
        let property = (xlib.XInternAtom)(display, c"_NET_WM_USER_TIME".as_ptr(), xlib::False);
        (xlib.XChangeProperty)(
            display,
            handle.window,
            property,
            xlib::XA_CARDINAL,
            32,
            xlib::PropModeReplace,
            (&timestamp as *const std::ffi::c_ulong).cast(),
            1,
        );
        if let Some(position) = position {
            let mut hints: xlib::XSizeHints = std::mem::zeroed();
            let mut supplied = 0;
            (xlib.XGetWMNormalHints)(display, handle.window, &mut hints, &mut supplied);
            // Preserve size constraints while telling the WM that the pre-map
            // position is deliberate, rather than an invitation to smart-place.
            hints.flags |= xlib::USPosition;
            hints.x = position.x;
            hints.y = position.y;
            (xlib.XSetWMNormalHints)(display, handle.window, &mut hints);
        }
        (xlib.XFlush)(display);
    }
    Ok(())
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn mark_as_tool_window(_window: &Window) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "windows")]
fn round_window_corners(window: &Window, image: &RenderedImage) -> Result<(), String> {
    let handle = window
        .window_handle()
        .map_err(|error| format!("无法读取键位图窗口句柄：{error}"))?;
    let RawWindowHandle::Win32(handle) = handle.as_raw() else {
        return Err("键位图窗口没有 Win32 句柄".to_owned());
    };

    let region = create_window_region(image)?;
    // SAFETY: the window belongs to this event-loop thread. Windows takes ownership of the
    // region only on success; on failure we must delete it ourselves.
    unsafe {
        if SetWindowRgn(handle.hwnd.get() as _, region, 1) == 0 {
            DeleteObject(region);
            return Err("无法设置键位图圆角窗口".to_owned());
        }
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn create_window_region(
    image: &RenderedImage,
) -> Result<windows_sys::Win32::Graphics::Gdi::HRGN, String> {
    // SAFETY: dimensions are bounded by the current monitor. The caller owns the new region.
    let region = unsafe {
        CreateRoundRectRgn(
            0,
            0,
            image.width as i32 + 1,
            image.height as i32 + 1,
            image.corner_diameter,
            image.corner_diameter,
        )
    };
    if region.is_null() {
        return Err("无法创建键位图圆角区域".to_owned());
    }
    Ok(region)
}

#[cfg(not(target_os = "windows"))]
fn round_window_corners(_window: &Window, _image: &RenderedImage) -> Result<(), String> {
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CommandAction {
    Toggle,
    Follow,
}

#[derive(Debug, Clone)]
struct Command {
    action: CommandAction,
    token: String,
    image_path: PathBuf,
}

#[derive(Debug)]
enum UserEvent {
    Command(Command),
}

struct InstanceLock {
    file: File,
}

impl InstanceLock {
    fn acquire(command_file: &Path) -> Result<Option<Self>, String> {
        let lock_path = command_file.with_extension("lock");
        let file = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(&lock_path)
            .map_err(|error| format!("无法打开锁文件 {}：{error}", lock_path.display()))?;
        match file.try_lock_exclusive() {
            Ok(()) => Ok(Some(Self { file })),
            Err(error) if error.kind() == ErrorKind::WouldBlock => Ok(None),
            Err(error) => Err(format!("无法锁定 {}：{error}", lock_path.display())),
        }
    }
}

impl Drop for InstanceLock {
    fn drop(&mut self) {
        let _ = self.file.unlock();
    }
}

fn parse_command(value: &str) -> Option<Command> {
    let fields: Vec<_> = value.trim().split('\t').collect();
    let (action, token, image_path) = match fields.as_slice() {
        [token, image_path] => (CommandAction::Toggle, *token, *image_path),
        ["toggle", token, image_path] => (CommandAction::Toggle, *token, *image_path),
        ["follow", token, image_path] => (CommandAction::Follow, *token, *image_path),
        _ => return None,
    };
    if token.is_empty() || image_path.is_empty() {
        return None;
    }
    Some(Command {
        action,
        token: token.to_owned(),
        image_path: PathBuf::from(image_path),
    })
}

fn heartbeat_path(command_file: &Path) -> PathBuf {
    let mut value = command_file.as_os_str().to_os_string();
    value.push(".alive");
    PathBuf::from(value)
}

fn write_heartbeat(path: &Path) -> std::io::Result<()> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let mut file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(path)?;
    file.seek(SeekFrom::Start(0))?;
    write!(file, "{timestamp:020}")?;
    file.set_len(20)
}

fn adjust_zoom(current: f64, delta: f64) -> f64 {
    (current + delta).clamp(MIN_ZOOM, MAX_ZOOM)
}

fn centered_position(
    target_position: PhysicalPosition<i32>,
    target_size: PhysicalSize<u32>,
    window_size: PhysicalSize<u32>,
) -> PhysicalPosition<i32> {
    PhysicalPosition::new(
        target_position.x + (target_size.width as i32 - window_size.width as i32) / 2,
        target_position.y + (target_size.height as i32 - window_size.height as i32) / 2,
    )
}

fn recentered_position(
    previous_position: PhysicalPosition<i32>,
    previous_size: PhysicalSize<u32>,
    next_size: PhysicalSize<u32>,
) -> PhysicalPosition<i32> {
    PhysicalPosition::new(
        previous_position.x + (previous_size.width as i32 - next_size.width as i32) / 2,
        previous_position.y + (previous_size.height as i32 - next_size.height as i32) / 2,
    )
}

#[derive(Clone, Copy)]
struct WindowArea {
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
}

#[cfg(target_os = "windows")]
fn focused_window_area() -> Option<WindowArea> {
    use windows_sys::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

    window_area(unsafe { GetForegroundWindow() } as usize)
}

#[cfg(target_os = "windows")]
fn window_area(handle: usize) -> Option<WindowArea> {
    use std::ffi::c_void;

    #[repr(C)]
    struct Rect {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }

    #[link(name = "user32")]
    unsafe extern "system" {
        fn IsWindow(window: *mut c_void) -> i32;
        fn GetWindowRect(window: *mut c_void, rect: *mut Rect) -> i32;
        fn IsIconic(window: *mut c_void) -> i32;
    }

    // SAFETY: the handles and output rectangle are used only for these read-only Win32 calls.
    unsafe {
        let window = handle as *mut c_void;
        if window.is_null() || IsWindow(window) == 0 || IsIconic(window) != 0 {
            return None;
        }
        let mut rect = Rect {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };
        if GetWindowRect(window, &mut rect) == 0 {
            return None;
        }
        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        if width <= 0 || height <= 0 {
            return None;
        }
        Some(WindowArea {
            position: PhysicalPosition::new(rect.left, rect.top),
            size: PhysicalSize::new(width as u32, height as u32),
        })
    }
}

#[cfg(not(target_os = "windows"))]
fn focused_window_area() -> Option<WindowArea> {
    None
}

#[cfg(not(target_os = "windows"))]
fn window_area(_handle: usize) -> Option<WindowArea> {
    None
}

struct CommandWatcher {
    stop: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
    heartbeat_file: PathBuf,
}

impl Drop for CommandWatcher {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
        let _ = std::fs::remove_file(&self.heartbeat_file);
    }
}

fn start_command_watcher(
    command_file: PathBuf,
    proxy: EventLoopProxy<UserEvent>,
) -> CommandWatcher {
    let heartbeat_file = heartbeat_path(&command_file);
    let _ = write_heartbeat(&heartbeat_file);
    let stop = Arc::new(AtomicBool::new(false));
    let thread_stop = stop.clone();
    let thread_heartbeat_file = heartbeat_file.clone();
    let handle = thread::spawn(move || {
        let mut last_value = String::new();
        let mut last_heartbeat = Instant::now();
        while !thread_stop.load(Ordering::Relaxed) {
            if last_heartbeat.elapsed() >= HEARTBEAT_INTERVAL {
                let _ = write_heartbeat(&thread_heartbeat_file);
                last_heartbeat = Instant::now();
            }
            let mut value = String::new();
            if File::open(&command_file)
                .and_then(|mut file| file.read_to_string(&mut value))
                .is_ok()
                && value != last_value
            {
                last_value.clone_from(&value);
                if let Some(command) = parse_command(&value)
                    && proxy.send_event(UserEvent::Command(command)).is_err()
                {
                    break;
                }
            }
            thread::sleep(POLL_INTERVAL);
        }
    });
    CommandWatcher {
        stop,
        handle: Some(handle),
        heartbeat_file,
    }
}

#[derive(Debug)]
struct RenderedImage {
    width: u32,
    height: u32,
    #[cfg(target_os = "windows")]
    corner_diameter: i32,
    pixels: Vec<u32>,
}

struct TouchPress {
    id: u64,
    origin: PhysicalPosition<f64>,
    window_position: PhysicalPosition<i32>,
}

fn svg_options() -> usvg::Options<'static> {
    let mut options = usvg::Options::default();
    options.fontdb_mut().load_system_fonts();
    options
}

fn load_svg(path: &Path, options: &usvg::Options<'_>) -> Result<usvg::Tree, String> {
    let data = std::fs::read(path)
        .map_err(|error| format!("无法读取键位图 {}：{error}", path.display()))?;
    usvg::Tree::from_data(&data, options)
        .map_err(|error| format!("无法解析键位图 {}：{error}", path.display()))
}

fn render_svg(
    tree: &usvg::Tree,
    maximum_size: PhysicalSize<u32>,
    scale_factor: f64,
) -> Result<RenderedImage, String> {
    let source = tree.size();
    let desired_scale = scale_factor.max(0.1);
    let scale = desired_scale
        .min(maximum_size.width as f64 / source.width() as f64)
        .min(maximum_size.height as f64 / source.height() as f64);
    let width = (source.width() as f64 * scale).round().max(1.0) as u32;
    let height = (source.height() as f64 * scale).round().max(1.0) as u32;
    let mut pixmap = tiny_skia::Pixmap::new(width, height)
        .ok_or_else(|| format!("无法为键位图分配 {width}×{height} 画布"))?;
    // Composite antialiased SVG edges against the same background as the diagram.
    pixmap.fill(tiny_skia::Color::from_rgba8(0xf5, 0xf2, 0xec, 0xff));
    let transform = tiny_skia::Transform::from_scale(scale as f32, scale as f32);
    resvg::render(tree, transform, &mut pixmap.as_mut());
    let (rgba_pixels, remainder) = pixmap.data().as_chunks::<4>();
    debug_assert!(remainder.is_empty());
    let pixels = rgba_pixels
        .iter()
        .map(|rgba| ((rgba[0] as u32) << 16) | ((rgba[1] as u32) << 8) | rgba[2] as u32)
        .collect();
    Ok(RenderedImage {
        width,
        height,
        #[cfg(target_os = "windows")]
        corner_diameter: (KEYMAP_CORNER_RADIUS * 2.0 * scale).round().max(2.0) as i32,
        pixels,
    })
}

fn should_check_svg(
    path_changed: bool,
    svg_missing: bool,
    follow_command: bool,
    first_show: bool,
) -> bool {
    path_changed || svg_missing || follow_command || first_show
}

fn should_defer_hidden_follow(action: CommandAction, visible: bool) -> bool {
    action == CommandAction::Follow && !visible
}

struct App {
    window: Option<Arc<Window>>,
    surface: Option<Surface<Arc<Window>, Arc<Window>>>,
    image: Option<RenderedImage>,
    svg_options: usvg::Options<'static>,
    svg_cache: HashMap<PathBuf, CachedSvg>,
    svg: Option<Arc<usvg::Tree>>,
    current_path: Option<PathBuf>,
    initial_focused_area: Option<WindowArea>,
    visible: bool,
    zoom: f64,
    touches: HashMap<u64, PhysicalPosition<f64>>,
    touch_press: Option<TouchPress>,
    touch_span: Option<f64>,
}

struct CachedSvg {
    modified: Option<SystemTime>,
    length: u64,
    tree: Arc<usvg::Tree>,
}

impl App {
    fn new() -> Self {
        trace("fonts.begin");
        let svg_options = svg_options();
        trace("fonts.end");
        Self {
            window: None,
            surface: None,
            image: None,
            svg_options,
            svg_cache: HashMap::new(),
            svg: None,
            current_path: None,
            initial_focused_area: None,
            visible: false,
            zoom: 1.0,
            touches: HashMap::new(),
            touch_press: None,
            touch_span: None,
        }
    }

    fn svg_for_path(&mut self, path: &Path) -> Result<Arc<usvg::Tree>, String> {
        let metadata = std::fs::metadata(path)
            .map_err(|error| format!("无法读取键位图属性 {}：{error}", path.display()))?;
        let modified = metadata.modified().ok();
        if let Some(cached) = self.svg_cache.get(path)
            && cached.modified == modified
            && cached.length == metadata.len()
        {
            return Ok(cached.tree.clone());
        }
        trace("svg.begin");
        let tree = Arc::new(load_svg(path, &self.svg_options)?);
        trace("svg.end");
        self.svg_cache.insert(
            path.to_path_buf(),
            CachedSvg {
                modified,
                length: metadata.len(),
                tree: tree.clone(),
            },
        );
        Ok(tree)
    }

    fn hide(&mut self) {
        let wayland = self.window.as_ref().is_some_and(|window| {
            matches!(
                window.window_handle().map(|handle| handle.as_raw()),
                Ok(RawWindowHandle::Wayland(_))
            )
        });
        if wayland {
            // winit's Wayland set_visible is a no-op. Drop the surface and window to
            // unmap it, keeping font, SVG and pixel caches for the next toggle.
            self.surface = None;
            self.window = None;
            trace("window.dropped");
        } else if let Some(window) = self.window.as_ref() {
            window.set_visible(false);
        }
        self.visible = false;
        trace("hidden");
        self.touches.clear();
        self.touch_press = None;
        self.touch_span = None;
    }

    fn monitor_and_maximum(
        &self,
        event_loop: &ActiveEventLoop,
    ) -> (Option<winit::monitor::MonitorHandle>, PhysicalSize<u32>) {
        let monitor = self
            .window
            .as_ref()
            .and_then(|window| window.current_monitor())
            .or_else(|| event_loop.primary_monitor());
        let monitor_size = monitor
            .as_ref()
            .map_or(PhysicalSize::new(1280, 720), |monitor| monitor.size());
        let maximum_size = PhysicalSize::new(
            (f64::from(monitor_size.width) * 0.92) as u32,
            (f64::from(monitor_size.height) * 0.86) as u32,
        );
        (monitor, maximum_size)
    }

    fn render_current(&mut self, event_loop: &ActiveEventLoop, keep_center: bool) -> bool {
        let (Some(window), Some(svg)) = (self.window.as_ref(), self.svg.as_ref()) else {
            return false;
        };
        let window = window.clone();
        let previous_size = self.image.as_ref().map_or(window.inner_size(), |image| {
            PhysicalSize::new(image.width, image.height)
        });
        let (_, maximum_size) = self.monitor_and_maximum(event_loop);
        trace("raster.begin");
        let Ok(image) = render_svg(svg, maximum_size, window.scale_factor() * self.zoom) else {
            return false;
        };
        trace("raster.end");
        let previous_position = window.outer_position().ok();
        let _ = window.request_inner_size(PhysicalSize::new(image.width, image.height));
        if let Err(error) = round_window_corners(&window, &image) {
            eprintln!("{error}");
            return false;
        }
        if keep_center && let Some(position) = previous_position {
            window.set_outer_position(recentered_position(
                position,
                previous_size,
                PhysicalSize::new(image.width, image.height),
            ));
        }
        self.image = Some(image);
        window.request_redraw();
        true
    }

    fn place_centered(&self, event_loop: &ActiveEventLoop, focused_area: Option<WindowArea>) {
        let (Some(window), Some(image)) = (self.window.as_ref(), self.image.as_ref()) else {
            return;
        };
        let area = if let Some(area) = focused_area {
            area
        } else {
            let (monitor, _) = self.monitor_and_maximum(event_loop);
            let Some(monitor) = monitor else {
                return;
            };
            WindowArea {
                position: monitor.position(),
                size: monitor.size(),
            }
        };
        let position = centered_position(
            area.position,
            area.size,
            PhysicalSize::new(image.width, image.height),
        );
        window.set_outer_position(position);
        #[cfg(target_os = "linux")]
        if let Err(error) = configure_x11_window(window, Some(position)) {
            eprintln!("无法设置 X11 键位图初始位置：{error}");
        }
    }

    fn change_zoom(&mut self, event_loop: &ActiveEventLoop, delta: f64) {
        let next = adjust_zoom(self.zoom, delta);
        if (next - self.zoom).abs() < f64::EPSILON {
            return;
        }
        self.zoom = next;
        let _ = self.render_current(event_loop, true);
    }

    fn change_zoom_ratio(&mut self, event_loop: &ActiveEventLoop, ratio: f64) {
        if !ratio.is_finite() || ratio <= 0.0 {
            return;
        }
        let next = (self.zoom * ratio).clamp(MIN_ZOOM, MAX_ZOOM);
        self.change_zoom(event_loop, next - self.zoom);
    }

    fn show_command(&mut self, event_loop: &ActiveEventLoop, command: Command) {
        trace("command.received");
        if should_defer_hidden_follow(command.action, self.visible) {
            self.current_path = Some(command.image_path);
            return;
        }
        if self.window.is_none() {
            self.resumed(event_loop);
        }
        let Some(window) = self.window.clone() else {
            return;
        };
        if command.action == CommandAction::Toggle
            && self.current_path.as_deref() == Some(command.image_path.as_path())
            && self.visible
        {
            self.hide();
            return;
        }

        let first_show = !self.visible;
        // The launcher remembers the window that received the triggering key. Capture
        // any fallback before SVG loading, rather than after potentially slow rendering.
        let focused_area = if first_show {
            self.initial_focused_area
                .take()
                .or_else(focused_window_area)
        } else {
            None
        };
        let path_changed = self.current_path.as_deref() != Some(command.image_path.as_path());
        if should_check_svg(
            path_changed,
            self.svg.is_none(),
            command.action == CommandAction::Follow,
            first_show,
        ) {
            let Ok(svg) = self.svg_for_path(&command.image_path) else {
                return;
            };
            let tree_changed = self
                .svg
                .as_ref()
                .is_none_or(|current| !Arc::ptr_eq(current, &svg));
            self.current_path = Some(command.image_path);
            self.svg = Some(svg);
            if (tree_changed || self.image.is_none()) && !self.render_current(event_loop, false) {
                return;
            }
        }
        if command.action == CommandAction::Follow && first_show {
            return;
        }

        // A window manager may have resized the hidden window. A cached SVG/image does
        // not imply that the native window still has the matching dimensions.
        if let Some(image) = self.image.as_ref() {
            let size = PhysicalSize::new(image.width, image.height);
            if window.inner_size() != size {
                let _ = window.request_inner_size(size);
                if let Err(error) = round_window_corners(&window, image) {
                    eprintln!("{error}");
                    return;
                }
            }
        }
        if first_show {
            self.place_centered(event_loop, focused_area);
        }
        window.set_visible(true);
        window.request_redraw();
        self.visible = true;
        trace("shown");
        let _ = command.token;
    }

    fn update_touch_zoom(&mut self, event_loop: &ActiveEventLoop) {
        if self.touches.len() != 2 {
            self.touch_span = None;
            return;
        }
        let mut points = self.touches.values();
        let (Some(first), Some(second)) = (points.next(), points.next()) else {
            return;
        };
        let span = (second.x - first.x).hypot(second.y - first.y);
        if let Some(previous) = self.touch_span
            && previous > f64::EPSILON
        {
            self.change_zoom_ratio(event_loop, span / previous);
        }
        self.touch_span = Some(span);
    }

    fn handle_touch(&mut self, event_loop: &ActiveEventLoop, touch: Touch) {
        let Some(window) = self.window.as_ref() else {
            return;
        };
        match touch.phase {
            TouchPhase::Started => {
                self.touches.insert(touch.id, touch.location);
                if self.touches.len() == 1 {
                    self.touch_press = Some(TouchPress {
                        id: touch.id,
                        origin: touch.location,
                        window_position: window
                            .outer_position()
                            .unwrap_or(PhysicalPosition::new(0, 0)),
                    });
                } else {
                    self.touch_press = None;
                }
                self.update_touch_zoom(event_loop);
            }
            TouchPhase::Moved => {
                self.touches.insert(touch.id, touch.location);
                if self.touches.len() == 1
                    && let Some(press) = self.touch_press.as_mut()
                    && press.id == touch.id
                {
                    let dx = touch.location.x - press.origin.x;
                    let dy = touch.location.y - press.origin.y;
                    window.set_outer_position(PhysicalPosition::new(
                        press.window_position.x + dx.round() as i32,
                        press.window_position.y + dy.round() as i32,
                    ));
                }
                self.update_touch_zoom(event_loop);
            }
            TouchPhase::Ended | TouchPhase::Cancelled => {
                self.touches.remove(&touch.id);
                if self
                    .touch_press
                    .as_ref()
                    .is_some_and(|press| press.id == touch.id)
                {
                    self.touch_press = None;
                }
                self.update_touch_zoom(event_loop);
            }
        }
    }

    fn redraw(&mut self) {
        if !self.visible {
            trace("redraw.skipped.hidden");
            return;
        }
        let (Some(surface), Some(image)) = (self.surface.as_mut(), self.image.as_ref()) else {
            return;
        };
        let (Some(width), Some(height)) =
            (NonZeroU32::new(image.width), NonZeroU32::new(image.height))
        else {
            return;
        };
        if let Err(error) = surface.resize(width, height) {
            trace(&format!("surface.resize.failed\t{error}"));
            return;
        }
        let mut buffer = match surface.buffer_mut() {
            Ok(buffer) => buffer,
            Err(error) => {
                trace(&format!("surface.buffer.failed\t{error}"));
                return;
            }
        };
        if buffer.len() == image.pixels.len() {
            buffer.copy_from_slice(&image.pixels);
            match buffer.present() {
                Ok(()) => trace("presented"),
                Err(error) => trace(&format!("surface.present.failed\t{error}")),
            }
        }
    }
}

impl ApplicationHandler<UserEvent> for App {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        if self.window.is_some() {
            return;
        }
        trace("window.begin");
        let attributes = WindowAttributes::default()
            .with_title("冰雪拼音键位图")
            .with_inner_size(PhysicalSize::new(1040, 590))
            .with_resizable(false)
            .with_decorations(false)
            .with_visible(false)
            .with_active(false)
            .with_window_level(WindowLevel::AlwaysOnTop);
        #[cfg(target_os = "windows")]
        let attributes = attributes.with_skip_taskbar(true);
        let Ok(window) = event_loop.create_window(attributes) else {
            event_loop.exit();
            return;
        };
        if let Err(error) = mark_as_tool_window(&window) {
            eprintln!("{error}");
            event_loop.exit();
            return;
        }
        let window = Arc::new(window);
        let Ok(context) = Context::new(window.clone()) else {
            event_loop.exit();
            return;
        };
        let Ok(surface) = Surface::new(&context, window.clone()) else {
            event_loop.exit();
            return;
        };
        self.surface = Some(surface);
        self.window = Some(window);
        trace("window.end");
    }

    fn user_event(&mut self, event_loop: &ActiveEventLoop, event: UserEvent) {
        match event {
            UserEvent::Command(command) => {
                self.show_command(event_loop, command);
            }
        }
    }

    fn window_event(
        &mut self,
        event_loop: &ActiveEventLoop,
        window_id: WindowId,
        event: WindowEvent,
    ) {
        let Some(window) = self.window.as_ref() else {
            return;
        };
        if window.id() != window_id {
            return;
        }
        match event {
            WindowEvent::CloseRequested => event_loop.exit(),
            WindowEvent::RedrawRequested => {
                trace("redraw.requested");
                self.redraw();
            }
            WindowEvent::KeyboardInput { event, .. }
                if event.state == ElementState::Pressed
                    && event.logical_key == Key::Named(NamedKey::Escape) =>
            {
                self.hide();
            }
            WindowEvent::MouseWheel { delta, .. } => {
                let amount = match delta {
                    MouseScrollDelta::LineDelta(_, vertical) => f64::from(vertical) * 0.1,
                    MouseScrollDelta::PixelDelta(position) => position.y * 0.002,
                };
                self.change_zoom(event_loop, amount);
            }
            WindowEvent::PinchGesture { delta, .. } => {
                self.change_zoom(event_loop, delta);
            }
            WindowEvent::Touch(touch) => self.handle_touch(event_loop, touch),
            WindowEvent::MouseInput {
                state: ElementState::Pressed,
                button: MouseButton::Left,
                ..
            } => {
                let _ = window.drag_window();
            }
            WindowEvent::MouseInput {
                state: ElementState::Released,
                button: MouseButton::Right,
                ..
            } => {
                self.hide();
            }
            WindowEvent::ScaleFactorChanged { .. } => {
                let _ = self.render_current(event_loop, true);
            }
            _ => {}
        }
    }
}

struct Startup {
    command_file: PathBuf,
    focused_window: Option<usize>,
}

fn startup_from_args(
    args: impl IntoIterator<Item = std::ffi::OsString>,
) -> Result<Startup, String> {
    let mut args = args.into_iter();
    let mut command_file = None;
    let mut focused_window = None;
    while let Some(argument) = args.next() {
        if argument == "--command-file" {
            command_file = Some(PathBuf::from(args.next().ok_or("--command-file 缺少路径")?));
        } else if argument == "--focus-window" {
            focused_window = Some(
                args.next()
                    .and_then(|value| value.to_str().and_then(|value| value.parse().ok()))
                    .ok_or("--focus-window 缺少有效的窗口句柄")?,
            );
        } else {
            return Err(format!("未知参数：{}", argument.to_string_lossy()));
        }
    }
    Ok(Startup {
        command_file: command_file.ok_or("用法：snow-keymap --command-file <路径>")?,
        focused_window,
    })
}

fn run() -> Result<(), String> {
    trace("process.enter");
    let startup = startup_from_args(std::env::args_os().skip(1))?;
    let command_file = startup.command_file;
    let Some(_instance_lock) = InstanceLock::acquire(&command_file)? else {
        return Ok(());
    };
    trace("event_loop.begin");
    let mut builder = EventLoop::<UserEvent>::with_user_event();
    #[cfg(target_os = "macos")]
    {
        use winit::platform::macos::{ActivationPolicy, EventLoopBuilderExtMacOS};
        builder
            .with_activation_policy(ActivationPolicy::Accessory)
            .with_activate_ignoring_other_apps(false)
            .with_default_menu(false);
    }
    let event_loop = builder
        .build()
        .map_err(|error| format!("无法创建窗口事件循环：{error}"))?;
    trace("event_loop.end");
    let initial_focused_area = startup.focused_window.and_then(window_area);
    let _command_watcher = start_command_watcher(command_file, event_loop.create_proxy());
    let mut app = App::new();
    app.initial_focused_area = initial_focused_area;
    event_loop
        .run_app(&mut app)
        .map_err(|error| format!("键位图窗口异常退出：{error}"))
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn startup_preserves_the_trigger_window_and_unicode_paths_in_either_order() {
        for args in [
            [
                "--command-file",
                "C:/输入法 数据/keymap.command",
                "--focus-window",
                "12345",
            ],
            [
                "--focus-window",
                "12345",
                "--command-file",
                "C:/输入法 数据/keymap.command",
            ],
        ] {
            let startup = startup_from_args(args.map(std::ffi::OsString::from)).unwrap();
            assert_eq!(
                startup.command_file,
                PathBuf::from("C:/输入法 数据/keymap.command")
            );
            assert_eq!(startup.focused_window, Some(12345));
        }
        for args in [
            vec![],
            vec!["--command-file"],
            vec!["--focus-window", "invalid"],
        ] {
            assert!(startup_from_args(args.into_iter().map(std::ffi::OsString::from)).is_err());
        }
    }

    #[test]
    fn parses_command_with_spaces_in_path() {
        let command =
            parse_command("toggle\tsnow_sipin:1\tC:/Rime Data/keymaps/snow_sipin.svg").unwrap();
        assert_eq!(command.action, CommandAction::Toggle);
        assert_eq!(command.token, "snow_sipin:1");
        assert_eq!(
            command.image_path,
            PathBuf::from("C:/Rime Data/keymaps/snow_sipin.svg")
        );
    }

    #[test]
    fn parses_follow_and_legacy_toggle_commands() {
        let follow = parse_command("follow\tsnow_landao:2\tC:/keymaps/snow_landao.svg").unwrap();
        assert_eq!(follow.action, CommandAction::Follow);
        let legacy = parse_command("snow_sipin:1\tC:/keymaps/snow_sipin.svg").unwrap();
        assert_eq!(legacy.action, CommandAction::Toggle);
    }

    #[test]
    fn rejects_incomplete_command() {
        assert!(parse_command("").is_none());
        assert!(parse_command("token-only").is_none());
        assert!(parse_command("\timage.svg").is_none());
    }

    #[test]
    fn zoom_is_bounded_for_wheel_and_pinch_input() {
        assert_eq!(adjust_zoom(1.0, 0.2), 1.2);
        assert_eq!(adjust_zoom(MAX_ZOOM, 1.0), MAX_ZOOM);
        assert_eq!(adjust_zoom(MIN_ZOOM, -1.0), MIN_ZOOM);
    }

    #[test]
    fn cached_svg_tree_renders_at_multiple_zoom_levels() {
        let path =
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../../lua/snow/keymaps/snow_sipin.svg");
        let mut app = App::new();
        let svg = app.svg_for_path(&path).unwrap();
        let cached = app.svg_for_path(&path).unwrap();
        assert!(Arc::ptr_eq(&svg, &cached));
        let maximum = PhysicalSize::new(2400, 1400);
        let normal = render_svg(&svg, maximum, 0.5).unwrap();
        let zoomed = render_svg(&svg, maximum, 0.75).unwrap();
        assert!(zoomed.width > normal.width);
        assert!(zoomed.height > normal.height);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn all_keymap_windows_clip_their_corners_at_every_zoom() {
        use windows_sys::Win32::Graphics::Gdi::PtInRegion;

        let directory = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../lua/snow/keymaps");
        let options = svg_options();
        let mut count = 0;
        for entry in std::fs::read_dir(directory).unwrap() {
            let path = entry.unwrap().path();
            if path.extension().is_none_or(|extension| extension != "svg") {
                continue;
            }
            count += 1;
            let source = std::fs::read_to_string(&path).unwrap();
            assert!(source.contains(&format!(
                "<rect width=\"1040\" height=\"590\" rx=\"{KEYMAP_CORNER_RADIUS}\""
            )));
            let svg = load_svg(&path, &options).unwrap();
            for zoom in [MIN_ZOOM, 1.0, MAX_ZOOM] {
                let image = render_svg(&svg, PhysicalSize::new(1200, 900), zoom).unwrap();
                assert_eq!(
                    image.corner_diameter,
                    (KEYMAP_CORNER_RADIUS * 2.0 * zoom.min(1200.0 / 1040.0)).round() as i32
                );
                let region = create_window_region(&image).unwrap();
                let right = image.width as i32 - 1;
                let bottom = image.height as i32 - 1;
                // SAFETY: region is owned by this test and deleted after all queries.
                unsafe {
                    let corners = [(0, 0), (right, 0), (0, bottom), (right, bottom)]
                        .map(|(x, y)| PtInRegion(region, x, y));
                    let edges = [
                        (right / 2, 0),
                        (0, bottom / 2),
                        (right, bottom / 2),
                        (right / 2, bottom),
                    ]
                    .map(|(x, y)| PtInRegion(region, x, y));
                    DeleteObject(region);
                    assert_eq!(corners, [0; 4], "{} at zoom {zoom}", path.display());
                    assert!(edges.iter().all(|&inside| inside != 0));
                }
            }
        }
        assert_eq!(count, 9);
    }

    #[test]
    fn centers_the_keymap_inside_the_focused_window() {
        let position = centered_position(
            PhysicalPosition::new(100, 200),
            PhysicalSize::new(1400, 900),
            PhysicalSize::new(1000, 600),
        );
        assert_eq!(position, PhysicalPosition::new(300, 350));
    }

    #[test]
    fn zoom_keeps_the_keymap_center_fixed() {
        let position = recentered_position(
            PhysicalPosition::new(300, 350),
            PhysicalSize::new(1000, 600),
            PhysicalSize::new(1200, 720),
        );
        assert_eq!(position, PhysicalPosition::new(200, 290));
    }

    #[test]
    fn hidden_keymap_rechecks_the_cached_svg_before_showing() {
        assert!(should_check_svg(false, false, false, true));
        assert!(should_check_svg(true, false, false, false));
        assert!(should_check_svg(false, true, false, false));
        assert!(should_check_svg(false, false, true, false));
        assert!(!should_check_svg(false, false, false, false));
    }

    #[test]
    fn hidden_follow_is_deferred_until_the_keymap_is_opened() {
        assert!(should_defer_hidden_follow(CommandAction::Follow, false));
        assert!(!should_defer_hidden_follow(CommandAction::Follow, true));
        assert!(!should_defer_hidden_follow(CommandAction::Toggle, false));
    }

    #[test]
    fn heartbeat_file_sits_beside_the_command_file() {
        assert_eq!(
            heartbeat_path(Path::new("C:/Temp/snow-keymap.command")),
            PathBuf::from("C:/Temp/snow-keymap.command.alive")
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn tool_window_style_preserves_existing_flags() {
        assert_eq!(tool_window_style(0x0000_0008), 0x0000_0088);
        assert_eq!(tool_window_style(0x0000_0088), 0x0000_0088);
        assert_eq!(tool_window_style(0x0004_0108), 0x0000_0188);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn borderless_style_removes_caption_and_controls_but_preserves_visibility_and_clipping() {
        use windows_sys::Win32::UI::WindowsAndMessaging::{WS_CLIPSIBLINGS, WS_VISIBLE};

        let preserved = (WS_VISIBLE | WS_CLIPSIBLINGS) as isize;
        let decorated = preserved
            | (WS_CAPTION | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX) as isize;
        assert_eq!(borderless_window_style(decorated), preserved);
        assert_eq!(borderless_window_style(preserved), preserved);
    }

    #[cfg(target_os = "windows")]
    #[test]
    #[allow(deprecated)]
    fn borderless_tool_window_survives_native_moves_style_rewrites_and_cached_reopen() {
        use windows_sys::Win32::Foundation::{POINT, RECT};
        use windows_sys::Win32::Graphics::Gdi::{ClientToScreen, GetDC, GetPixel, ReleaseDC};
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            GetClientRect, GetWindowRect, NCCALCSIZE_PARAMS, SendMessageW, WINDOWPOS,
            WM_ENTERSIZEMOVE, WM_EXITSIZEMOVE,
        };
        use winit::event::Event;
        use winit::platform::pump_events::EventLoopExtPumpEvents;
        use winit::platform::windows::EventLoopBuilderExtWindows;

        let mut event_loop = EventLoop::<UserEvent>::with_user_event()
            .with_any_thread(true)
            .build()
            .unwrap();
        let window = Arc::new(
            event_loop
                .create_window(
                    WindowAttributes::default()
                        .with_visible(false)
                        .with_active(false)
                        .with_decorations(false)
                        .with_skip_taskbar(true),
                )
                .unwrap(),
        );
        mark_as_tool_window(&window).unwrap();
        let RawWindowHandle::Win32(handle) = window.window_handle().unwrap().as_raw() else {
            panic!("expected a Win32 window");
        };
        let hwnd = handle.hwnd.get() as HWND;
        let check_style = || {
            // SAFETY: this test owns the window and runs on its event-loop thread.
            let style = unsafe { GetWindowLongPtrW(hwnd, GWL_EXSTYLE) };
            assert_ne!(style & WS_EX_TOOLWINDOW as isize, 0);
            assert_eq!(style & WS_EX_APPWINDOW as isize, 0);
            let style = unsafe { GetWindowLongPtrW(hwnd, GWL_STYLE) };
            assert_eq!(style, borderless_window_style(style));
        };
        let check_client_area = || {
            let proposed = RECT {
                left: 200,
                top: 250,
                right: 1240,
                bottom: 840,
            };
            let coordinates = |rect: RECT| (rect.left, rect.top, rect.right, rect.bottom);
            // SAFETY: hwnd is live on this thread; both NCCALCSIZE forms receive their
            // documented writable structures, with a live WINDOWPOS for the TRUE form.
            unsafe {
                let mut rect = proposed;
                SendMessageW(hwnd, WM_NCCALCSIZE, 0, &mut rect as *mut RECT as LPARAM);
                assert_eq!(coordinates(rect), coordinates(proposed));
                let mut position = WINDOWPOS {
                    hwnd,
                    ..Default::default()
                };
                let mut params = NCCALCSIZE_PARAMS {
                    rgrc: [proposed; 3],
                    lppos: &mut position,
                };
                SendMessageW(
                    hwnd,
                    WM_NCCALCSIZE,
                    1,
                    &mut params as *mut NCCALCSIZE_PARAMS as LPARAM,
                );
                assert_eq!(coordinates(params.rgrc[0]), coordinates(proposed));

                let mut outer = RECT::default();
                let mut client = RECT::default();
                let mut origin = POINT::default();
                assert_ne!(GetWindowRect(hwnd, &mut outer), 0);
                assert_ne!(GetClientRect(hwnd, &mut client), 0);
                assert_ne!(ClientToScreen(hwnd, &mut origin), 0);
                assert_eq!((origin.x, origin.y), (outer.left, outer.top));
                assert_eq!(
                    (client.right, client.bottom),
                    (outer.right - outer.left, outer.bottom - outer.top)
                );
            }
        };
        for _ in 0..3 {
            window.set_visible(true);
            check_style();
            check_client_area();
            window.set_window_level(WindowLevel::AlwaysOnTop);
            check_style();
            // These messages bracket the same native size/move path used by drag_window.
            // SAFETY: hwnd remains live and these messages have no pointer parameters.
            unsafe { SendMessageW(hwnd, WM_ENTERSIZEMOVE, 0, 0) };
            for position in [
                PhysicalPosition::new(120, 150),
                PhysicalPosition::new(160, 180),
            ] {
                window.set_outer_position(position);
                check_style();
                check_client_area();
            }
            unsafe { SendMessageW(hwnd, WM_EXITSIZEMOVE, 0, 0) };
            check_client_area();
            window.set_visible(false);
            check_style();
            window.set_window_level(WindowLevel::Normal);
            check_style();
        }

        let path =
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../../lua/snow/keymaps/snow_sipin.svg");
        let mut app = App::new();
        app.window = Some(window.clone());
        let context = Context::new(window.clone()).unwrap();
        app.surface = Some(Surface::new(&context, window.clone()).unwrap());
        let command = |token: &str| Command {
            action: CommandAction::Toggle,
            token: token.to_owned(),
            image_path: path.clone(),
        };
        let mut checked = false;
        event_loop.pump_events(Some(Duration::ZERO), |event, active| {
            if !matches!(event, Event::AboutToWait) || checked {
                return;
            }
            let target = WindowArea {
                position: PhysicalPosition::new(130, 170),
                size: PhysicalSize::new(1600, 1000),
            };
            app.initial_focused_area = Some(target);
            app.show_command(active, command("open"));
            let expected = window.inner_size();
            assert_eq!(
                window.outer_position().unwrap(),
                centered_position(target.position, target.size, expected),
                "the first show must use the triggering window even if foreground focus changed",
            );
            assert!(app.initial_focused_area.is_none());
            app.hide();
            let cached_image = app.image.as_ref().unwrap().pixels.as_ptr();
            let _ = window.request_inner_size(PhysicalSize::new(1704, 52));
            assert_ne!(window.inner_size(), expected);
            app.show_command(active, command("reopen"));
            assert_eq!(window.inner_size(), expected);
            assert_eq!(app.image.as_ref().unwrap().pixels.as_ptr(), cached_image);
            check_style();
            check_client_area();
            app.redraw();
            let image = app.image.as_ref().unwrap();
            let x = image.width / 2;
            let y = 10;
            let rgb = image.pixels[(y * image.width + x) as usize];
            let expected = ((rgb & 0xff) << 16) | (rgb & 0xff00) | ((rgb >> 16) & 0xff);
            // Check the rendered pixels too: native activation used to draw a caption
            // inside the client area even when styles and geometry looked borderless.
            // SAFETY: valid window/DC on the owning thread; no pointer message arguments.
            unsafe {
                SendMessageW(hwnd, WM_NCACTIVATE, 0, 0);
                SendMessageW(hwnd, WM_NCACTIVATE, 1, 0);
                SendMessageW(hwnd, WM_NCPAINT, 1, 0);
                let dc = GetDC(hwnd);
                assert!(!dc.is_null());
                let actual = GetPixel(dc, x as i32, y as i32);
                ReleaseDC(hwnd, dc);
                assert_eq!(actual, expected, "native caption painted over the image");
            }
            app.hide();
            checked = true;
        });
        assert!(checked);
    }
}
