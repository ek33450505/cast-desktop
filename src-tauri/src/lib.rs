mod cwd;
mod git;
mod process;
mod pty;
mod session;

use session::SessionStore;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SessionStore::new())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Drop the default macOS application menu to reclaim Cmd+W for the
            // tab-close hotkey. The default menu binds Cmd+W to CloseWindow at
            // the OS level, preventing the keydown event from reaching the
            // WKWebView. An empty menu means macOS never intercepts it.
            // Wave 2.4 can restore Edit/Copy/Paste if needed for non-terminal fields.
            #[cfg(target_os = "macos")]
            {
                let empty_menu = tauri::menu::MenuBuilder::new(app).build()?;
                app.set_menu(empty_menu)?;
            }

            // Spawn the Express sidecar server
            // TODO(phase-3): dynamic port selection — currently hardcoded to 3001 in server/constants.ts
            let sidecar = app.shell().sidecar("cast-server").expect("failed to create sidecar");
            let (_rx, _child) = sidecar.spawn().expect("failed to spawn cast-server sidecar");
            app.manage(_child);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pty::pty_create,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            process::get_foreground_process,
            process::get_default_shell,
            cwd::get_cwd,
            git::get_git_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
