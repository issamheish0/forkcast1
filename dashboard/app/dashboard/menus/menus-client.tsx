"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  FileText,
  Image as ImageIcon,
  List,
  Upload,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  ExternalLink,
  GripVertical,
  PencilLine,
} from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Menu, MenuItem, MenuType } from "@/lib/types";

type MenuWithItems = Menu & { menu_items: MenuItem[] };

const TYPE_ICONS: Record<MenuType, React.ReactNode> = {
  pdf: <FileText className="h-4 w-4" />,
  image: <ImageIcon className="h-4 w-4" />,
  manual: <List className="h-4 w-4" />,
};

const TYPE_LABELS: Record<MenuType, string> = {
  pdf: "PDF",
  image: "Image",
  manual: "Manual entry",
};

export function MenusClient({
  restaurantId,
  initialMenus,
}: {
  restaurantId: string | null;
  initialMenus: MenuWithItems[];
}) {
  const [menus, setMenus] = useState<MenuWithItems[]>(initialMenus);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("Menu");
  const [newType, setNewType] = useState<MenuType>("manual");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const noRestaurant = !restaurantId;

  const createMenu = async () => {
    if (!restaurantId) {
      toast.error("Set up your restaurant in Settings first");
      return;
    }
    const supabase = getBrowserSupabase();
    const position = menus.length;
    const { data, error } = await supabase
      .from("menus")
      .insert({ restaurant_id: restaurantId, name: newName.trim() || "Menu", type: newType, position })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    const newMenu: MenuWithItems = { ...(data as Menu), menu_items: [] };
    setMenus([...menus, newMenu]);
    setExpandedId(newMenu.id);
    setAdding(false);
    setNewName("Menu");
    setNewType("manual");
    toast.success("Menu created");
  };

  const deleteMenu = async (id: string) => {
    const supabase = getBrowserSupabase();
    const { error } = await supabase.from("menus").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setMenus(menus.filter((m) => m.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const updateMenuUrl = (id: string, url: string) => {
    setMenus(menus.map((m) => (m.id === id ? { ...m, url } : m)));
  };

  const updateMenuItems = (id: string, items: MenuItem[]) => {
    setMenus(menus.map((m) => (m.id === id ? { ...m, menu_items: items } : m)));
  };

  const renameMenu = async (id: string, name: string) => {
    const supabase = getBrowserSupabase();
    const { error } = await supabase.from("menus").update({ name }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setMenus(menus.map((m) => (m.id === id ? { ...m, name } : m)));
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Menus</h1>
          <p className="mt-1 text-muted-foreground">
            Add PDF menus, image menus, or type your items manually.
          </p>
        </div>
        {!noRestaurant && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add menu
          </button>
        )}
      </div>

      {noRestaurant && (
        <div className="mt-8 rounded-xl border border-border bg-secondary/40 p-8 text-center">
          <p className="text-muted-foreground">Set up your restaurant in <strong>Settings</strong> before adding menus.</p>
        </div>
      )}

      {/* Add menu dialog */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-semibold">New Menu</h2>
            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium">Menu name</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                placeholder="e.g. Dinner menu, Drinks…"
              />
            </label>
            <label className="mb-5 block">
              <span className="mb-1 block text-sm font-medium">Type</span>
              <div className="grid grid-cols-3 gap-2">
                {(["manual", "image", "pdf"] as MenuType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewType(t)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors ${
                      newType === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {TYPE_ICONS[t]}
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setAdding(false)}
                className="flex-1 rounded-lg border border-border py-2.5 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={createMenu}
                className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu list */}
      <div className="mt-6 flex max-w-3xl flex-col gap-3">
        {menus.length === 0 && !noRestaurant && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No menus yet. Click <strong>Add menu</strong> to get started.
          </div>
        )}

        {menus.map((menu) => (
          <MenuCard
            key={menu.id}
            menu={menu}
            expanded={expandedId === menu.id}
            onToggle={() => setExpandedId(expandedId === menu.id ? null : menu.id)}
            onDelete={() => deleteMenu(menu.id)}
            onUrlChange={(url) => updateMenuUrl(menu.id, url)}
            onItemsChange={(items) => updateMenuItems(menu.id, items)}
            onRename={(name) => renameMenu(menu.id, name)}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────────── MenuCard ─────────────── */

function MenuCard({
  menu,
  expanded,
  onToggle,
  onDelete,
  onUrlChange,
  onItemsChange,
  onRename,
}: {
  menu: MenuWithItems;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onUrlChange: (url: string) => void;
  onItemsChange: (items: MenuItem[]) => void;
  onRename: (name: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(menu.name);

  const commitName = () => {
    setEditingName(false);
    if (nameVal.trim() && nameVal !== menu.name) onRename(nameVal.trim());
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-muted-foreground">{TYPE_ICONS[menu.type]}</span>

        {editingName ? (
          <input
            autoFocus
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === "Enter" && commitName()}
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm font-semibold"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="group flex flex-1 items-center gap-1.5 text-left text-sm font-semibold"
          >
            {menu.name}
            <PencilLine className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50" />
          </button>
        )}

        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {TYPE_LABELS[menu.type]}
        </span>
        <button
          onClick={onDelete}
          className="ml-1 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button onClick={onToggle} className="rounded p-1.5 hover:bg-muted">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="border-t border-border px-4 py-4">
          {(menu.type === "pdf" || menu.type === "image") && (
            <FileMenuEditor menu={menu} onUrlChange={onUrlChange} />
          )}
          {menu.type === "manual" && (
            <ManualMenuEditor menu={menu} onItemsChange={onItemsChange} />
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────── File (PDF / Image) editor ─────────────── */

function FileMenuEditor({
  menu,
  onUrlChange,
}: {
  menu: MenuWithItems;
  onUrlChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [urlMode, setUrlMode] = useState(!menu.url);
  const [urlInput, setUrlInput] = useState(menu.url ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const accept = menu.type === "pdf" ? "application/pdf" : "image/*";

  const handleFile = async (file: File) => {
    const maxMb = menu.type === "pdf" ? 20 : 5;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`File must be under ${maxMb} MB`);
      return;
    }
    setUploading(true);
    const supabase = getBrowserSupabase();
    const ext = file.name.split(".").pop();
    const path = `${menu.restaurant_id}/${menu.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("restaurant-menus")
      .upload(path, file, { cacheControl: "3600", upsert: true });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("restaurant-menus").getPublicUrl(path);
    // Persist url to DB
    const { error: dbErr } = await supabase
      .from("menus")
      .update({ url: data.publicUrl })
      .eq("id", menu.id);
    if (dbErr) { toast.error(dbErr.message); setUploading(false); return; }
    onUrlChange(data.publicUrl);
    setUrlInput(data.publicUrl);
    toast.success("Uploaded");
    setUploading(false);
  };

  const saveUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    const supabase = getBrowserSupabase();
    const { error } = await supabase.from("menus").update({ url }).eq("id", menu.id);
    if (error) { toast.error(error.message); return; }
    onUrlChange(url);
    toast.success("URL saved");
  };

  return (
    <div className="space-y-3">
      {/* Current file preview */}
      {menu.url && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-3">
          {menu.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={menu.url} alt="menu" className="h-20 w-28 rounded object-cover" />
          ) : (
            <FileText className="h-10 w-10 text-muted-foreground" />
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm text-foreground">{menu.url.split("/").pop()}</p>
            <a
              href={menu.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Open <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <button
            onClick={() => { onUrlChange(""); setUrlInput(""); }}
            className="rounded p-1 hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tab toggle */}
      <div className="flex rounded-lg border border-border overflow-hidden text-sm">
        <button
          type="button"
          onClick={() => setUrlMode(false)}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2 ${!urlMode ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          <Upload className="h-3.5 w-3.5" /> Upload {menu.type === "pdf" ? "PDF" : "Image"}
        </button>
        <button
          type="button"
          onClick={() => setUrlMode(true)}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2 ${urlMode ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          <ExternalLink className="h-3.5 w-3.5" /> Enter URL
        </button>
      </div>

      {urlMode ? (
        <div className="flex gap-2">
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={`https://example.com/menu.${menu.type === "pdf" ? "pdf" : "jpg"}`}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={saveUrl}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Save
          </button>
        </div>
      ) : (
        <>
          <input ref={fileRef} type="file" accept={accept} className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-6 text-sm text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> :
              <><Upload className="h-4 w-4" /> Click to select {menu.type === "pdf" ? "PDF (max 20 MB)" : "image (max 5 MB)"}</>}
          </button>
        </>
      )}
    </div>
  );
}

/* ─────────────── Manual menu editor ─────────────── */

function ManualMenuEditor({
  menu,
  onItemsChange,
}: {
  menu: MenuWithItems;
  onItemsChange: (items: MenuItem[]) => void;
}) {
  const [items, setItems] = useState<MenuItem[]>(
    [...menu.menu_items].sort((a, b) => a.position - b.position),
  );
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", price: "", category: "" });
  const [saving, setSaving] = useState(false);

  // Group by category
  const grouped = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const cat = item.category ?? "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const addItem = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const supabase = getBrowserSupabase();
    const { data, error } = await supabase
      .from("menu_items")
      .insert({
        menu_id: menu.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: form.price ? parseFloat(form.price) : null,
        category: form.category.trim() || null,
        position: items.length,
      })
      .select()
      .single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    const updated = [...items, data as MenuItem];
    setItems(updated);
    onItemsChange(updated);
    setForm({ name: "", description: "", price: "", category: "" });
    setAdding(false);
    toast.success("Item added");
  };

  const removeItem = async (id: string) => {
    const supabase = getBrowserSupabase();
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    const updated = items.filter((i) => i.id !== id);
    setItems(updated);
    onItemsChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Items grouped by category */}
      {Object.keys(grouped).length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          No items yet. Add your first item below.
        </p>
      )}

      {Object.entries(grouped).map(([cat, catItems]) => (
        <div key={cat}>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {cat}
          </h4>
          <div className="divide-y divide-border rounded-lg border border-border">
            {catItems.map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-3 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">{item.name}</span>
                    {item.price !== null && (
                      <span className="text-sm text-primary font-semibold">
                        ${Number(item.price).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                  )}
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Add item form */}
      {adding ? (
        <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Item name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="col-span-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              placeholder="Category (e.g. Starters)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              placeholder="Price (e.g. 12.50)"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="col-span-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setAdding(false)}
              className="flex-1 rounded-lg border border-border py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={addItem}
              disabled={saving}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add item"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Plus className="h-4 w-4" /> Add item
        </button>
      )}
    </div>
  );
}
