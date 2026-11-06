export type Role = "need" | "life" | "debt";
export type GoalKind = "emergency" | "custom";

export type LineItem = {
  id: string;
  name: string;
  amount: number;
  max: number;
};

export type Category = {
  id: string;
  name: string;
  role: Role;
  tone: number;
  items: LineItem[];
};

export type Contribution = {
  goalId: string;
  amount: number;
};

export type Period = {
  id: string;
  start: string;
  end: string;
  income: number;
  categories: Category[];
  status: "open" | "closed";
  setAside: number;
  contributions: Contribution[];
  closedAt?: string;
};

export type Goal = {
  id: string;
  name: string;
  target: number;
  saved: number;
  kind: GoalKind;
};

export type Data = {
  periods: Period[];
  goals: Goal[];
  freeSavings: number;
  theme: "dark" | "light";
  introDismissed: boolean;
};

export type Insight = {
  title: string;
  body: string;
  tone: "good" | "bad" | "neutral";
};

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const MONTHS_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

export const ROLE_LABEL: Record<Role, string> = {
  need: "Necesidad",
  life: "Día a día",
  debt: "Compromiso",
};

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function clampMoney(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100_000_000, Math.round(n)));
}

export function parseMoney(raw: string) {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return 0;
  return clampMoney(Number(digits));
}

export function formatPlain(n: number) {
  return clampMoney(n).toLocaleString("en-US");
}

export function formatMoney(n: number) {
  const v = Math.round(Number.isFinite(n) ? n : 0);
  const abs = Math.abs(v).toLocaleString("en-US");
  return v < 0 ? `−C$${abs}` : `C$${abs}`;
}

export function managuaParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Managua",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function splitISO(value: string) {
  const dateOnly = String(value ?? "").slice(0, 10);
  const [year, month, day] = dateOnly.split("-").map(Number);

  if (!Number.isInteger(year) || !Number.isInteger(month) ||
      !Number.isInteger(day) || month < 1 || month > 12 ||
      day < 1 || day > new Date(year, month, 0).getDate()) {
    throw new Error("Fecha de quincena inválida: " + value);
  }

  return { year, month: month - 1, day };
}

export function quincenaContaining(year: number, monthIndex: number, day: number) {
  if (day <= 15) {
    return {
      start: iso(year, monthIndex + 1, 1),
      end: iso(year, monthIndex + 1, 15),
    };
  }
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return {
    start: iso(year, monthIndex + 1, 16),
    end: iso(year, monthIndex + 1, last),
  };
}

export function currentQuincena() {
  const today = managuaParts();
  return quincenaContaining(today.year, today.month - 1, today.day);
}

export function nextQuincena(endIso: string) {
  const end = splitISO(endIso);
  const next = new Date(end.year, end.month, end.day + 1);
  return quincenaContaining(next.getFullYear(), next.getMonth(), next.getDate());
}

export function daysUntil(endIso: string) {
  const today = managuaParts();
  const end = splitISO(endIso);
  const a = Date.UTC(today.year, today.month - 1, today.day);
  const b = Date.UTC(end.year, end.month, end.day);
  return Math.round((b - a) / 86_400_000);
}

export function formatRange(startIso: string, endIso: string) {
  const start = splitISO(startIso);
  const end = splitISO(endIso);
  if (start.month === end.month && start.year === end.year) {
    return `${start.day}–${end.day} de ${MONTHS[start.month]}`;
  }
  return `${start.day} ${MONTHS_SHORT[start.month]} – ${end.day} ${MONTHS_SHORT[end.month]}`;
}

export function formatShort(startIso: string, endIso: string) {
  const start = splitISO(startIso);
  const end = splitISO(endIso);
  if (start.month === end.month) return `${start.day}–${end.day} ${MONTHS_SHORT[start.month]}`;
  return `${start.day} ${MONTHS_SHORT[start.month]}`;
}

export function daysLabel(days: number) {
  if (days > 1) return `quedan ${days} días`;
  if (days === 1) return "queda 1 día";
  if (days === 0) return "cierra hoy";
  return "el calendario ya pasó";
}

