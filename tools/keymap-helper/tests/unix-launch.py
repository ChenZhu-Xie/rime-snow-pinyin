#!/usr/bin/env python3
"""Exercise the real helper and background-shell launch, without Rime or Mira.

X11/macOS observe native window visibility, bounds and foreground ownership.
Headless Wayland checks buffer presentation and actual surface destruction in
the client protocol log; it cannot measure desktop placement or keyboard focus.
Times include a warm OS file cache and are not hardware key-to-screen latency.
"""

import argparse
import atexit
import ctypes as c
import json
import os
from pathlib import Path
import plistlib
import re
import shlex
import subprocess
import sys
import tempfile
import time


def output(*args):
    return subprocess.check_output(args, text=True).strip()


class MacDesktop:
    def __init__(self):
        self.cg = c.CDLL("/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics")
        self.cf = c.CDLL("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation")
        c.CDLL("/System/Library/Frameworks/AppKit.framework/AppKit")
        self.objc = c.CDLL("/usr/lib/libobjc.A.dylib")
        self.objc.objc_getClass.argtypes = [c.c_char_p]
        self.objc.objc_getClass.restype = c.c_void_p
        self.objc.sel_registerName.argtypes = [c.c_char_p]
        self.objc.sel_registerName.restype = c.c_void_p
        self.send = c.CFUNCTYPE(c.c_void_p, c.c_void_p, c.c_void_p)(("objc_msgSend", self.objc))
        self.send_pid = c.CFUNCTYPE(c.c_int, c.c_void_p, c.c_void_p)(("objc_msgSend", self.objc))
        self.cg.CGWindowListCopyWindowInfo.argtypes = [c.c_uint32, c.c_uint32]
        self.cg.CGWindowListCopyWindowInfo.restype = c.c_void_p
        self.cf.CFPropertyListCreateData.argtypes = [c.c_void_p, c.c_void_p, c.c_long, c.c_ulong, c.c_void_p]
        self.cf.CFPropertyListCreateData.restype = c.c_void_p
        self.cf.CFDataGetLength.argtypes = [c.c_void_p]
        self.cf.CFDataGetLength.restype = c.c_long
        self.cf.CFDataGetBytePtr.argtypes = [c.c_void_p]
        self.cf.CFDataGetBytePtr.restype = c.c_void_p
        self.cf.CFRelease.argtypes = [c.c_void_p]

    def focus(self):
        workspace = self.send(self.objc.objc_getClass(b"NSWorkspace"), self.objc.sel_registerName(b"sharedWorkspace"))
        app = self.send(workspace, self.objc.sel_registerName(b"frontmostApplication"))
        return self.send_pid(app, self.objc.sel_registerName(b"processIdentifier"))

    def window(self, pid):
        windows = self.cg.CGWindowListCopyWindowInfo(1 | 16, 0)
        data = self.cf.CFPropertyListCreateData(None, windows, 100, 0, None)
        try:
            entries = plistlib.loads(c.string_at(self.cf.CFDataGetBytePtr(data), self.cf.CFDataGetLength(data)))
            for entry in entries:
                if entry.get("kCGWindowOwnerPID") == pid and entry.get("kCGWindowIsOnscreen"):
                    rect = entry["kCGWindowBounds"]
                    return [rect[key] for key in ("X", "Y", "Width", "Height")]
        finally:
            self.cf.CFRelease(data)
            self.cf.CFRelease(windows)
        return None

    def screen(self):
        class Rect(c.Structure):
            _fields_ = [(name, c.c_double) for name in ("x", "y", "width", "height")]
        self.cg.CGMainDisplayID.restype = c.c_uint32
        self.cg.CGDisplayBounds.argtypes = [c.c_uint32]
        self.cg.CGDisplayBounds.restype = Rect
        rect = self.cg.CGDisplayBounds(self.cg.CGMainDisplayID())
        return [rect.x, rect.y, rect.width, rect.height]


class X11Desktop:
    def __init__(self):
        # A real foreground window makes the no-focus assertion meaningful.
        reference = subprocess.Popen(["xmessage", "-title", "snow-keymap-focus-reference", "-geometry", "480x240+50+70", "Keymap test input window"])
        atexit.register(reference.terminate)
        identifier = output("xdotool", "search", "--sync", "--onlyvisible", "--pid", str(reference.pid), "--name", "snow-keymap-focus-reference").splitlines()[0]
        output("xdotool", "windowactivate", "--sync", identifier)

    def focus(self):
        return output("xdotool", "getwindowfocus")

    def window(self, pid):
        # Search includes unmapped windows, so visibility is checked separately.
        search = subprocess.run(["xdotool", "search", "--pid", str(pid), "--name", "冰雪拼音键位图"], capture_output=True, text=True)
        for identifier in search.stdout.split():
            info = output("xwininfo", "-id", identifier)
            if "Map State: IsViewable" not in info:
                continue
            values = [re.search(pattern + r"\s+(-?\d+)", info) for pattern in (
                "Absolute upper-left X:", "Absolute upper-left Y:", "Width:", "Height:")]
            if all(values):
                return [int(value[1]) for value in values]
        return None

    def screen(self):
        size = re.search(r"dimensions:\s+(\d+)x(\d+)", output("xdpyinfo"))
        return [0, 0, int(size[1]), int(size[2])]


