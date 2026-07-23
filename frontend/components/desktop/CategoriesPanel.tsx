"use client";

import type { Category } from "@/types";

export default function CategoriesPanel({
  categories,
  selected,
  onChange,
}: {
  categories: Category[];
  selected: string[];
  onChange: (slugs: string[]) => void;
}) {
  const toggle = (slug: string) => {
    onChange(selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug]);
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <p className="text-xs opacity-70">
        Отметьте категории, чтобы отфильтровать метки на карте. Список прокручивается —
        можно добавлять сколько угодно категорий.
      </p>

      <div className="flex-1 space-y-1 overflow-auto pr-1">
        {categories.map((cat) => (
          <label
            key={cat.id}
            className="flex cursor-pointer items-center gap-2 rounded border border-[#0b3d91]/20 bg-white px-2 py-1.5 text-sm hover:bg-[#e7f0ff]"
          >
            <input type="checkbox" checked={selected.includes(cat.slug)} onChange={() => toggle(cat.slug)} />
            {cat.name}
          </label>
        ))}
        {categories.length === 0 && <p className="text-xs opacity-50">Категории не загружены</p>}
      </div>

      {selected.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="self-start border border-[#0b3d91] bg-white px-2 py-1 text-xs hover:bg-[#e7f0ff]"
        >
          Сбросить фильтр ({selected.length})
        </button>
      )}
    </div>
  );
}
