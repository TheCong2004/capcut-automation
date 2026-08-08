pub mod core;
pub mod services;
pub mod version;

use app_lib as youwee;
use tauri::Manager;

use crate::core::commands::app_preferences::get_app_preferences_command::get_app_preferences_command;
use crate::core::commands::app_preferences::update_app_preference_command::update_app_preferences_command;
use crate::core::commands::cost_estimate::estimate_image_cost_command::estimate_image_cost_command;
use crate::core::commands::cost_estimate::estimate_splat_cost_command::estimate_splat_cost_command;
use crate::core::commands::cost_estimate::estimate_video_cost_command::estimate_video_cost_command;
use crate::core::commands::generate::models::image::list_image_models_command::list_image_models_command;
use crate::core::commands::generate::models::video::list_video_models_command::list_video_models_command;
use crate::core::commands::download::download_directory_reveal_command::download_directory_reveal_command;
use crate::core::commands::download::download_media_file_command::download_media_file_command;
use crate::core::commands::download::download_url_command::download_url_command;
use crate::core::commands::enqueue::image_bg_removal::enqueue_image_bg_removal_command::enqueue_image_bg_removal_command;
use crate::core::commands::enqueue::image_to_gaussian::enqueue_image_to_gaussian_command::enqueue_image_to_gaussian_command;
use crate::core::commands::enqueue::image_to_object::enqueue_image_to_3d_object_command::enqueue_image_to_3d_object_command;
use crate::core::commands::generate::generate_image::generate_image_command::generate_image_command;
use crate::core::commands::generate::generate_video::generate_video_command::generate_video_command;
use crate::core::commands::flip_image::flip_image;
use crate::core::commands::get_app_info_command::get_app_info_command;
use crate::core::commands::load_without_cors_command::load_without_cors_command;
use crate::core::commands::media_files::media_file_delete_command::media_file_delete_command;
use crate::core::commands::platform_info_command::platform_info_command;
use crate::core::commands::providers::deprecated::get_provider_order_command::get_provider_order_command;
use crate::core::commands::providers::deprecated::set_provider_order_command::set_provider_order_command;
use crate::core::commands::providers::provider_clear_command::provider_clear_command;
use crate::core::commands::providers::provider_list_command::provider_list_command;
use crate::core::commands::providers::provider_set_api_key_command::provider_set_api_key_command;
use crate::core::commands::task_queue::get_task_queue_command::get_task_queue_command;
use crate::core::commands::task_queue::mark_task_as_dismissed_command::mark_task_as_dismissed_command;
use crate::core::commands::task_queue::tasks_nuke_all_command::tasks_nuke_all_command;
use crate::core::commands::pipeline::cancel_pipeline_job_command::cancel_pipeline_job_command;
use crate::core::commands::pipeline::enqueue_pipeline_job_command::enqueue_pipeline_job_command;
use crate::core::commands::pipeline::floword_commands::{cancel_floword_workflow, enqueue_floword_workflow, get_floword_readiness, get_floword_workflow, list_floword_workflows, list_omniroute_models, retry_floword_step};
use crate::core::commands::pipeline::list_pipeline_jobs_command::list_pipeline_jobs_command;
use crate::core::commands::vynaro_command::{
  vynaro_open_command, vynaro_start_command, vynaro_status_command, vynaro_stop_command,
  VynaroProcessManager,
};
use crate::core::commands::inkos_command::{
  inkos_start_command, inkos_status_command, inkos_stop_command, InkosProcessManager,
};
use crate::services::pipeline::state::command_dispatcher::CommandDispatcher;
use crate::core::lifecycle::startup::handle_tauri_startup::handle_tauri_startup;
use crate::core::lifecycle::startup::setup_main_window::setup_main_window;
use crate::core::state::app_env_configs::app_env_configs::AppEnvConfigs;
use crate::core::state::app_preferences::app_preferences_manager::load_app_preferences_or_default;
use crate::core::state::artcraft_platform_info::ArtcraftPlatformInfo;
use crate::core::state::data_dir::app_data_root::AppDataRoot;
use crate::core::state::provider_priority::ProviderPriorityStore;
use crate::core::threads::discord_presence_thread::discord_presence_thread;
use crate::core::threads::main_window_thread::main_window_thread::main_window_thread;
use crate::services::grok::commands::grok_clear_credentials_command::grok_clear_credentials_command;
use crate::services::grok::commands::grok_get_credential_info_command::grok_get_credential_info_command;
use crate::services::grok::commands::grok_open_login_command::grok_open_login_command;
use crate::services::grok::state::grok_credential_manager::GrokCredentialManager;
use crate::services::grok::state::grok_image_prompt_queue::GrokImagePromptQueue;
use crate::services::midjourney::commands::midjourney_clear_credentials_command::midjourney_clear_credentials_command;
use crate::services::midjourney::commands::midjourney_get_credential_info_command::midjourney_get_credential_info_command;
use crate::services::midjourney::commands::midjourney_open_login_command::midjourney_open_login_command;
use crate::services::midjourney::state::midjourney_credential_manager::MidjourneyCredentialManager;
use crate::services::sora::commands::check_sora_session_command::check_sora_session_command;
use crate::services::sora::commands::open_sora_login_command::open_sora_login_command;
use crate::services::sora::commands::sora_get_credential_info_command::sora_get_credential_info_command;
use crate::services::sora::commands::sora_logout_command::sora_logout_command;
use crate::services::sora::state::sora_credential_manager::SoraCredentialManager;
use crate::services::sora::state::sora_task_queue::SoraTaskQueue;
use crate::services::sora::threads::sora_task_polling::sora_task_polling_thread::sora_task_polling_thread;
use crate::services::storyteller::commands::storyteller_get_credits_command::storyteller_get_credits_command;
use crate::services::storyteller::commands::storyteller_get_subscription_command::storyteller_get_subscription_command;
use crate::services::storyteller::commands::storyteller_purge_credentials_command::storyteller_purge_credentials_command;
use crate::services::storyteller::commands::stripe_checkout::storyteller_open_credits_purchase_command::storyteller_open_credits_purchase_command;
use crate::services::storyteller::commands::stripe_checkout::storyteller_open_subscription_purchase_command::storyteller_open_subscription_purchase_command;
use crate::services::storyteller::commands::stripe_customer_portal::storyteller_open_customer_portal_cancel_plan_command::storyteller_open_customer_portal_cancel_plan_command;
use crate::services::storyteller::commands::stripe_customer_portal::storyteller_open_customer_portal_manage_plan_command::storyteller_open_customer_portal_manage_plan_command;
use crate::services::storyteller::commands::stripe_customer_portal::storyteller_open_customer_portal_switch_plan_command::storyteller_open_customer_portal_switch_plan_command;
use crate::services::storyteller::commands::stripe_customer_portal::storyteller_open_customer_portal_update_payment_method_command::storyteller_open_customer_portal_update_payment_method_command;
use crate::services::storyteller::state::storyteller_credential_manager::StorytellerCredentialManager;
use crate::services::worldlabs::commands::worldlabs_clear_credentials_command::worldlabs_clear_credentials_command;
use crate::services::worldlabs::commands::worldlabs_get_credential_info_command::worldlabs_get_credential_info_command;
use crate::services::worldlabs::commands::worldlabs_open_login_command::worldlabs_open_login_command;
use crate::services::worldlabs::commands::worldlabs_receive_bearer_command::worldlabs_receive_bearer_command;
use crate::services::worldlabs::state::worldlabs_bearer_bridge::WorldlabsBearerBridge;
use crate::services::worldlabs::state::worldlabs_credential_manager::WorldlabsCredentialManager;
use log::error;

