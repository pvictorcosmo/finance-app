/**
 * Feature switches. A disabled feature is hidden from the UI only: its data stays
 * stored (and synced), so turning it back on loses nothing.
 */
export const FEATURES = {
  /** Debtors: loans and monthly agreements ("Devedores"). Hidden while the user rethinks it. */
  receivables: false,
} as const;
