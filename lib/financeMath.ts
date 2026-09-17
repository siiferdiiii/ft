/**
 * Pure financial math calculation utilities for compound investment & sustainability projections.
 */

export interface CompoundProjectionPoint {
  year: number;
  savedOnly: number;
  invested: number;
}

/**
 * Calculates 25-year compound growth comparing cash savings vs investment returns.
 */
export function calculateCompoundProjection(
  monthlyAmount: number,
  annualReturn: number,
  years = 25
): CompoundProjectionPoint[] {
  const monthlyRate = annualReturn / 100 / 12;
  const data: CompoundProjectionPoint[] = [];

  for (let y = 0; y <= years; y++) {
    const months = y * 12;
    const savedOnly = months * monthlyAmount;
    let invested = savedOnly;

    if (monthlyRate > 0 && months > 0) {
      invested = Math.round(
        monthlyAmount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
      );
    }

    data.push({
      year: y,
      savedOnly,
      invested,
    });
  }

  return data;
}

export interface SustainabilitySimulationResult {
  history: Array<{ year: number; balance: number }>;
  depletedYear: number | null;
  status: "green" | "yellow" | "red";
  statusLabel: string;
  statusDetail: string;
  annualGain: number;
}

/**
 * Calculates 50-year portfolio longevity and safety margin based on withdrawal percentage.
 */
export function calculateSustainabilitySimulation(
  activePrincipal: number,
  compoundReturn: number,
  annualWithdrawal: number,
  formatCurrencyFn: (amount: number) => string
): SustainabilitySimulationResult {
  const rate = compoundReturn / 100;
  const annualGain = activePrincipal * rate;
  let balance = activePrincipal;
  const history: Array<{ year: number; balance: number }> = [{ year: 0, balance: activePrincipal }];
  let depletedYear: number | null = null;

  for (let y = 1; y <= 50; y++) {
    if (balance <= 0) {
      if (depletedYear === null) depletedYear = y - 1;
      balance = 0;
    } else {
      const gain = balance * rate;
      balance = balance + gain - annualWithdrawal;
      if (balance <= 0) {
        if (depletedYear === null) depletedYear = y;
        balance = 0;
      }
    }
    history.push({ year: y, balance: Math.max(0, Math.round(balance)) });
  }

  let status: "green" | "yellow" | "red";
  let statusLabel: string;
  let statusDetail: string;

  if (activePrincipal <= 0) {
    status = "red";
    statusLabel = "Pokok Dana Rp0";
    statusDetail = "Tingkatkan alokasi bulanan untuk membangun pokok dana abadi yang cukup.";
  } else if (annualWithdrawal <= 0.7 * annualGain) {
    status = "green";
    statusLabel = "Bertahan Selamanya, Margin Aman";
    statusDetail = `Penarikan tahunan (${formatCurrencyFn(annualWithdrawal)}) ≤ 70% dari return tahunan (${formatCurrencyFn(annualGain)}). Pokok dana abadi tetap utuh dan terus bertumbuh melampaui inflasi.`;
  } else if (annualWithdrawal <= 1.0 * annualGain) {
    status = "yellow";
    statusLabel = "Bertahan, Margin Ketat";
    statusDetail = `Penarikan tahunan (${formatCurrencyFn(annualWithdrawal)}) mendekati return tahunan (${formatCurrencyFn(annualGain)}). Pokok dana terjaga namun rentan terhadap fluktuasi pasar atau inflasi tinggi.`;
  } else {
    status = "red";
    statusLabel = depletedYear ? `Dana Habis di Tahun ke-${depletedYear}` : "Dana Habis Sebelum 50 Tahun";
    statusDetail = `Penarikan tahunan (${formatCurrencyFn(annualWithdrawal)}) melampaui return tahunan (${formatCurrencyFn(annualGain)}), menggerus pokok dana pokok secara bertahap.`;
  }

  return {
    history,
    depletedYear,
    status,
    statusLabel,
    statusDetail,
    annualGain,
  };
}
