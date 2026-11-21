// A Lua C function that needs no Lua symbols or version-specific Lua ABI calls.
// Loading this DLL lets Weasel start the GUI without a synchronous console shell.
#[cfg(target_os = "windows")]
mod windows {
    use std::ffi::{OsString, c_void};
    use std::os::windows::ffi::{OsStrExt, OsStringExt};
    use std::path::PathBuf;

    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::LibraryLoader::{
        GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS, GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
        GetModuleFileNameW, GetModuleHandleExW,
    };
    use windows_sys::Win32::System::Threading::{
        CREATE_NO_WINDOW, CreateProcessW, PROCESS_INFORMATION, STARTUPINFOW,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

    fn launch() -> std::io::Result<()> {
        // Capture the user's window before process startup can change foreground focus.
        let focused_window = unsafe { GetForegroundWindow() } as usize;
        let mut module = std::ptr::null_mut();
        let mut buffer = vec![0u16; 32768];
        // The function's address identifies this DLL, rather than the host Weasel EXE.
        if unsafe {
            GetModuleHandleExW(
                GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS
                    | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
                snow_keymap_launch as *const () as *const u16,
                &mut module,
            )
        } == 0
        {
            return Err(std::io::Error::last_os_error());
        }
        let length =
            unsafe { GetModuleFileNameW(module, buffer.as_mut_ptr(), buffer.len() as u32) };
        if length == 0 || length as usize >= buffer.len() {
            return Err(std::io::Error::last_os_error());
        }
        let library = PathBuf::from(OsString::from_wide(&buffer[..length as usize]));
        let directory = library.parent().ok_or(std::io::ErrorKind::InvalidInput)?;
        let helper = directory.join("snow-keymap-windows.exe");
        let user_dir = directory
            .ancestors()
            .nth(3)
            .ok_or(std::io::ErrorKind::InvalidInput)?;
        let temporary = std::env::var_os("TEMP")
            .or_else(|| std::env::var_os("TMPDIR"))
            .or_else(|| std::env::var_os("TMP"))
            .map(PathBuf::from)
            .unwrap_or_else(|| user_dir.to_owned());
        let command_file = temporary.join("snow-pinyin-keymap-v2.command");
        let executable: Vec<_> = helper.as_os_str().encode_wide().chain(Some(0)).collect();
        // Both paths end with filenames, so quoted arguments cannot end in a backslash.
        let arguments = format!(
            "\"{}\" --command-file \"{}\" --focus-window {}",
            helper.display(),
            command_file.display(),
            focused_window,
        );
        let mut arguments: Vec<_> = arguments.encode_utf16().chain(Some(0)).collect();
        let startup = STARTUPINFOW {
            cb: std::mem::size_of::<STARTUPINFOW>() as u32,
            ..Default::default()
        };
        let mut process = PROCESS_INFORMATION::default();
        // No shell, console allocation, inherited handles, or wait for GUI initialization.
        if unsafe {
            CreateProcessW(
                executable.as_ptr(),
                arguments.as_mut_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                0,
                CREATE_NO_WINDOW,
                std::ptr::null(),
                std::ptr::null(),
                &startup,
                &mut process,
            )
        } == 0
        {
            return Err(std::io::Error::last_os_error());
        }
        unsafe {
            CloseHandle(process.hThread);
            CloseHandle(process.hProcess);
        }
        Ok(())
    }

    // Lua owns the state. Do not dereference it or link against the host's Lua version.
    #[unsafe(no_mangle)]
    pub extern "C" fn snow_keymap_launch(_lua_state: *mut c_void) -> i32 {
        let _ = launch();
        0
    }
}
