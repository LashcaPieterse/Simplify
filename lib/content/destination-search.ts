const CITY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "south-africa": ["Cape Town", "Johannesburg", "Kruger", "SouthAfrica", "RSA"],
  kenya: ["Nairobi", "Mombasa"],
  tanzania: ["Zanzibar", "Dar es Salaam", "Arusha", "Tansania"],
  egypt: ["Cairo", "Egypte"],
  morocco: ["Marrakesh", "Marrakech", "Casablanca", "Maroc"],
  mauritius: ["Mauritious"],
  namibia: ["Namabia"],
  uganda: ["Kampala"],
  ghana: ["Accra"],
  nigeria: ["Lagos", "Abuja"],
  rwanda: ["Kigali"],
  ethiopia: ["Addis Ababa"],
};

export function citySearchTermsForCountry(countrySlug: string): string[] {
  return [...(CITY_ALIASES[countrySlug] ?? [])];
}
