#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use std::collections::HashMap;
use std::fs::{File, OpenOptions};
use std::io::{ErrorKind, Read, Seek, SeekFrom, Write};
use std::num::NonZeroU32;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
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

const POLL_INTERVAL: Duration = Duration::from_millis(30);
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const MIN_ZOOM: f64 = 0.55;
const MAX_ZOOM: f64 = 2.5;

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
        fn GetForegroundWindow() -> *mut c_void;
        fn GetWindowRect(window: *mut c_void, rect: *mut Rect) -> i32;
        fn IsIconic(window: *mut c_void) -> i32;
    }

    // SAFETY: the handles and output rectangle are used only for these read-only Win32 calls.
    unsafe {
        let window = GetForegroundWindow();
        if window.is_null() || IsIconic(window) != 0 {
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
    pixmap.fill(tiny_skia::Color::from_rgba8(0xff, 0xfd, 0xf9, 0xff));
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
    pending_command: Option<Command>,
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
        Self {
            window: None,
            surface: None,
            image: None,
            svg_options: svg_options(),
            svg_cache: HashMap::new(),
            svg: None,
            current_path: None,
            pending_command: None,
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
        let tree = Arc::new(load_svg(path, &self.svg_options)?);
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
        if let Some(window) = self.window.as_ref() {
            window.set_visible(false);
        }
        self.visible = false;
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
        let Ok(image) = render_svg(svg, maximum_size, window.scale_factor() * self.zoom) else {
            return false;
        };
        let previous_position = window.outer_position().ok();
        let _ = window.request_inner_size(PhysicalSize::new(image.width, image.height));
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
        window.set_outer_position(centered_position(
            area.position,
            area.size,
            PhysicalSize::new(image.width, image.height),
        ));
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
        let Some(window) = self.window.clone() else {
            return;
        };
        if should_defer_hidden_follow(command.action, self.visible) {
            self.current_path = Some(command.image_path);
            return;
        }
        if command.action == CommandAction::Toggle
            && self.current_path.as_deref() == Some(command.image_path.as_path())
            && self.visible
        {
            self.hide();
            return;
        }

        let first_show = !self.visible;
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

        let focused_area = first_show.then(focused_window_area).flatten();
        window.set_visible(true);
        window.request_redraw();
        self.visible = true;
        if first_show {
            self.place_centered(event_loop, focused_area);
        }
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
        let (Some(surface), Some(image)) = (self.surface.as_mut(), self.image.as_ref()) else {
            return;
        };
        let (Some(width), Some(height)) =
            (NonZeroU32::new(image.width), NonZeroU32::new(image.height))
        else {
            return;
        };
        if surface.resize(width, height).is_err() {
            return;
        }
        let Ok(mut buffer) = surface.buffer_mut() else {
            return;
        };
        if buffer.len() == image.pixels.len() {
            buffer.copy_from_slice(&image.pixels);
            let _ = buffer.present();
        }
    }
}

impl ApplicationHandler<UserEvent> for App {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        if self.window.is_some() {
            return;
        }
        let attributes = WindowAttributes::default()
            .with_title("冰雪拼音键位图")
            .with_inner_size(PhysicalSize::new(1040, 590))
            .with_resizable(false)
            .with_decorations(false)
            .with_visible(false)
            .with_active(false)
            .with_window_level(WindowLevel::AlwaysOnTop);
        let Ok(window) = event_loop.create_window(attributes) else {
            event_loop.exit();
            return;
        };
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
        if let Some(command) = self.pending_command.take() {
            self.show_command(event_loop, command);
        }
    }

    fn user_event(&mut self, event_loop: &ActiveEventLoop, event: UserEvent) {
        match event {
            UserEvent::Command(command) => {
                if self.window.is_some() {
                    self.show_command(event_loop, command);
                } else {
                    self.pending_command = Some(command);
                }
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
            WindowEvent::RedrawRequested => self.redraw(),
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

fn command_file_from_args() -> Result<PathBuf, String> {
    let mut args = std::env::args_os().skip(1);
    while let Some(argument) = args.next() {
        if argument == "--command-file" {
            return args
                .next()
                .map(PathBuf::from)
                .ok_or_else(|| "--command-file 缺少路径".to_owned());
        }
    }
    Err("用法：snow-keymap --command-file <路径>".to_owned())
}

fn run() -> Result<(), String> {
    let command_file = command_file_from_args()?;
    let Some(_instance_lock) = InstanceLock::acquire(&command_file)? else {
        return Ok(());
    };
    let event_loop = EventLoop::<UserEvent>::with_user_event()
        .build()
        .map_err(|error| format!("无法创建窗口事件循环：{error}"))?;
    let _command_watcher = start_command_watcher(command_file, event_loop.create_proxy());
    event_loop
        .run_app(&mut App::new())
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
        let follow = parse_command("follow\tsnow_jiandao:2\tC:/keymaps/snow_jiandao.svg").unwrap();
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
}
