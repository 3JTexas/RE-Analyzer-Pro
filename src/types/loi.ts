export interface LOIData {
  // Auto-populated from DB
  propertyName: string
  propertyAddress: string
  units: string
  purchasePrice: string

  // User defaults (pre-filled, editable)
  purchaserName: string
  purchaserCounsel: string
  loanAmountMin: string
  loanApprovalDays: string
  closingDays: string
  loiExpirationDays: string

  // Must prompt (deal-specific)
  date: string
  recipientNames: string
  sellerName: string
  earnestDeposit: string
  ddPeriodDays: string
  ddDeliveryDays: string

  // Template selection
  template: 'original' | 'buyer-friendly'
}