export function categoryTotal(category: Category) {
  return category.items.reduce((sum, item) => sum + item.amount, 0);
}

export function periodExpenses(period: Period) {
  // Solo sumamos los rubros que sean gastos (need), no los ahorros (life) ni deudas (debt)
  return period.categories
    .filter((category) => category.role === 'need')
    .reduce((sum, category) => sum + categoryTotal(category), 0);
}

export function periodSurplus(period: Period) {
  return period.income - periodExpenses(period);
}

export function savingsRate(period: Period) {
  if (period.income <= 0) return 0;
  return periodSurplus(period) / period.income;
}

export function rateTone(rate: number): "good" | "bad" | "neutral" {
  const pct = Math.round(rate * 100);
  if (pct >= 20) return "good";
  if (pct < 0) return "bad";
  return "neutral";
}

export function ratePhrase(rate: number) {
  const tone = rateTone(rate);
  if (tone === "good") return "Buen margen";
  if (tone === "bad") return "Quincena en rojo";
  return "Margen justo";
}

export function openPeriod(data: Pick<Data, "periods">) {
  return data.periods.find((period) => period.status === "open");
}

export function sortedPeriods(periods: Period[]) {
  return [...periods].sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0));
}

export function previousClosed(periods: Period[]) {
  return sortedPeriods(periods).find((period) => period.status === "closed");
}

export function roleAmount(period: Period, role: Role) {
  return period.categories
    .filter((category) => category.role === role)
    .reduce((sum, category) => sum + categoryTotal(category), 0);
}

export function monthExpenseEstimate(period: Period, periods: Period[]) {
  const start = splitISO(period.start);
  const siblings = periods.filter((item) => {
    const other = splitISO(item.start);
    return other.year === start.year && other.month === start.month;
  });
  if (siblings.length >= 2) {
    return siblings.reduce((sum, item) => sum + periodExpenses(item), 0);
  }
  return periodExpenses(period) * 2;
}

export function suggestAllocation(aside: number, goals: Goal[]) {
  let left = clampMoney(aside);
  const ordered = [...goals].sort((a, b) => {
    if (a.kind === b.kind) return 0;
    return a.kind === "emergency" ? -1 : 1;
  });
  const contributions: Contribution[] = [];
  for (const goal of ordered) {
    const room = Math.max(0, goal.target - goal.saved);
    const amount = Math.min(left, room);
    if (amount > 0) contributions.push({ goalId: goal.id, amount });
    left -= amount;
    if (left <= 0) break;
  }
  return contributions;
}

export function normalizePlan(
  aside: number,
  contributions: Contribution[],
  surplus: number,
  goalIds: Set<string>,
) {
  const cap = Math.max(0, clampMoney(surplus));
  const nextAside = Math.min(clampMoney(aside), cap);
  const cleaned = contributions
    .filter((item) => goalIds.has(item.goalId))
    .map((item) => ({ goalId: item.goalId, amount: clampMoney(item.amount) }))
    .filter((item) => item.amount > 0);
  const sum = cleaned.reduce((total, item) => total + item.amount, 0);
  if (sum <= nextAside) return { setAside: nextAside, contributions: cleaned };
  if (sum <= 0 || nextAside <= 0) return { setAside: nextAside, contributions: [] };
  let left = nextAside;
  const scaled = cleaned
    .map((item, index) => {
      if (index === cleaned.length - 1) return { ...item, amount: Math.max(0, left) };
      const amount = Math.floor((item.amount / sum) * nextAside);
      left -= amount;
      return { ...item, amount };
    })
    .filter((item) => item.amount > 0);
  return { setAside: nextAside, contributions: scaled };
}

export function cloneCategories(categories: Category[]): Category[] {
  return categories.map((category) => ({
    ...category,
    id: uid("cat"),
    items: category.items.map((item) => ({ ...item, id: uid("item") })),
  }));
}

export function biggestCategory(period: Period) {
  let best: { category: Category; total: number } | null = null;
  for (const category of period.categories) {
    const total = categoryTotal(category);
    if (!best || total > best.total) best = { category, total };
  }
  return best && best.total > 0 ? best : null;
}

