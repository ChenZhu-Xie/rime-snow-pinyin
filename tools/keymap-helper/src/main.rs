#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use std::collections::HashMap;
use std::fs::{File, OpenOptions};
use std::io::{ErrorKind, Read};
use std::num::NonZeroU32;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use fs2::FileExt;
use resvg::{tiny_skia, usvg};
use softbuffer::{Context, Surface};
use winit::application::ApplicationHandler;
use winit::dpi::{PhysicalPosition, PhysicalSize};
use winit::event::{ElementState, MouseButton, MouseScrollDelta, Touch, TouchPhase, WindowEvent};
use winit::event_loop::{ActiveEventLoop, ControlFlow, EventLoop, EventLoopProxy};
use winit::keyboard::{Key, NamedKey};
use winit::window::{Window, WindowAttributes, WindowId, WindowLevel};

const POLL_INTERVAL: Duration = Duration::from_millis(30);
const LONG_PRESS_DELAY: Duration = Duration::from_millis(500);
const SCREEN_MARGIN: i32 = 24;
const DRAG_THRESHOLD: f64 = 6.0;
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PressOutcome {
    KeepOpen,
    Close,
}

fn finish_press(elapsed: Duration, moved: bool) -> PressOutcome {
    if elapsed >= LONG_PRESS_DELAY && !moved {
        PressOutcome::Close
    } else {
        PressOutcome::KeepOpen
    }
}

fn adjust_zoom(current: f64, delta: f64) -> f64 {
    (current + delta).clamp(MIN_ZOOM, MAX_ZOOM)
}

fn positions_differ(before: PhysicalPosition<i32>, after: PhysicalPosition<i32>) -> bool {
    let dx = f64::from(after.x - before.x);
    let dy = f64::from(after.y - before.y);
    dx.hypot(dy) >= DRAG_THRESHOLD
}

fn start_command_watcher(command_file: PathBuf, proxy: EventLoopProxy<UserEvent>) {
    thread::spawn(move || {
        let mut last_value = String::new();
        loop {
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
                    return;
                }
            }
            thread::sleep(POLL_INTERVAL);
        }
    });
}

#[derive(Debug)]
struct RenderedImage {
    width: u32,
    height: u32,
    pixels: Vec<u32>,
}

struct MousePress {
    started: Instant,
    window_position: PhysicalPosition<i32>,
    drag_started: bool,
    moved: bool,
}

struct TouchPress {
    id: u64,
    started: Instant,
    origin: PhysicalPosition<f64>,
    window_position: PhysicalPosition<i32>,
    moved: bool,
}

