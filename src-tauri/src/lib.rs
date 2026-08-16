use tauri::{
    webview::{NewWindowResponse, WebviewWindowBuilder},
    WebviewUrl,
};

const CORE_HOST: &str = "sdigitalcore.vercel.app";

fn is_core_url(url: &url::Url) -> bool {
    let is_local_dev =
        cfg!(debug_assertions) && matches!(url.host_str(), Some("localhost" | "127.0.0.1"));

    (url.scheme() == "https" && url.host_str() == Some(CORE_HOST)) || is_local_dev
}

fn open_external(url: &url::Url) {
    if matches!(url.scheme(), "http" | "https" | "mailto" | "tel") {
        let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(mobile)]
            app.handle().plugin(tauri_plugin_fcm::init())?;
            #[cfg(mobile)]
            app.handle().plugin(tauri_plugin_deep_link::init())?;

            let window_builder = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External("https://sdigitalcore.vercel.app".parse().unwrap()),
            )
            .title("SDigitalCore");

            #[cfg(not(mobile))]
            let window_builder = window_builder
                .inner_size(1440.0, 900.0)
                .min_inner_size(1024.0, 640.0)
                .resizable(true)
                .center();

            let window = window_builder
            .on_navigation(|url| {
                if is_core_url(url) {
                    true
                } else {
                    open_external(url);
                    false
                }
            })
            .on_new_window(|url, _features| {
                open_external(&url);
                NewWindowResponse::Deny
            })
            .build()?;

            window.set_title("SDigitalCore")?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error al ejecutar SDigitalCore Desktop");
}