export function buildInsights(period: Period, periods: Period[], goals: Goal[]): Insight[] {
  const income = period.income;
  const expenses = periodExpenses(period);
  const surplus = income - expenses;
  const rate = income > 0 ? surplus / income : 0;
  const pct = Math.round(rate * 100);
  const insights: Insight[] = [];

  if (income <= 0) {
    insights.push({
      tone: "neutral",
      title: "Falta el ingreso",
      body: "Cargá el neto de esta quincena para ver cuánto podés apartar de verdad.",
    });
  } else if (pct >= 20) {
    insights.push({
      tone: "good",
      title: `${pct}% libre`,
      body: `Te quedan ${formatMoney(surplus)}. Por encima del 20% ya hay margen para apartar sin ahogarte.`,
    });
  } else if (pct >= 0) {
    insights.push({
      tone: "neutral",
      title: "Margen justo",
      body: `Solo queda el ${pct}% (${formatMoney(surplus)}). Un recorte chico en lo día a día cambia la quincena.`,
    });
  } else {
    insights.push({
      tone: "bad",
      title: "Esta quincena no alcanza",
      body: `Los gastos superan el ingreso por ${formatMoney(Math.abs(surplus))}. Bajá un rubro antes de cerrar.`,
    });
  }

  const biggest = biggestCategory(period);
  if (biggest && expenses > 0) {
    const share = Math.round((biggest.total / expenses) * 100);
    insights.push({
      tone: "neutral",
      title: biggest.category.name,
      body: `Se lleva el ${share}% de las salidas (${formatMoney(biggest.total)}). Si baja, el ahorro sube peso por peso.`,
    });
  }

  if (income > 0 && surplus > 0) {
    insights.push({
      tone: "good",
      title: "Si lo sostenés un año",
      body: `Apartar este margen cada quincena suma ${formatMoney(surplus * 24)} en 24 pagos.`,
    });
  }

  const month = monthExpenseEstimate(period, periods);
  const emergency = goals.filter((goal) => goal.kind === "emergency");
  const emergencySaved = emergency.reduce((sum, goal) => sum + goal.saved, 0);
  if (month > 0) {
    const days = Math.floor(emergencySaved / (month / 30));
    if (emergency.length === 0) {
      insights.push({
        tone: "neutral",
        title: "Sin fondo de emergencia",
        body: `Un mes de gastos, a este ritmo, ronda ${formatMoney(month)}. Creá esa meta y llenala primero.`,
      });
    } else if (days < 30) {
      insights.push({
        tone: "neutral",
        title: `El fondo cubre ${days} día${days === 1 ? "" : "s"}`,
        body: `La referencia de un mes son ${formatMoney(month)}. Cada quincena que apartás acorta esa distancia.`,
      });
    } else {
      insights.push({
        tone: "good",
        title: "Emergencia cubierta",
        body: `Tu fondo aguanta unos ${days} días de gastos. Lo que sobre puede ir a otra meta.`,
      });
    }
  }

  return insights.slice(0, 4);
}

const SEED_HOME = 2000;
const SEED_TRANSPORT = 400;
const SEED_PHONE = 180;
const SEED_DEBT = 500;
const SEED_EXPENSES = SEED_HOME + SEED_TRANSPORT + SEED_PHONE + SEED_DEBT;

