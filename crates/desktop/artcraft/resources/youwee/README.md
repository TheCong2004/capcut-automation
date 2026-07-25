# Youwee BE (packaged with ArtCraft)

Giống `resources/capcut-mate/` — **chỉ BE**, không UI youwee.

## Mô hình

| Thành phần | Nơi sống |
|------------|----------|
| **UI** | ArtCraft FE: `frontend/apps/artcraft/.../PageYouwee` |
| **BE source** | `artcraft/youwee` (Rust/Tauri commands + yt-dlp stack) |
| **BE runtime (sau này)** | HTTP sidecar (port gợi ý **30001**, capcut-mate = 30000) |
| **Stage khi build** | Folder này: `crates/desktop/artcraft/resources/youwee/` |

## Hiện tại

- Chưa copy binary/source BE vào đây (placeholder).
- UI youwee gốc (`artcraft/youwee/src`) **giữ tạm** để đọc flow API / invoke.
- Khi có HTTP server (hoặc freeze sidecar), `stage_youwee.ps1` (TODO) copy vào đây + spawn từ Tauri như `spawn_capcut_mate_backend`.

## Dev

```powershell
# Tham chiếu API / UI cũ (tạm)
cd d:\capcutpolot\artcraft\youwee
bun run tauri dev

# ArtCraft UI Youwee
# Apps → Youwee (localhost:5173)
```
