#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use std::fs::{File, OpenOptions};
use std::io::{ErrorKind, Read};
use std::num::NonZeroU32;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use fs2::FileExt;
use resvg::{tiny_skia, usvg};
use softbuffer::{Context, Surface};
use winit::application::ApplicationHandler;
use winit::dpi::{PhysicalPosition, PhysicalSize};
use winit::event::{ElementState, MouseButton, WindowEvent};
use winit::event_loop::{ActiveEventLoop, EventLoop, EventLoopProxy};
use winit::window::{Window, WindowAttributes, WindowId, WindowLevel};

const POLL_INTERVAL: Duration = Duration::from_millis(30);
const SCREEN_MARGIN: i32 = 24;

#[derive(Debug, Clone)]
struct Command {
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
    let (token, image_path) = value.trim().split_once('\t')?;
    if token.is_empty() || image_path.is_empty() {
        return None;
    }
    Some(Command {
        token: token.to_owned(),
        image_path: PathBuf::from(image_path),
    })
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
    let desired_scale = scale_factor.max(1.0);
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
        }
    }

    fn show_command(&mut self, event_loop: &ActiveEventLoop, command: Command) {
        let Some(window) = self.window.as_ref() else {
            return;
        };
        if self.current_path.as_deref() == Some(command.image_path.as_path()) && self.visible {
            window.set_visible(false);
            self.visible = false;
            return;
        }

        if self.current_path.as_deref() != Some(command.image_path.as_path()) {
            let monitor = window
                .current_monitor()
                .or_else(|| event_loop.primary_monitor());
            let monitor_size = monitor
                .as_ref()
                .map_or(PhysicalSize::new(1280, 720), |monitor| monitor.size());
            let maximum_size = PhysicalSize::new(
                (monitor_size.width as f64 * 0.78) as u32,
                (monitor_size.height as f64 * 0.72) as u32,
            );
            let Ok(image) = render_svg(&command.image_path, maximum_size, window.scale_factor())
            else {
                return;
            };
            let _ = window.request_inner_size(PhysicalSize::new(image.width, image.height));
            if let Some(monitor) = monitor {
                let position = monitor.position();
                window.set_outer_position(PhysicalPosition::new(
                    position.x + monitor_size.width as i32 - image.width as i32 - SCREEN_MARGIN,
                    position.y + monitor_size.height as i32 - image.height as i32 - SCREEN_MARGIN,
                ));
            }
            self.current_path = Some(command.image_path);
            self.image = Some(image);
        }

        window.set_visible(true);
        window.request_redraw();
        self.visible = true;
        let _ = command.token;
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
                window.set_visible(false);
                self.visible = false;
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
        let command = parse_command("snow_sipin:1\tC:/Rime Data/keymaps/snow_sipin.svg").unwrap();
        assert_eq!(command.token, "snow_sipin:1");
        assert_eq!(
            command.image_path,
            PathBuf::from("C:/Rime Data/keymaps/snow_sipin.svg")
        );
    }

    #[test]
    fn rejects_incomplete_command() {
        assert!(parse_command("").is_none());
        assert!(parse_command("token-only").is_none());
        assert!(parse_command("\timage.svg").is_none());
    }
}
