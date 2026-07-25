# engines/mate — Mate engine (Phase 1)

Thin in-process engine boundary over existing **capcut-mate** business logic.

| | |
|--|--|
| **Public API** | Unchanged: `/openapi/capcut-mate/v1/*` (router → still may call `src.service`) |
| **This package** | Internal facade so BE code calls Mate without HTTP |
| **Source of truth** | Still `src/service/*` — **do not delete/move** until a later merge phase |
| **Plan** | `docs/PLAN-gop-be-python.md` Phase 1 |

```
ArtCraft ──HTTP──► router/v1 ──► src.service  (today; contract frozen)
                      │
                      └── future: engines.mate.facade ──► src.service
```

---

## 1. Service hiện tại → module đích

Phase 1 keeps implementations in `src/service/`. Target layout (later phases may *move* code here; facade already uses these names as entry modules):

| `src/service` (hiện tại) | Module đích (engines/mate) | Ghi chú |
|--------------------------|----------------------------|---------|
| `create_draft.py` | `engines/mate` → `create_draft` | Facade: `create_draft` ✓ |
| `save_draft.py` | `engines/mate` → `save_draft` | Facade: `save_draft` / `save_draft_async` ✓ |
| `get_draft.py` | `engines/mate` → `get_draft` | TODO facade |
| `add_videos.py` | `engines/mate` → `add_videos` | Facade: `add_videos` / `_async` ✓ |
| `add_images.py` | `engines/mate` → `add_images` | TODO facade |
| `add_audios.py` | `engines/mate` → `add_audios` | TODO facade |
| `get_audio_duration.py` | `engines/mate` → `get_audio_duration` | TODO facade |
| `add_captions.py` | `engines/mate` → `add_captions` | TODO facade |
| `add_effects.py` / `get_effects.py` | `engines/mate` → effects | TODO facade |
| `add_filters.py` / `get_filters.py` | `engines/mate` → filters | TODO facade |
| `search_sticker.py` / `add_sticker.py` | `engines/mate` → sticker | TODO facade |
| `add_keyframes.py` | `engines/mate` → `add_keyframes` | TODO facade |
| `add_masks.py` | `engines/mate` → `add_masks` | TODO facade |
| `gen_video.py` | `engines/mate` → `gen_video` | Facade: `gen_video`, `gen_video_status`, `get_gen_video_active_count` ✓ |
| `get_text_animations.py` | `engines/mate` → animations | TODO facade |
| `get_image_animations.py` | `engines/mate` → animations | TODO facade |
| `timelines.py` | `engines/mate` → `timelines` | TODO facade |
| other infos helpers | `engines/mate` → helpers | Mate-only; low priority |

Router and schemas stay outside this package. No change to OpenAPI paths/bodies.

---

## 2. API Mate (ArtCraft wire) → hàm facade

Prefix HTTP: `/openapi/capcut-mate/v1`  
Client: `artcraft/.../capcutMateClient.ts`

| HTTP path | `src.service` | `engines.mate.facade` | ArtCraft |
|-----------|---------------|------------------------|----------|
| `POST /create_draft` | `create_draft` | **`create_draft(width, height) -> draft_url`** | ✓ |
| `POST /save_draft` | `save_draft` / `_async` | **`save_draft` / `save_draft_async`** | ✓ |
| `GET /get_draft` | `get_draft` | TODO | ✓ |
| `POST /add_videos` | `add_videos` / `_async` | **`add_videos` / `add_videos_async`** | ✓ |
| `POST /add_images` | `add_images` / `_async` | TODO | ✓ |
| `POST /add_audios` | `add_audios` / `_async` | TODO | ✓ |
| `POST /add_captions` | `add_captions` / `_async` | TODO | ✓ |
| `POST /add_effects` | `add_effects` / `_async` | TODO | ✓ |
| `POST /add_filters` | `add_filters` / `_async` | TODO | ✓ |
| `POST /add_keyframes` | `add_keyframes` / `_async` | TODO | ✓ |
| `POST /add_masks` | `add_masks` / `_async` | TODO | ✓ |
| `POST /add_sticker` | `add_sticker` / `_async` | TODO | ✓ |
| `POST /search_sticker` | `search_sticker` | TODO | ✓ |
| `POST /get_effects` | `get_effects` | TODO | ✓ |
| `POST /get_filters` | `get_filters` | TODO | ✓ |
| `POST /get_text_animations` | `get_text_animations` | TODO | ✓ |
| `POST /get_image_animations` | `get_image_animations` | TODO | ✓ |
| `POST /gen_video` | `gen_video` | **`gen_video(draft_url, apiKey=None) -> message`** | ✓ |
| `POST /gen_video_status` | `gen_video_status` | **`gen_video_status(draft_url) -> dict`** | ✓ |
| `GET /gen_video_active_count` | `get_gen_video_active_count` | **`get_gen_video_active_count()`** | (Mate) |
| `POST /get_audio_duration` | `get_audio_duration` | TODO | ✓ |
| `POST /timelines` | `timelines` | TODO | ✓ |

**Implemented now (representative):** `create_draft`, `save_draft` (+ async), `add_videos` (+ async), `gen_video`, `gen_video_status`, `get_gen_video_active_count`.

---

## 3. Usage

```python
from engines.mate import create_draft, save_draft, gen_video

draft_url = create_draft(1080, 1920)
save_draft(draft_url)
# gen_video(draft_url)  # needs export env / JianYing
```

Or:

```python
from engines.mate.facade import create_draft, save_draft_async
```

Run smoke test from `capcut-mate/` root:

```bash
uv run pytest tests/test_mate_facade_smoke.py -q
```

---

## 4. Ranh giới (Phase 1)

| Làm | Không làm |
|-----|-----------|
| `engines/mate/*` + tests facade | Sửa `main.py` / router / schemas (trừ import path bắt buộc) |
| Import lại `src.service` | Xóa / chuyển `src/service/*` |
| Giữ signature service | Đổi contract public HTTP |
| | Sửa `artcraft/` |
