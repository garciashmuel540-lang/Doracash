import { Trash2 } from "lucide-react";
import { MoneyField } from "@/components/ui";
import type { Role } from "@/lib/finance";

export function ItemRow({
  name, amount, max, onAmount, onName, onRemove, role, onRoleChange
}: {
  name: string;
  amount: number;
  max: number;
  onAmount: (amount: number) => void;
  onName: (name: string) => void;
  onRemove: () => void;
  role: Role;
  onRoleChange: (role: Role) => void;
}) {
  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="min-w-0 flex-1 basis-40 break-words text-sm font-medium">{name}</span>
        <div className="flex shrink-0 items-center gap-2">
          <select
            aria-label={`Tipo de ${name}`}
            value={role}
            onChange={(e) => onRoleChange(e.target.value as Role)}
            className="min-h-11 text-xs bg-surface-2 rounded-xl px-2 border-none outline-none text-muted"
          >
            <option value="need">Gasto</option>
            <option value="life">Ahorro</option>
            <option value="debt">Deuda</option>
          </select>
          <button type="button" aria-label={`Eliminar ${name}`} onClick={onRemove} className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-2"><Trash2 className="size-4" /></button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={max || 5000}
          value={amount}
          onChange={(e) => onAmount(Number(e.target.value))}
          aria-label={`Ajustar monto de ${name}`}
          className="min-w-0 w-full flex-1 accent-gold"
        />
        <div className="w-28 shrink-0">
          <MoneyField label={`Monto de ${name}`} value={amount} onChange={onAmount} />
        </div>
      </div>
    </li>
  );
}
