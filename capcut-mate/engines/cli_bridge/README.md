# engines/cli_bridge

**Grok C — Phase 2** subprocess bridge: BE Python gọi [capcut-cli](../../../capcut-cli/) qua `subprocess`, không expose HTTP.

Ranh giới: chỉ module này (+ unit test mock). Router public / ArtCraft / full ~70 lệnh CLI → phase sau.

## Yêu cầu máy (runtime)

| Thành phần | Ghi chú |
|------------|---------|
| **Node.js** | ≥ 18 khuyến nghị (`node -v`) |
| **capcut-cli** | binary `capcut` trên PATH, hoặc path / `npx` qua env |
| **Python** | capcut-mate (đã có), không thêm dependency pip cho bridge |

### Cài capcut-cli

```bash
# global (binary: capcut)
npm install -g capcut-cli

# hoặc local trong monorepo
cd capcut-cli && npm install && npm run build
# rồi set CAPCUT_CLI_BIN=node <abs>/capcut-cli/dist/index.js
# hoặc: npx --yes capcut-cli …
```

Kiểm tra:

```bash
capcut doctor
# hoặc
npx capcut-cli doctor
```

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `CAPCUT_CLI_BIN` | `capcut` | Command/path gọi CLI. Multi-word OK: `npx --yes capcut-cli` |
| `CAPCUT_CLI_TIMEOUT_S` | `60` | Timeout mặc định (giây) |

Ví dụ Windows PowerShell:

```powershell
$env:CAPCUT_CLI_BIN = "capcut"
# hoặc
$env:CAPCUT_CLI_BIN = "npx --yes capcut-cli"
# hoặc full path
$env:CAPCUT_CLI_BIN = "C:\Users\me\AppData\Roaming\npm\capcut.cmd"
```

## API Python

```python
from engines.cli_bridge import (
    run_cmd,
    keyframe,
    list_projects,
    import_srt,
    mask,
    transition,
    CliBinaryNotFoundError,
    CliTimeoutError,
    CliCommandFailedError,
)

# Low-level: args = subcommand + argv (không gồm binary)
result = run_cmd(["projects", "--names"], timeout_s=30)
# result == {"ok": True, "stdout": "...", "stderr": "...", "code": 0, "cmd": [...]}

# Wrappers (stub, chưa HTTP)
keyframe(
    project=r"C:\drafts\my_project",
    segment_id="SEG_ID",
    property="position_x",  # hoặc scale / rotation / alpha / volume / …
    time="0s",
    value=0.0,
)
list_projects(drafts_dir=r"C:\Users\me\AppData\Local\CapCut\User Data\Projects\com.lveditor.draft")
import_srt(project=r"C:\drafts\my_project", srt_path=r"C:\subs\vi.srt")
mask(project=r"C:\drafts\my_project", segment_id="SEG_ID", slug="circle")
transition(project=r"C:\drafts\my_project", segment_id="SEG_ID", slug="dissolve", duration="0.5s")
```

### Lỗi (song ngữ VI / EN)

| Tình huống | Exception |
|------------|-----------|
| Binary không có / PATH sai | `CliBinaryNotFoundError` |
| Vượt timeout | `CliTimeoutError` |
| Exit code ≠ 0 | `CliCommandFailedError` |

`str(exc)` dạng: `"…tiếng Việt… / …English…"`.  
`exc.as_dict(lang="vi"|"en")` sẵn cho map HTTP phase sau.

`run_cmd(..., check=False)` trả `ok=False` thay vì raise khi exit ≠ 0 (vẫn raise nếu missing binary / timeout).

## Ví dụ lệnh CLI tương đương

```bash
capcut keyframe ./my_project <segment_id> position_x 0s 0.0
capcut keyframe ./my_project <segment_id> scale 1s 1.2 --easing ease-in-out
capcut mask ./my_project <segment_id> circle --size 0.5
capcut transition ./my_project <segment_id> dissolve --duration 0.5s
capcut projects --drafts "C:/Users/.../com.lveditor.draft" --names
capcut import-srt ./my_project ./subs.srt
```

Tham chiếu đầy đủ: `capcut-cli/docs/command-reference.md`.

## Test (mock subprocess, không cần Node)

Từ thư mục `capcut-mate/`:

```bash
uv run pytest tests/test_cli_bridge.py -q
# hoặc
python -m pytest tests/test_cli_bridge.py -q
```

## Không làm trong module này

- Public FastAPI routes (`/v1/keyframes`, …)
- Wire ArtCraft UI
- Port pure-Python local engine (Phase 4)
- Implement full ~70 lệnh CLI
