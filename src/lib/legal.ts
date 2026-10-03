/**
 * Данните на фирмата за общите условия, политиката и фактурите. Идват от
 * средата, за да не са зашити в кода: COMPANY_NAME, COMPANY_EIK,
 * COMPANY_ADDRESS, COMPANY_EMAIL, COMPANY_PHONE, COMPANY_VAT (ако е
 * регистрирана по ДДС), COMPANY_MOL (материално отговорно лице).
 */
export function companyInfo() {
  return {
    name: process.env.COMPANY_NAME || "",
    eik: process.env.COMPANY_EIK || "",
    address: process.env.COMPANY_ADDRESS || "",
    email: process.env.COMPANY_EMAIL || "",
    phone: process.env.COMPANY_PHONE || "",
    vat: process.env.COMPANY_VAT || "",
    mol: process.env.COMPANY_MOL || "",
  };
}

export const LEGAL_UPDATED = "28.09.2026";
