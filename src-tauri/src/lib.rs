mod cwd;
mod git;
mod lsp;
mod menu;
mod process;
mod pty;
mod session;

use lsp::LspState;
use session::SessionStore;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SessionStore::new())
        .manage(LspState::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Build the native macOS menu. Cmd+W is intentionally absent from
            // all menu items — EditorTabs.tsx owns that binding via useHotkeys
            // for tab-close. Any accelerator placed here would be intercepted by
            // macOS before the WKWebView keydown event fires.
            let app_menu = menu::build_menu(app.handle())?;
            app.set_menu(app_menu)?;

            // Spawn the Express sidecar server
            // TODO(phase-3): dynamic port selection — currently hardcoded to 3001 in server/constants.ts
            let sidecar = app.shell().sidecar("cast-server").expect("failed to create sidecar");
            let (_rx, _child) = sidecar.spawn().expect("failed to spawn cast-server sidecar");
            app.manage(_child);
            Ok(())
        })
        .on_menu_event(menu::handle_menu_event)
        .invoke_handler(tauri::generate_handler![
            pty::pty_create,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            process::get_foreground_process,
            process::get_default_shell,
            cwd::get_cwd,
            git::get_git_status,
            lsp::start_lsp_server,
            lsp::stop_lsp_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
