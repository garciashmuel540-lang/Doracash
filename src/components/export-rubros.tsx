import { Download } from "lucide-react";
import { categoryPaidAmount, categoryPendingAmount, categoryTotal, type Period } from "@/lib/finance";
import { Button } from "./ui";

export function ExportRubros({ period }: { period: Period }) {
  function download() {
    const rows: (string | number)[][] = [
      ["Inicio", "Fin", "Rubro", "Monto C$", "Pagado C$", "Pendiente C$", "Origen", "Nota"],
      ...period.categories.map(c => [
        period.start.slice(0, 10), period.end.slice(0, 10), c.name, categoryTotal(c),
        categoryPaidAmount(c), categoryPendingAmount(c), c.moneyLocation === "cash" ? "Efectivo" : "Cuenta", c.note ?? "",
      ]),
    ];
    const escape = (value: string | number) => {
      if (typeof value === "number") return String(value);
      const safe = /^[\s]*[=+@-]/.test(value) ? "'" + value : value;
      return '"' + safe.replaceAll('"', '""') + '"';
    };
    const csv = "\uFEFF" + rows.map(row => row.map(escape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "Doracash-rubros-" + period.start.slice(0, 10) + ".csv";
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  return <Button variant="ghost" onClick={download}><Download className="size-4" /> Descargar rubros en CSV</Button>;
}
