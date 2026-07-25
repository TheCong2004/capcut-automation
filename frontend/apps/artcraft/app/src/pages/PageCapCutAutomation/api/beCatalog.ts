/**
 * Load catalogue từ BE thật — không mock library tĩnh.
 */
import * as api from "./capcutBeClient";
import * as local from "./capcutLocalClient";

export type CatalogThumb = {
  id: string;
  name: string;
  thumb: string;
  category?: string;
  favorite?: boolean;
  iconUrl?: string;
};

const GRAD = {
  effect: "linear-gradient(135deg,#4a2a5a,#2a1a3a)",
  filter: "linear-gradient(135deg,#3a2a4a,#1a1a2a)",
  transition: "linear-gradient(135deg,#6366f1,#312e81)",
  animIn: "linear-gradient(135deg,#2d3139,#5a6270)",
  animOut: "linear-gradient(135deg,#3a3f4a,#4a5160)",
  animCombo: "linear-gradient(135deg,#363b45,#484f5c)",
  sfx: "linear-gradient(135deg,#1e3a5f,#0f172a)",
};

/** BE filter/effect meta không có preview image — sinh gradient ổn định theo tên. */
export function thumbFromName(name: string, sat = 42, light = 38): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  const hue2 = (hue + 28 + (h % 40)) % 360;
  return `linear-gradient(135deg,hsl(${hue} ${sat}% ${light}%),hsl(${hue2} ${sat + 8}% ${light - 10}%))`;
}

export async function loadMateEffects(): Promise<CatalogThumb[]> {
  const res = await api.getEffects(0);
  return (res.effects ?? []).map((e, i) => {
    const icon = (e.icon_url || "").trim();
    return {
      id: `fx-${i}-${e.name}`,
      name: e.name,
      thumb: icon ? `url(${icon})` : thumbFromName(e.name, 40, 36),
      category: "video",
      iconUrl: icon || undefined,
    };
  });
}

export async function loadMateFilters(): Promise<CatalogThumb[]> {
  const res = await api.getFilters(0);
  return (res.filters ?? []).map((f, i) => ({
    id: `fl-${i}-${f.name}`,
    name: f.name,
    // get_filters không trả icon_url — chỉ name/resource_id
    thumb: thumbFromName(f.name, 45, 40),
  }));
}

export async function loadLocalEnums(
  category: string,
  limit = 500,
  _thumbFallback = GRAD.transition,
): Promise<CatalogThumb[]> {
  const res = (await local.localEnums({ category, limit })) as {
    items?: Array<{ name?: string; member?: string }>;
  };
  return (res.items ?? [])
    .map((it, i) => {
      const name = String(it.name || it.member || "").trim();
      if (!name) return null;
      return {
        id: `en-${category}-${i}-${name}`,
        name,
        thumb: thumbFromName(name),
      };
    })
    .filter(Boolean) as CatalogThumb[];
}

export async function loadTransitions(): Promise<CatalogThumb[]> {
  // Prefer local enums (CapCut resource names for /transition)
  try {
    const items = await loadLocalEnums("transitions", 800, GRAD.transition);
    if (items.length) return items;
  } catch {
    /* fall through */
  }
  return [];
}

export async function loadAnimations(): Promise<
  Array<CatalogThumb & { category: "in" | "out" | "combo" }>
> {
  const out: Array<CatalogThumb & { category: "in" | "out" | "combo" }> = [];
  const [img, txt] = await Promise.all([
    api.getImageAnimations().catch(() => ({ effects: [] as Array<{ name: string; type?: string }> })),
    api.getTextAnimations().catch(() => ({ effects: [] as Array<{ name: string; type?: string }> })),
  ]);
  const push = (
    list: Array<{ name: string; type?: string }>,
    offset: number,
    fallback: "in" | "out" | "combo",
  ) => {
    list.forEach((e, i) => {
      const t = (e.type || "").toLowerCase();
      const cat: "in" | "out" | "combo" =
        t.includes("out") || t.includes("outro")
          ? "out"
          : t.includes("combo") || t.includes("group")
            ? "combo"
            : t.includes("in") || t.includes("intro")
              ? "in"
              : fallback;
      // get_image/text_animations: icon_url thường rỗng — placeholder theo tên
      out.push({
        id: `anim-${offset + i}-${e.name}`,
        name: e.name,
        category: cat,
        thumb: thumbFromName(
          e.name,
          cat === "in" ? 48 : cat === "out" ? 42 : 40,
          cat === "in" ? 42 : 36,
        ),
      });
    });
  };
  push(img.effects ?? [], 0, "in");
  push(txt.effects ?? [], 10_000, "in");
  // Also try local enums text intros
  try {
    const intros = await loadLocalEnums("text_intros", 200, GRAD.animIn);
    intros.forEach((it, i) => {
      out.push({
        ...it,
        id: `ti-${i}-${it.name}`,
        category: "in",
        thumb: thumbFromName(it.name, 48, 42),
      });
    });
  } catch {
    /* ignore */
  }
  return out;
}

export async function loadSfxCatalog(): Promise<CatalogThumb[]> {
  return loadLocalEnums("sfx", 400, GRAD.sfx);
}
