/**
 * Данните на фирмата за общите условия, политиката и фактурите. Идват от
 * средата, за да не са зашити в кода: COMPANY_NAME, COMPANY_EIK,
 * COMPANY_ADDRESS, COMPANY_EMAIL, COMPANY_PHONE.
 */
export function companyInfo() {
  return {
    name: process.env.COMPANY_NAME || "",
    eik: process.env.COMPANY_EIK || "",
    address: process.env.COMPANY_ADDRESS || "",
    email: process.env.COMPANY_EMAIL || "",
    phone: process.env.COMPANY_PHONE || "",
  };
}

export const LEGAL_UPDATED = "28.09.2026";
