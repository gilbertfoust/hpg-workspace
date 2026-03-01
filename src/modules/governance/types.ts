export interface FXRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
}

export interface CountryComplianceProfile {
  id: string;
  country_code: string;
  country_name: string;
  requirements: string[];
}

export interface LocalizedCOAMapping {
  id: string;
  country_code: string;
  local_account_code: string;
  standard_account_id: string;
}
