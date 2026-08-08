# Vynaro Native Integration - Discovery Inventory (Phase 0)

## 1. Frontend Route Files
- `vynaro/src/routes/__root.tsx` (`createRootRouteWithContext`)
- `vynaro/src/routes/index.tsx` (Dashboard `/`)
- `vynaro/src/routes/assets.tsx` (Asset Management `/assets`)
- `vynaro/src/routes/production.tsx` (7-step Workflow `/production`)
- `vynaro/src/routes/settings.tsx` (Settings `/settings`)
- `vynaro/src/routes/help.tsx` (Help `/help`)
- `vynaro/src/routes/-routeTree.gen.ts` (Generated TanStack route tree)

## 2. IPC Call Sites
- `vynaro/src/ipc/client.ts`: Strong dependency on `@tauri-apps/api/core` `invoke`.
- `vynaro/src/ipc/events.ts` & `useTauriEvent.ts`: `@tauri-apps/api/event` `listen`.
- `vynaro/src/components/common/ThumbnailImage.tsx` & `Step4VoicePanel.tsx`: `@tauri-apps/api/core` `convertFileSrc`.
- Plugin calls: `@tauri-apps/plugin-dialog` (`open`), `@tauri-apps/plugin-opener` (`revealItemInDir`).

## 3. Rust Commands List (41 Commands)
- **app**: `app_version`, `app_started_at`, `app_system_info`
- **project**: `project_list_recent`, `project_create_blank`, `project_load`, `project_save`, `project_delete`, `project_add_media`
- **pipeline**: `pipeline_step_defs`, `pipeline_status`, `pipeline_start`, `pipeline_cancel`, `pipeline_reset`
- **settings**: `settings_get`, `settings_set`
- **update**: `update_get_state`, `update_check`, `update_download`, `update_install`, `update_reset`
- **assets**: `assets_scan`, `assets_metadata`, `assets_thumbnail`, `assets_search`
- **export**: `export_plan`, `export_validate_params`, `export_render_subtitles`, `video_build_plans`, `export_capcut_draft`
- **help**: `help_topics`, `help_topic_get`, `help_search`
- **theme**: `i18n_get_locale`, `i18n_set_locale`, `i18n_translate`
- **voice**: `voice_preview`, `voice_synthesize`
- **script**: `script_generate`
- **detect**: `detect_scenes`
- **subtitle**: `subtitle_generate`

## 4. Tauri Plugin Dependencies
| Plugin | ArtCraft Status | Required Action |
|--------|-----------------|-----------------|
| `tauri-plugin-dialog` | Existing in `lib.rs` | Reuse existing instance |
| `tauri-plugin-fs` | Existing in `lib.rs` | Reuse existing instance |
| `tauri-plugin-opener` | Existing in `lib.rs` | Reuse existing instance |
| `tauri-plugin-shell` | Existing in `lib.rs` | Reuse existing instance |

## 5. Global State & Services
- `AppContext` (vynaro-core)
- `PipelineService` (vynaro-compose)
- `UpdateService` (vynaro-update)
- `AssetService` (vynaro-storage)
- `Translator` (vynaro-core)
- `HelpRegistry` (vynaro-core)

## 6. CSS Entrypoints
- `vynaro/src/styles/globals.css` (Tailwind v4)

## 7. Frontend Dependencies Check
- Both ArtCraft and Vynaro use `@tanstack/react-query` v5 and `zustand` v5.
- Both use `@tauri-apps/api` v2.

## 8. React Compatibility
- ArtCraft uses React 18.2 / 18.3.
- Vynaro uses React 19.1 in `package.json`, but source code uses standard React 18 compatible hooks (`useState`, `useEffect`, `useCallback`, `useRef`). No React 19 specific hooks (`useActionState`, `useOptimistic`) were found.
