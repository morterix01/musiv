pub mod bridge;
pub mod commands;
pub mod discord;
pub mod http;
pub mod logging;
pub mod mcp;
pub mod mpd;
pub mod net;
pub mod oauth;
mod setup;
pub mod stream_server;
pub mod ytdlp;
pub mod ytdlp_setup;

// Maximizes the window when running as a non-steam app in steam
#[cfg(target_os = "linux")]
fn maximize_for_gamescope(app: &tauri::App) {
    use tauri::Manager;

    let is_gamescope = std::env::var("GAMESCOPE_WAYLAND_DISPLAY").is_ok()
        || std::env::var("SteamDeck").map_or(false, |v| v == "1");

    if is_gamescope {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.maximize();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let is_flatpak = std::env::var("FLATPAK_ID").is_ok();

    let context = tauri::generate_context!();

    // Only register the updater plugin when its configuration is actually
    // present and non-null. Builds made without updater secrets null out
    // `plugins.updater`, and registering the plugin against a null config
    // panics during initialization, killing the app before its window appears.
    let updater_configured = context
        .config()
        .plugins
        .0
        .get("updater")
        .is_some_and(|value| !value.is_null());

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_upload::init())
        .plugin(setup::log_plugin());

    if !is_flatpak {
        if updater_configured {
            builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
        }
        builder = builder.plugin(tauri_plugin_process::init());
    }

    builder
        .invoke_handler(tauri::generate_handler![
            commands::is_flatpak,
            commands::copy_dir_recursive,
            commands::extract_zip,
            commands::download_file,
            http::http_fetch,
            ytdlp::ytdlp_search,
            ytdlp::ytdlp_get_stream,
            ytdlp::ytdlp_get_playlist,
            logging::get_startup_logs,
            mcp::mcp_start,
            mcp::mcp_stop,
            mpd::mpd_start,
            mpd::mpd_stop,
            oauth::oauth_loopback_start,
            oauth::oauth_loopback_wait,
            stream_server::stream_server_port,
            ytdlp_setup::ytdlp_ensure_installed,
            discord::discord_connect,
            discord::discord_disconnect,
            discord::discord_set_activity,
            discord::discord_clear_activity,
            bridge::bridge_respond,
            bridge::bridge_notify
        ])
        .setup(|app| {
            use tauri::Manager;

            logging::mark_startup_complete();

            app.manage(oauth::OAuthLoopbackState::default());

            // Claim the nuclear:// scheme so OAuth callbacks
            // (nuclear://spotify-callback?code=...) are routed back into the app.
            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register_all();
            }

            bridge::init_bridge(app.handle().clone());
            mcp::init_mcp(app.handle().clone());
            mpd::init_mpd(app.handle().clone());
            stream_server::init_stream_server(app.handle().clone());
            discord::init_discord(app.handle().clone());

            #[cfg(target_os = "linux")]
            maximize_for_gamescope(app);

            Ok(())
        })
        .run(context)
        .expect("error while running tauri application");
}
