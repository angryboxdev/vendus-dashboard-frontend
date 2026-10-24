import type { CostCenterGroup, CostCenterCategory } from "../../../financial-base/domain/entities/cost-center.ts";

interface CostCenterCascadeSelectProps {
  groups: CostCenterGroup[];
  categories: CostCenterCategory[];
  groupId: string | null;
  categoryId: string | null;
  onChange(groupId: string | null, categoryId: string | null): void;
  inputCls: string;
}

/** Grupo CC → subcategoria (a subcategoria escolhida preenche o grupo). */
export function CostCenterCascadeSelect({
  groups,
  categories,
  groupId,
  categoryId,
  onChange,
  inputCls,
}: CostCenterCascadeSelectProps) {
  const activeGroups = groups.filter((g) => g.isActive);
  const filteredCats = categories.filter(
    (c) => c.isActive && (groupId === null || c.groupId === groupId),
  );

  function handleGroupChange(newGroupId: string) {
    const gId = newGroupId || null;
    // clear category if it no longer belongs to the new group
    const currentCat = categories.find((c) => c.id === categoryId);
    const catStillValid = currentCat && (gId === null || currentCat.groupId === gId);
    onChange(gId, catStillValid ? categoryId : null);
  }

  function handleCategoryChange(newCatId: string) {
    const cId = newCatId || null;
    if (cId) {
      const cat = categories.find((c) => c.id === cId);
      // auto-populate group when category is selected
      onChange(cat?.groupId ?? groupId, cId);
    } else {
      onChange(groupId, null);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <select
        value={groupId ?? ""}
        onChange={(e) => handleGroupChange(e.target.value)}
        className={inputCls}
        aria-label="Categoria"
      >
        <option value="">— Categoria —</option>
        {activeGroups.map((g) => (
          <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
        ))}
      </select>
      <select
        value={categoryId ?? ""}
        onChange={(e) => handleCategoryChange(e.target.value)}
        className={inputCls}
        aria-label="Subcategoria"
      >
        <option value="">— Subcategoria —</option>
        {filteredCats.map((c) => (
          <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
        ))}
      </select>
    </div>
  );
}
