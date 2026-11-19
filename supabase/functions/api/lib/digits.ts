const AR = '٠١٢٣٤٥٦٧٨٩';
/** Western digits → Arabic-Indic digits (for Arabic server messages). */
export function arDigits(v: number | string): string {
  return String(v).replace(/[0-9]/g, (d) => AR[Number(d)] ?? d);
}