def wait_for(check, process, description, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = check()
        if result:
            return result
        if process.poll() is not None:
            raise AssertionError(f"helper exited ({process.returncode}) while waiting for {description}")
        time.sleep(0.01)
    raise AssertionError(f"timeout waiting for {description}")


def run(args):
    root = Path(__file__).resolve().parents[3]
    helper = Path(args.helper).resolve()
    desktop = None if args.wayland else MacDesktop() if sys.platform == "darwin" else X11Desktop()
    before_focus = desktop.focus() if desktop else None
    report = {"platform": sys.platform, "backend": "wayland" if args.wayland else "cocoa" if sys.platform == "darwin" else "x11"}
    with tempfile.TemporaryDirectory(prefix="snow-keymap-中文 空格-") as directory:
        temporary = Path(directory)
        command = temporary / "keymap.command"
        trace = temporary / "trace.tsv"
        stderr = temporary / "stderr.log"
        pid_file = temporary / "helper.pid"
        events = lambda: [line.split("\t", 1) for line in trace.read_text().splitlines()] if trace.exists() else []
        count = lambda event: sum(name == event for _, name in events())
        serial = 0

        def send(action, image="snow_jiandao_toned"):
            nonlocal serial
            serial += 1
            # Atomic replacement keeps partial writes out of this timing harness.
            pending = temporary / "pending"
            pending.write_text(f"{action}\t{serial}\t{root}/lua/snow/keymaps/{image}.svg", encoding="utf-8")
            pending.replace(command)

        send("toggle")
        environment = dict(os.environ, SNOW_KEYMAP_TRACE=str(trace))
        if args.wayland:
            environment["WAYLAND_DEBUG"] = "client"
        # Same POSIX shell/background operation as keymap.lua, with $! captured
        # solely to clean up the exact child created by this test.
        launch = f"{shlex.quote(str(helper))} --command-file {shlex.quote(str(command))} >/dev/null 2>{shlex.quote(str(stderr))} & echo $! >{shlex.quote(str(pid_file))}"
        started = time.monotonic()
        subprocess.run(["/bin/sh", "-c", launch], env=environment, check=True, timeout=10)
        report["shell_return_ms"] = round((time.monotonic() - started) * 1000, 2)
        pid = int(pid_file.read_text())

        class Child:
            returncode = None

            def poll(self):
                try:
                    os.kill(pid, 0)
                except ProcessLookupError:
                    self.returncode = -1
                return self.returncode

        process = Child()
        try:
            wait_for(lambda: count("presented"), process, "first buffer presentation")
            report["first_present_observed_ms"] = round((time.monotonic() - started) * 1000, 2)
            if desktop:
                bounds = wait_for(lambda: desktop.window(pid), process, "visible native window")
                report["first_visible_observed_ms"] = round((time.monotonic() - started) * 1000, 2)
                screen = desktop.screen()
                report["bounds"] = bounds
                report["centered"] = all(abs(bounds[i] + bounds[i + 2] / 2 - screen[i] - screen[i + 2] / 2) <= 3 for i in (0, 1))
                report["foreground_preserved"] = desktop.focus() == before_focus
                assert report["centered"], report
                assert report["foreground_preserved"], report

            for iteration in range(3):
                hidden = count("hidden")
                send("toggle")
                wait_for(lambda: count("hidden") > hidden, process, "hide")
                if desktop:
                    wait_for(lambda: desktop.window(pid) is None, process, "native window hidden")
                else:
                    wait_for(lambda: sum("wl_surface" in line and ".destroy(" in line for line in stderr.read_text().splitlines()) > iteration, process, "Wayland surface destroyed")
                # Hidden schema changes must neither show a window nor parse SVG.
                received, parsed = count("command.received"), count("svg.begin")
                created = count("window.begin")
                send("follow")
                wait_for(lambda: count("command.received") > received, process, "hidden follow")
                assert count("svg.begin") == parsed, "hidden follow parsed SVG"
                assert count("window.begin") == created, "hidden follow created a window"
                if desktop:
                    assert desktop.window(pid) is None, "hidden follow showed a window"
                presented = count("presented")
                reopened = time.monotonic()
                send("toggle")
                wait_for(lambda: count("presented") > presented, process, "cached reopen")
                report.setdefault("cached_present_observed_ms", []).append(round((time.monotonic() - reopened) * 1000, 2))
                if desktop:
                    wait_for(lambda: desktop.window(pid), process, "native window reopened")
                    assert desktop.focus() == before_focus, "cached reopen changed foreground"

            assert count("fonts.begin") == 1, "font database was rebuilt"
            assert count("svg.begin") == 1, "cached toggles reparsed SVG"
            assert count("raster.begin") == 1, "cached toggles rasterized SVG again"
            presented = count("presented")
            send("follow", "snow_sipin")
            wait_for(lambda: count("presented") > presented, process, "visible schema follow")
            assert count("svg.begin") == 2, "schema follow did not load the new diagram"
            assert count("fonts.begin") == 1, "schema follow rebuilt the font database"
            report["trace"] = [{"ms": float(ms), "event": event} for ms, event in events()]
            first = {}
            for ms, event in events():
                first.setdefault(event, float(ms))
            report["stages_ms"] = {stage: round(first[f"{stage}.end"] - first[f"{stage}.begin"], 3) for stage in ("event_loop", "fonts", "svg", "raster", "window")}
            report["process_to_first_present_ms"] = first["presented"]
            report["passed"] = True
        finally:
            try:
                os.kill(pid, 15)
                time.sleep(0.1)
            except ProcessLookupError:
                pass
            # Keep logs on failure as well as success, outside TemporaryDirectory.
            destination = Path(args.output)
            destination.mkdir(parents=True, exist_ok=True)
            for source in (trace, stderr):
                if source.exists():
                    (destination / source.name).write_bytes(source.read_bytes())
            (destination / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--helper", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--wayland", action="store_true")
    run(parser.parse_args())