use crate::core::state::artcraft_usage_tracker::artcraft_usage_tracker::ArtcraftUsageTracker;
use tauri_plugin_dialog;
use tauri_plugin_http;
use tauri_plugin_log::Target;
use tauri_plugin_log::TargetKind;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // NB: Tauri wants to install the logger itself, so we can't rely on the logger crate
  // until the tauri runtime begins.
  println!("Loading config...");
  let app_data_root = AppDataRoot::create_default().expect("data directory should be created");
  let app_data_root_2 = app_data_root.clone();

  println!("Getting platform info...");
  let artcraft_platform_info = ArtcraftPlatformInfo::get();
  let artcraft_platform_info_2 = artcraft_platform_info.clone();

  println!("Platform info: {:?}", artcraft_platform_info);

  println!("Loading app preferences...");
  let app_preferences = load_app_preferences_or_default(&app_data_root);

  let provider_credential_cache = crate::core::providers::credentials::provider_credential_loading_cache::ProviderCredentialLoadingCache::new(app_data_root.clone());
  let provider_credential_cache_2 = provider_credential_cache.clone();

  // NB: tauri-plugin-http stores the credentials on disk, so we can defer to that for now.
  // println!("Attempting to read existing artcraft credentials...");
  // let storyteller_creds_manager = StorytellerCredentialManager::initialize_from_disk_infallible(&app_data_root);
  let storyteller_creds_manager = StorytellerCredentialManager::initialize_empty(&app_data_root);
  let storyteller_creds_manager_2 = storyteller_creds_manager.clone();
  let storyteller_creds_manager_3 = storyteller_creds_manager.clone();

  println!("Attempting to read existing sora credentials...");
  let sora_creds_manager = SoraCredentialManager::initialize_from_disk_infallible(&app_data_root);
  let sora_creds_manager_2 = sora_creds_manager.clone();

  // Other state
  let sora_task_queue = SoraTaskQueue::new();
  let sora_task_queue_2 = sora_task_queue.clone();

  let app_env_configs = AppEnvConfigs::load_from_filesystem(&app_data_root).expect("AppEnvConfigs should be loaded from disk");

  let app_env_configs_2 = app_env_configs.clone();

  let midjourney_creds_manager = MidjourneyCredentialManager::initialize_from_disk_infallible(&app_data_root);
  let midjourney_creds_manager_2 = midjourney_creds_manager.clone();

  let grok_creds_manager = GrokCredentialManager::initialize_from_disk_infallible(&app_data_root);
  let grok_creds_manager_2 = grok_creds_manager.clone();

  let grok_prompt_queue = GrokImagePromptQueue::new();
  let grok_prompt_queue_2 = grok_prompt_queue.clone();

  let worldlabs_creds_manager = WorldlabsCredentialManager::initialize_from_disk_infallible(&app_data_root);
  let worldlabs_creds_manager_2 = worldlabs_creds_manager.clone();

  let worldlabs_bearer_bridge = WorldlabsBearerBridge::empty();
  let worldlabs_bearer_bridge_2 = worldlabs_bearer_bridge.clone();

  let artcraft_usage_tracker = ArtcraftUsageTracker::new();
  let artcraft_usage_tracker_2 = artcraft_usage_tracker.clone();

  // Pipeline orchestrator: CommandDispatcher gates CPU/GPU-bound stages.
  // CPU pool covers light stages (script gen); GPU pool covers heavy render.
  const DEFAULT_CPU_PERMITS: usize = 4;
  const DEFAULT_GPU_PERMITS: usize = 1;
  let command_dispatcher = CommandDispatcher::new(DEFAULT_CPU_PERMITS, DEFAULT_GPU_PERMITS);
  let command_dispatcher_2 = command_dispatcher.clone();

  println!("Initializing backend runtime...");

  let builder = tauri::Builder::default()
    .plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .targets(vec![
          Target::new(TargetKind::Stdout),
          Target::new(TargetKind::LogDir { file_name: Some(app_data_root.log_file_name_str().to_string()) }),
        ])
        .build(),
    );
  let builder = vynaro::init_vynaro(builder)
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_upload::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .setup(move |app| {
      // TODO(bt): This is broken on windows
      // log_environment_details();

      //if cfg!(debug_assertions) {
      //  app.handle().plugin(
      //    tauri_plugin_log::Builder::default()
      //      .level(log::LevelFilter::Info)
      //      .build(),
      //  )?;
      //}
      youwee::initialize_embedded(app)?;

      let app = app.handle().clone();
      let handle = app.clone();
      let root = app_data_root_2.clone();
      let env_config = app_env_configs_2.clone();
      let storyteller_creds = storyteller_creds_manager_2.clone();
      let sora_creds = sora_creds_manager_2.clone();
      let sora_tasks = sora_task_queue_2.clone();
      let dispatcher = command_dispatcher_2.clone();

      tauri::async_runtime::block_on(async move {
        let result = setup_main_window(&app).await;

        let result = handle_tauri_startup(handle, root, env_config, artcraft_platform_info_2, artcraft_usage_tracker_2, storyteller_creds, sora_creds, sora_tasks, midjourney_creds_manager_2, grok_creds_manager_2, grok_prompt_queue_2, worldlabs_bearer_bridge_2, worldlabs_creds_manager_2, provider_credential_cache_2, dispatcher).await;

        if let Err(err) = result {
          error!("Failed to handle Tauri startup: {:?}", err);
          panic!("Failed to handle Tauri startup: {:?}", err);
        }
      });

      Ok(())
    })
    .manage(app_data_root)
    .manage(app_env_configs)
    .manage(app_preferences)
    .manage(artcraft_platform_info)
    .manage(artcraft_usage_tracker)
    .manage(grok_creds_manager)
    .manage(grok_prompt_queue)
    .manage(midjourney_creds_manager)
    .manage(sora_creds_manager)
    .manage(sora_task_queue)
    .manage(storyteller_creds_manager_3)
    .manage(worldlabs_bearer_bridge)
    .manage(provider_credential_cache)
    .manage(command_dispatcher)
    .manage(worldlabs_creds_manager)
    .manage(VynaroProcessManager::default())
    .manage(InkosProcessManager::default());

  // TODO: Break this out into another module, because RustRover/IntelliJ lags with these macros.
  //  My first attempt at naively doing this didn't work because the macros can't find their codegen'd targets.
  let builder = builder.invoke_handler(tauri::generate_handler![
    check_sora_session_command,
    download_directory_reveal_command,
    download_media_file_command,
    download_url_command,
    enqueue_image_bg_removal_command,
    enqueue_image_to_3d_object_command,
    enqueue_image_to_gaussian_command,
    estimate_image_cost_command,
    estimate_splat_cost_command,
    estimate_video_cost_command,
    list_image_models_command,
    list_video_models_command,
    flip_image,
    generate_image_command,
    generate_video_command,
    get_app_info_command,
    get_app_preferences_command,
    get_provider_order_command,
    get_task_queue_command,
    provider_clear_command,
    provider_list_command,
    provider_set_api_key_command,
    grok_clear_credentials_command,
    grok_get_credential_info_command,
    grok_open_login_command,
    load_without_cors_command,
    mark_task_as_dismissed_command,
    media_file_delete_command,
    midjourney_clear_credentials_command,
    midjourney_get_credential_info_command,
    midjourney_open_login_command,
    open_sora_login_command,
    platform_info_command,
    set_provider_order_command,
    sora_get_credential_info_command,
    sora_logout_command,
    storyteller_get_credits_command,
    storyteller_get_subscription_command,
    storyteller_open_credits_purchase_command,
    storyteller_open_customer_portal_cancel_plan_command,
    storyteller_open_customer_portal_manage_plan_command,
    storyteller_open_customer_portal_switch_plan_command,
    storyteller_open_customer_portal_update_payment_method_command,
    storyteller_open_subscription_purchase_command,
    storyteller_purge_credentials_command,
    tasks_nuke_all_command,
    vynaro_status_command,
    vynaro_start_command,
    vynaro_open_command,
    vynaro_stop_command,
    inkos_status_command,
    inkos_start_command,
    inkos_stop_command,
    enqueue_pipeline_job_command,
    list_pipeline_jobs_command,
    cancel_pipeline_job_command,
    enqueue_floword_workflow,
    get_floword_workflow,
    list_floword_workflows,
    cancel_floword_workflow,
    retry_floword_step,
    list_omniroute_models,
    get_floword_readiness,
    list_omniroute_models,
    get_floword_readiness,
    update_app_preferences_command,
    worldlabs_clear_credentials_command,
    worldlabs_get_credential_info_command,
    worldlabs_open_login_command,
    worldlabs_receive_bearer_command,
    // Youwee download and media commands
    youwee::commands::download_video,
    youwee::commands::stop_download,
    youwee::commands::download_gallery,
    youwee::commands::stop_gallery_download,
    youwee::commands::get_video_basic_info,
    youwee::commands::get_video_info,
    youwee::commands::get_playlist_entries,
    youwee::commands::search_youtube_videos,
    youwee::commands::get_available_subtitles,
    youwee::commands::get_video_transcript,
    youwee::commands::get_ytdlp_version,
    youwee::commands::check_ytdlp_update,
    youwee::commands::update_ytdlp,
    youwee::commands::get_ytdlp_channel_cmd,
    youwee::commands::get_ytdlp_source_cmd,
    youwee::commands::set_ytdlp_source_cmd,
    youwee::commands::set_ytdlp_channel_cmd,
    youwee::commands::get_all_ytdlp_versions_cmd,
    youwee::commands::check_ytdlp_channel_update,
    youwee::commands::download_ytdlp_channel,
    youwee::commands::check_ffmpeg,
    youwee::commands::get_ffmpeg_source_cmd,
    youwee::commands::set_ffmpeg_source_cmd,
    youwee::commands::check_ffmpeg_update,
    youwee::commands::download_ffmpeg,
    youwee::commands::get_ffmpeg_path_for_ytdlp,
    youwee::commands::check_deno,
    youwee::commands::check_deno_update,
    youwee::commands::download_deno,
    youwee::commands::check_gallerydl,
    youwee::commands::detect_installed_browsers,
    youwee::commands::get_browser_profiles,
    // Logs and history
    youwee::commands::get_logs,
    youwee::commands::get_plugin_logs,
    youwee::commands::clear_plugin_logs,
    youwee::commands::add_log,
    youwee::commands::clear_logs,
    youwee::commands::export_logs,
    youwee::commands::add_history,
    youwee::commands::get_history,
    youwee::commands::get_history_entries_by_ids,
    youwee::commands::find_duplicate_downloads,
    youwee::commands::delete_history,
    youwee::commands::clear_history,
    youwee::commands::get_history_count,
    youwee::commands::get_tags,
    youwee::commands::get_collections,
    youwee::commands::create_collection,
    youwee::commands::rename_collection,
    youwee::commands::delete_collection,
    youwee::commands::assign_history_tags,
    youwee::commands::assign_history_collections,
    youwee::commands::remove_history_tag,
    youwee::commands::remove_history_from_collection,
    youwee::commands::open_file_location,
    youwee::commands::check_file_exists,
    youwee::commands::allow_asset_file,
    youwee::commands::sync_asset_scope_paths,
    youwee::commands::rename_downloaded_file,
    youwee::commands::sync_history_renamed_entry,
    youwee::commands::split_media_segments,
    youwee::commands::update_summary,
    youwee::commands::add_summary_only_history,
    youwee::commands::open_macos_privacy_settings,
    // AI, processing, subtitles, and metadata
    youwee::commands::save_ai_config,
    youwee::commands::get_ai_config,
    youwee::commands::test_ai_connection,
    youwee::commands::generate_video_summary,
    youwee::commands::generate_summary_with_options,
    youwee::commands::cancel_summary_generation,
    youwee::commands::generate_ai_response,
    youwee::commands::get_ai_models,
    youwee::commands::get_summary_languages,
    youwee::commands::get_video_metadata,
    youwee::commands::detect_shot_changes,
    youwee::commands::get_image_metadata,
    youwee::commands::get_processing_attachment_info,
    youwee::commands::generate_processing_command,
    youwee::commands::generate_quick_action_command,
    youwee::commands::execute_ffmpeg_command,
    youwee::commands::execute_ffmpeg_batch,
    youwee::commands::cancel_ffmpeg,
    youwee::commands::get_processing_history,
    youwee::commands::save_processing_job,
    youwee::commands::update_processing_job,
    youwee::commands::delete_processing_job,
    youwee::commands::clear_processing_history,
    youwee::commands::get_processing_presets,
    youwee::commands::save_processing_preset,
    youwee::commands::delete_processing_preset,
    youwee::commands::generate_video_preview,
    youwee::commands::generate_video_thumbnail,
    youwee::commands::generate_audio_preview,
    youwee::commands::check_preview_exists,
    youwee::commands::cleanup_previews,
    youwee::commands::transcribe_video_with_whisper,
    youwee::commands::transcribe_url_with_whisper,
    youwee::commands::generate_subtitles_with_whisper,
    youwee::commands::download_subtitle_content,
    youwee::commands::fetch_metadata,
    youwee::commands::extract_data_rows,
    youwee::commands::export_data_rows_sqlite,
    // Plugins, channels, queue, and integration commands
    youwee::commands::list_plugins,
    youwee::commands::get_plugin_details,
    youwee::commands::inspect_plugin_package,
    youwee::commands::install_plugin_package,
    youwee::commands::uninstall_plugin,
    youwee::commands::attach_plugin_workspace,
    youwee::commands::create_plugin_workspace,
    youwee::commands::update_plugin_state,
    youwee::commands::get_plugin_trigger_workflow,
    youwee::commands::update_plugin_trigger_workflow,
    youwee::commands::enqueue_plugin_workflow_trigger,
    youwee::commands::approve_plugin_permissions,
    youwee::commands::update_plugin_config_values,
    youwee::commands::set_plugin_provider,
    youwee::commands::set_plugin_timeout,
    youwee::commands::open_plugin_directory,
    youwee::commands::list_runtime_providers,
    youwee::commands::get_runtime_provider_status,
    youwee::commands::set_default_provider_for_language,
    youwee::commands::set_plugin_runtime_locale,
    youwee::commands::cancel_metadata_fetch,
    youwee::commands::cancel_data_export,
    youwee::commands::get_channel_videos,
    youwee::commands::get_channel_info,
    youwee::commands::stop_channel_fetch,
    youwee::commands::follow_channel,
    youwee::commands::unfollow_channel,
    youwee::commands::get_followed_channels,
    youwee::commands::update_channel_settings,
    youwee::commands::save_channel_videos,
    youwee::commands::get_saved_channel_videos,
    youwee::commands::get_saved_channel_videos_by_video_ids,
    youwee::commands::update_channel_video_status,
    youwee::commands::update_channel_video_status_by_video_id,
    youwee::commands::get_new_videos_count,
    youwee::commands::update_channel_last_checked,
    youwee::commands::update_channel_info,
    youwee::commands::set_polling_network_config,
    youwee::commands::set_telegram_config,
    youwee::commands::get_telegram_status,
    youwee::commands::send_telegram_reply,
    youwee::commands::load_download_queue,
    youwee::commands::save_download_queue,
    youwee::commands::clear_download_queue,
    youwee::commands::is_flatpak_environment,
    youwee::commands::consume_pending_external_links,
    youwee::commands::consume_pending_cli_download_requests,
    youwee::commands::get_cli_shortcut_status,
    youwee::commands::install_cli_shortcut,
    youwee::embedded_system_commands::set_hide_dock_on_close,
    youwee::embedded_system_commands::rebuild_tray_menu_cmd,
    youwee::embedded_system_commands::update_tray_schedule,
    youwee::embedded_system_commands::update_tray_download_status,
    youwee::embedded_system_commands::youwee_backend_health,
  ]);

  builder.run(tauri::generate_context!("tauri.conf.json")).expect("error while running tauri application");
}
