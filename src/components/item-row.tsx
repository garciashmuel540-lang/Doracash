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
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{name}</span>
        <div className="flex items-center gap-1">
          <select
            value={role}
            onChange={(e) => onRoleChange(e.target.value as Role)}
            className="text-xs bg-surface-2 rounded p-1 border-none outline-none text-muted"
          >
            <option value="need">Gasto</option>
            <option value="life">Ahorro</option>
            <option value="debt">Deuda</option>
          </select>
          <Trash2 className="size-4 text-muted cursor-pointer" onClick={onRemove} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={max || 5000}
          value={amount}
          onChange={(e) => onAmount(Number(e.target.value))}
          className="flex-1 accent-gold"
        />
        <div className="w-28">
          <MoneyField label={`Monto de ${name}`} value={amount} onChange={onAmount} />
        </div>
      </div>
    </li>
  );
}