fn render_svg(
    path: &Path,
    maximum_size: PhysicalSize<u32>,
    scale_factor: f64,
) -> Result<RenderedImage, String> {
    let data = std::fs::read(path)
        .map_err(|error| format!("无法读取键位图 {}：{error}", path.display()))?;
    let mut options = usvg::Options::default();
    options.fontdb_mut().load_system_fonts();
    let tree = usvg::Tree::from_data(&data, &options)
        .map_err(|error| format!("无法解析键位图 {}：{error}", path.display()))?;
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
    resvg::render(&tree, transform, &mut pixmap.as_mut());
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

struct App {
    window: Option<Arc<Window>>,
    surface: Option<Surface<Arc<Window>, Arc<Window>>>,
    image: Option<RenderedImage>,
    current_path: Option<PathBuf>,
    pending_command: Option<Command>,
    visible: bool,
    zoom: f64,
    mouse_press: Option<MousePress>,
    touches: HashMap<u64, PhysicalPosition<f64>>,
    touch_press: Option<TouchPress>,
    touch_span: Option<f64>,
}

impl App {
    fn new() -> Self {
        Self {
            window: None,
            surface: None,
            image: None,
            current_path: None,
            pending_command: None,
            visible: false,
            zoom: 1.0,
            mouse_press: None,
            touches: HashMap::new(),
            touch_press: None,
            touch_span: None,
        }
    }

    fn hide(&mut self) {
        if let Some(window) = self.window.as_ref() {
            window.set_visible(false);
        }
        self.visible = false;
        self.mouse_press = None;
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

    fn render_current(&mut self, event_loop: &ActiveEventLoop, keep_bottom_right: bool) -> bool {
        let (Some(window), Some(path)) = (self.window.as_ref(), self.current_path.as_ref()) else {
            return false;
        };
        let window = window.clone();
        let path = path.clone();
        let previous_size = self.image.as_ref().map_or(window.inner_size(), |image| {
            PhysicalSize::new(image.width, image.height)
        });
        let (_, maximum_size) = self.monitor_and_maximum(event_loop);
        let Ok(image) = render_svg(&path, maximum_size, window.scale_factor() * self.zoom) else {
            return false;
        };
        let previous_position = window.outer_position().ok();
        let _ = window.request_inner_size(PhysicalSize::new(image.width, image.height));
        if keep_bottom_right && let Some(position) = previous_position {
            window.set_outer_position(PhysicalPosition::new(
                position.x + previous_size.width as i32 - image.width as i32,
                position.y + previous_size.height as i32 - image.height as i32,
            ));
        }
        self.image = Some(image);
        window.request_redraw();
        true
    }

    fn place_bottom_right(&self, event_loop: &ActiveEventLoop) {
        let (Some(window), Some(image)) = (self.window.as_ref(), self.image.as_ref()) else {
            return;
        };
        let (monitor, _) = self.monitor_and_maximum(event_loop);
        let Some(monitor) = monitor else {
            return;
        };
        let monitor_size = monitor.size();
        let position = monitor.position();
        window.set_outer_position(PhysicalPosition::new(
            position.x + monitor_size.width as i32 - image.width as i32 - SCREEN_MARGIN,
            position.y + monitor_size.height as i32 - image.height as i32 - SCREEN_MARGIN,
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
        if command.action == CommandAction::Follow && !self.visible {
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
        if self.current_path.as_deref() != Some(command.image_path.as_path()) {
            self.current_path = Some(command.image_path);
            if !self.render_current(event_loop, false) {
                return;
            }
        }

        window.set_visible(true);
        window.request_redraw();
        self.visible = true;
        if first_show {
            self.place_bottom_right(event_loop);
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
                        started: Instant::now(),
                        origin: touch.location,
                        window_position: window
                            .outer_position()
                            .unwrap_or(PhysicalPosition::new(0, 0)),
                        moved: false,
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
                    && press.started.elapsed() >= LONG_PRESS_DELAY
                {
                    let dx = touch.location.x - press.origin.x;
                    let dy = touch.location.y - press.origin.y;
                    if dx.hypot(dy) >= DRAG_THRESHOLD {
                        press.moved = true;
                        window.set_outer_position(PhysicalPosition::new(
                            press.window_position.x + dx.round() as i32,
                            press.window_position.y + dy.round() as i32,
                        ));
                    }
                }
                self.update_touch_zoom(event_loop);
            }
            TouchPhase::Ended | TouchPhase::Cancelled => {
                self.touches.remove(&touch.id);
                if let Some(press) = self.touch_press.take()
                    && press.id == touch.id
                    && finish_press(press.started.elapsed(), press.moved) == PressOutcome::Close
                {
                    self.hide();
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
    fn about_to_wait(&mut self, event_loop: &ActiveEventLoop) {
        let Some(press) = self.mouse_press.as_mut() else {
            return;
        };
        if press.drag_started {
            return;
        }
        let deadline = press.started + LONG_PRESS_DELAY;
        if Instant::now() < deadline {
            event_loop.set_control_flow(ControlFlow::WaitUntil(deadline));
            return;
        }
        let Some(window) = self.window.as_ref() else {
            return;
        };
        press.drag_started = true;
        let _ = window.drag_window();

        // macOS 的原生拖动可能吞掉鼠标释放事件，并在松开后才返回。
        #[cfg(target_os = "macos")]
        {
            let Some(press) = self.mouse_press.take() else {
                return;
            };
            let after = window.outer_position().unwrap_or(press.window_position);
            let moved = press.moved || positions_differ(press.window_position, after);
            if finish_press(press.started.elapsed(), moved) == PressOutcome::Close {
                self.hide();
            }
        }
        event_loop.set_control_flow(ControlFlow::Wait);
    }

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
                self.mouse_press = Some(MousePress {
                    started: Instant::now(),
                    window_position: window
                        .outer_position()
                        .unwrap_or(PhysicalPosition::new(0, 0)),
                    drag_started: false,
                    moved: false,
                });
                event_loop
                    .set_control_flow(ControlFlow::WaitUntil(Instant::now() + LONG_PRESS_DELAY));
            }
            WindowEvent::MouseInput {
                state: ElementState::Released,
                button: MouseButton::Left,
                ..
            } => {
                if let Some(press) = self.mouse_press.take() {
                    let after = window.outer_position().unwrap_or(press.window_position);
                    let moved = press.moved || positions_differ(press.window_position, after);
                    if finish_press(press.started.elapsed(), moved) == PressOutcome::Close {
                        self.hide();
                    }
                }
                event_loop.set_control_flow(ControlFlow::Wait);
            }
            WindowEvent::Moved(position) => {
                if let Some(press) = self.mouse_press.as_mut()
                    && press.drag_started
                    && positions_differ(press.window_position, position)
                {
                    press.moved = true;
                }
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
    start_command_watcher(command_file, event_loop.create_proxy());
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
    fn short_click_stays_open_and_stationary_long_press_closes() {
        assert_eq!(
            finish_press(Duration::from_millis(120), false),
            PressOutcome::KeepOpen
        );
        assert_eq!(finish_press(LONG_PRESS_DELAY, false), PressOutcome::Close);
        assert_eq!(finish_press(LONG_PRESS_DELAY, true), PressOutcome::KeepOpen);
    }

    #[test]
    fn zoom_is_bounded_for_wheel_and_pinch_input() {
        assert_eq!(adjust_zoom(1.0, 0.2), 1.2);
        assert_eq!(adjust_zoom(MAX_ZOOM, 1.0), MAX_ZOOM);
        assert_eq!(adjust_zoom(MIN_ZOOM, -1.0), MIN_ZOOM);
    }
}