export function createSeed(): Data {
  const range = currentQuincena();
  return {
    theme: "dark",
    introDismissed: false,
    freeSavings: 0,
    goals: [
      {
        id: "goal_emergencia",
        name: "Fondo de emergencia",
        target: SEED_EXPENSES * 2,
        saved: 0,
        kind: "emergency",
      },
    ],
    periods: [
      {
        id: "per_actual",
        start: range.start,
        end: range.end,
        income: 6278,
        status: "open",
        setAside: 0,
        contributions: [],
        categories: [
          {
            id: "cat_ops",
            name: "Gastos operativos",
            role: "need",
            tone: 0,
            items: [
              { id: "item_hogar", name: "Gastos del hogar", amount: SEED_HOME, max: 5000 },
              { id: "item_transporte", name: "Transporte y movilidad", amount: SEED_TRANSPORT, max: 2000 },
              { id: "item_claro", name: "Recarga móvil Claro", amount: SEED_PHONE, max: 800 },
            ],
          },
          {
            id: "cat_comp",
            name: "Compromisos",
            role: "debt",
            tone: 1,
            items: [{ id: "item_abono", name: "Abono quincenal", amount: SEED_DEBT, max: 2500 }],
          },
        ],
      },
    ],
  };
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readMoney(value: unknown) {
  if (typeof value === "number") return clampMoney(value);
  if (typeof value === "string") return parseMoney(value);
  return 0;
}

function readText(value: unknown, fallback: string, max: number) {
  if (typeof value !== "string") return fallback;
  const text = value.trim().slice(0, max);
  return text || fallback;
}

export function sanitizeData(raw: unknown): Data | null {
  const root = asRecord(raw);
  if (!root) return null;
  const source = asRecord(root.state) ?? root;
  if (!Array.isArray(source.periods)) return null;

  const periods: Period[] = [];
  for (const entry of source.periods) {
    const row = asRecord(entry);
    if (!row) continue;
    const start = typeof row.start === "string" ? row.start : "";
    const end = typeof row.end === "string" ? row.end : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) continue;
    const categories: Category[] = [];
    if (Array.isArray(row.categories)) {
      row.categories.forEach((categoryEntry, index) => {
        const category = asRecord(categoryEntry);
        if (!category) return;
        const role: Role =
          category.role === "life" || category.role === "debt" || category.role === "need"
            ? category.role
            : "need";
        const items: LineItem[] = [];
        if (Array.isArray(category.items)) {
          for (const itemEntry of category.items) {
            const item = asRecord(itemEntry);
            if (!item) continue;
            const amount = readMoney(item.amount);
            const max = Math.max(readMoney(item.max), amount, 100);
            items.push({
              id: readText(item.id, uid("item"), 40),
              name: readText(item.name, "Gasto", 40),
              amount,
              max,
            });
          }
        }
        categories.push({
          id: readText(category.id, uid("cat"), 40),
          name: readText(category.name, "Rubro", 40),
          role,
          tone: Number.isInteger(category.tone) ? Number(category.tone) % 6 : index % 6,
          items,
        });
      });
    }
    const contributions: Contribution[] = [];
    if (Array.isArray(row.contributions)) {
      for (const contributionEntry of row.contributions) {
        const contribution = asRecord(contributionEntry);
        if (!contribution || typeof contribution.goalId !== "string") continue;
        const amount = readMoney(contribution.amount);
        if (amount > 0) contributions.push({ goalId: contribution.goalId, amount });
      }
    }
    periods.push({
      id: readText(row.id, uid("per"), 40),
      start,
      end,
      income: readMoney(row.income),
      categories,
      status: row.status === "closed" ? "closed" : "open",
      setAside: readMoney(row.setAside),
      contributions,
      closedAt: typeof row.closedAt === "string" ? row.closedAt : undefined,
    });
  }
  if (periods.length === 0) return null;
  const open = periods.filter((period) => period.status === "open");
  if (open.length > 1) {
    const newest = [...open].sort((a, b) => (a.start < b.start ? 1 : -1))[0];
    for (const period of periods) {
      if (period.status === "open" && period.id !== newest.id) period.status = "closed";
    }
  }

  const goals: Goal[] = [];
  if (Array.isArray(source.goals)) {
    for (const entry of source.goals) {
      const goal = asRecord(entry);
      if (!goal) continue;
      goals.push({
        id: readText(goal.id, uid("goal"), 40),
        name: readText(goal.name, "Meta", 48),
        target: Math.max(1, readMoney(goal.target)),
        saved: readMoney(goal.saved),
        kind: goal.kind === "emergency" ? "emergency" : "custom",
      });
    }
  }

  return {
    periods,
    goals,
    freeSavings: readMoney(source.freeSavings),
    theme: source.theme === "light" ? "light" : "dark",
    introDismissed: source.introDismissed === true,
  };
}
