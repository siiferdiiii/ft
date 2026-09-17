/**
 * Centralized budget status calculation and styling according to DESIGN_SYSTEM.md §2 & §6.
 * Thresholds:
 * - green: Sisa budget >80%
 * - yellow: Sisa budget 50–80%
 * - orange: Sisa budget 20–50%
 * - red: Sisa budget <20%
 */

export type BudgetStatusColor = "green" | "yellow" | "orange" | "red" | "neutral";

export interface BudgetStatusResult {
  remainingPercent: number;
  statusColor: BudgetStatusColor;
}

export function calculateBudgetStatus(
  budgetLimit: number | null | undefined,
  currentExpense: number
): BudgetStatusResult {
  if (!budgetLimit || budgetLimit <= 0) {
    return { remainingPercent: 100, statusColor: "neutral" };
  }

  const remaining = Math.max(0, budgetLimit - currentExpense);
  const remainingPercent = Math.round((remaining / budgetLimit) * 100);

  let statusColor: BudgetStatusColor = "neutral";
  if (remainingPercent > 80) statusColor = "green";
  else if (remainingPercent >= 50) statusColor = "yellow";
  else if (remainingPercent >= 20) statusColor = "orange";
  else statusColor = "red";

  return { remainingPercent, statusColor };
}

export function getBudgetStatusBadgeClass(statusColor: BudgetStatusColor = "neutral"): string {
  const colorClasses: Record<BudgetStatusColor, string> = {
    green: "bg-budget-green text-white",
    yellow: "bg-budget-yellow text-text",
    orange: "bg-budget-orange text-white",
    red: "bg-budget-red text-white",
    neutral: "bg-field text-text-secondary",
  };
  return colorClasses[statusColor] || colorClasses.neutral;
}
