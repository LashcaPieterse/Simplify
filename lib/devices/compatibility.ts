export type CompatibilityStatus = "compatible" | "not-compatible" | "unknown";

export type CompatibilityResult = {
  status: CompatibilityStatus;
  matchedFamily: string | null;
  note: string;
  settingsPath: string | null;
  sourceUrl: string | null;
};

const APPLE_SOURCE = "https://support.apple.com/en-us/118569";
const APPLE_SE2_SOURCE = "https://support.apple.com/en-us/111882";
const GOOGLE_SOURCE = "https://support.google.com/pixelphone/answer/7086887";
const SAMSUNG_SOURCE = "https://www.samsung.com/us/support/answer/ANS10001619/";
const MOTOROLA_EDGE_50_SOURCE = "https://en-us.support.motorola.com/app/answers/detail/a_id/187373";
const MOTOROLA_RAZR_SOURCE = "https://www.motorola.com/us/en/p/phones/razr/razr-gen-5/pmipmhv41mo";
const HUAWEI_SOURCE = "https://consumer.huawei.com/fr/support/content/fr-fr15789961/";
const XIAOMI_12_SOURCE = "https://www.mi.com/global/support/faq/details/KA-08491/";
const XIAOMI_12T_PRO_SOURCE = "https://www.mi.com/global/support/faq/details/KA-228946/";
const XIAOMI_13T_SOURCE = "https://www.mi.com/es/product/xiaomi-13t-leica/specs/";
const XIAOMI_14_SOURCE = "https://www.mi.com/global/product/xiaomi-14/specs/";
const XIAOMI_14T_PRO_SOURCE = "https://www.mi.com/global/support/faq/details/KA-513112/";
const XIAOMI_15_SOURCE = "https://www.mi.com/global/support/faq/details/KA-541782/";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[–—-]/g, " ").replace(/[^a-z0-9+]+/g, " ").replace(/\s+/g, " ").trim();
}

export function checkDeviceCompatibility(query: string): CompatibilityResult {
  const value = normalize(query);
  if (!value) return { status: "unknown", matchedFamily: null, note: "Enter a phone model to check it.", settingsPath: null, sourceUrl: null };

  if (/\biphone\s+(x|8|8 plus|7|7 plus|6s?|5s?|5c|se 1|se 1st|se first|se 2016)\b/.test(value)) {
    return { status: "not-compatible", matchedFamily: "Apple iPhone", note: "Apple lists this model as physical-SIM only.", settingsPath: null, sourceUrl: APPLE_SOURCE };
  }
  if (/\biphone\s+se\s+(2|2nd|second|2020)\b/.test(value)) {
    return { status: "compatible", matchedFamily: "Apple iPhone", note: "Apple's model-specific technical specification lists the iPhone SE (2nd generation) with nano-SIM and eSIM. eSIM availability can still vary by country, carrier, and device lock status.", settingsPath: "Settings → Cellular / Mobile Data → Add eSIM", sourceUrl: APPLE_SE2_SOURCE };
  }
  if (/\biphone\s+(xs|max xs|xs max|xr|11|12|13|14|15|16|17|air|se 3|se 3rd|se third)\b/.test(value)) {
    return { status: "compatible", matchedFamily: "Apple iPhone", note: "eSIM support can vary by the country or region where the iPhone was purchased. Mainland China and some Hong Kong or Macao variants have special limitations.", settingsPath: "Settings → Cellular / Mobile Data → Add eSIM", sourceUrl: APPLE_SOURCE };
  }

  if (/\bpixel\s+(2016|1)\b/.test(value)) {
    return { status: "not-compatible", matchedFamily: "Google Pixel", note: "Google lists the original Pixel as not supporting eSIM.", settingsPath: null, sourceUrl: GOOGLE_SOURCE };
  }
  if (/\bpixel\s+(2|3|3a)\b/.test(value)) {
    return { status: "unknown", matchedFamily: "Google Pixel", note: "eSIM support on this older Pixel depends on the purchase country and carrier variant. Verify the Add SIM option on the phone.", settingsPath: "Settings → Network & internet → SIMs → Add SIM", sourceUrl: GOOGLE_SOURCE };
  }
  if (/\bpixel\s+(4|5|6|7|8|9|10)(\b|a| pro| xl| fold)/.test(value)) {
    return { status: "compatible", matchedFamily: "Google Pixel", note: "Google lists Pixel 4 and later as eSIM-capable. Carrier and market restrictions can still apply.", settingsPath: "Settings → Network & internet → SIMs → Add SIM", sourceUrl: GOOGLE_SOURCE };
  }

  const supportedGalaxy =
    /\bgalaxy\s+s(20|21|22|23|24|25|26)(?!\s*fe)\b/.test(value) ||
    /\bgalaxy\s+note\s*20\b/.test(value) ||
    /\bgalaxy\s+z\s+(trifold|fold\s*[2-8]|flip\s*(3|4|5|6|7|8)(\s*(fe|5g))?)\b/.test(value) ||
    /\bgalaxy\s+xcover\s*6\s+pro\b/.test(value);
  if (supportedGalaxy) {
    return { status: "compatible", matchedFamily: "Samsung Galaxy", note: "Samsung lists this family with eSIM support, but exact support can vary by model number, market, carrier, and software version.", settingsPath: "Settings → Connections → SIM manager → Add eSIM", sourceUrl: SAMSUNG_SOURCE };
  }
  if (/\bgalaxy\s+a(16|17|25|26|27|35|36|54|55|56|57)\b/.test(value)) {
    return { status: "unknown", matchedFamily: "Samsung Galaxy A", note: "Some regional variants in this family support eSIM and others do not. Check the exact model number and look for Add eSIM in SIM manager.", settingsPath: "Settings → Connections → SIM manager → Add eSIM", sourceUrl: SAMSUNG_SOURCE };
  }

  if (/\b(?:motorola|moto)\s+edge\s+50\b(?!\s*(pro|ultra|neo|fusion))/.test(value)) {
    return { status: "compatible", matchedFamily: "Motorola Edge", note: "Motorola lists the Edge 50 with a physical SIM plus eSIM. Specifications can vary by market, so confirm the exact regional model and carrier-unlock status.", settingsPath: "Settings → Network & internet → SIMs & mobile network → Download new SIM", sourceUrl: MOTOROLA_EDGE_50_SOURCE };
  }
  if (/\b(?:motorola|moto)\s+razr\s+(40|50|60|2023|2024|2025)(\s+(plus|ultra))?\b/.test(value)) {
    return { status: "compatible", matchedFamily: "Motorola Razr", note: "Motorola documents eSIM support for these recent Razr families. Availability can still vary by exact market model and carrier.", settingsPath: "Settings → Network & internet → SIMs & mobile network → Download new SIM", sourceUrl: MOTOROLA_RAZR_SOURCE };
  }

  if (/\bhuawei\s+(p40\s+pro\+?|mate\s+40\s+pro)\b/.test(value)) {
    return { status: "compatible", matchedFamily: "Huawei", note: "Huawei documents eSIM support for the P40 Pro and Mate 40 Pro families, subject to device variant, country, and carrier availability.", settingsPath: "Settings → Mobile network → SIM management", sourceUrl: HUAWEI_SOURCE };
  }

  if (/\bxiaomi\s+12\b/.test(value)) {
    return { status: "not-compatible", matchedFamily: "Xiaomi", note: "Xiaomi's model FAQ lists the Xiaomi 12 as not supporting eSIM.", settingsPath: null, sourceUrl: XIAOMI_12_SOURCE };
  }
  if (/\bxiaomi\s+12t\s+pro\b/.test(value)) {
    return { status: "compatible", matchedFamily: "Xiaomi", note: "Xiaomi lists the 12T Pro as eSIM-capable. Availability can vary by country, carrier, and regional device variant.", settingsPath: "Settings → SIM cards & mobile networks → Use eSIM → Manage eSIM", sourceUrl: XIAOMI_12T_PRO_SOURCE };
  }
  if (/\bxiaomi\s+13t(\s+pro)?\b/.test(value)) {
    return { status: "compatible", matchedFamily: "Xiaomi", note: "Xiaomi's regional specifications list the 13T family with a nano-SIM plus eSIM option. Confirm the exact market variant before purchase.", settingsPath: "Settings → SIM cards & mobile networks → Use eSIM → Manage eSIM", sourceUrl: XIAOMI_13T_SOURCE };
  }
  if (/\bxiaomi\s+14\b(?!\s*(t|pro|ultra))/.test(value)) {
    return { status: "compatible", matchedFamily: "Xiaomi", note: "Xiaomi lists the global Xiaomi 14 with a nano-SIM plus eSIM option. Availability can vary by country, carrier, and regional device variant.", settingsPath: "Settings → Mobile networks → Turn on eSIM → Manage eSIM", sourceUrl: XIAOMI_14_SOURCE };
  }
  if (/\bxiaomi\s+14t\s+pro\b/.test(value)) {
    return { status: "compatible", matchedFamily: "Xiaomi", note: "Xiaomi documents eSIM setup for the 14T Pro. Confirm that the option is present on the exact regional model.", settingsPath: "Settings → Mobile networks → Turn on eSIM → Manage eSIM", sourceUrl: XIAOMI_14T_PRO_SOURCE };
  }
  if (/\bxiaomi\s+15\b(?!\s*(pro|ultra))/.test(value)) {
    return { status: "compatible", matchedFamily: "Xiaomi", note: "Xiaomi lists the global Xiaomi 15 as eSIM-capable. Availability can vary by region and carrier.", settingsPath: "Settings → Mobile networks → Turn on eSIM → Manage eSIM", sourceUrl: XIAOMI_15_SOURCE };
  }

  const recognizedBrand = ["huawei", "motorola", "moto", "xiaomi", "redmi", "oppo", "oneplus", "honor"].find((brand) => value.includes(brand));
  if (recognizedBrand) {
    return { status: "unknown", matchedFamily: recognizedBrand, note: "Unable to verify this exact model from the curated manufacturer-backed list. Check the phone settings for an Add eSIM option and confirm the model with the manufacturer.", settingsPath: "Settings → Mobile network / SIM manager → Add eSIM", sourceUrl: null };
  }

  return { status: "unknown", matchedFamily: null, note: "Unable to verify that model. Check the exact model number and look for an Add eSIM option in the phone settings.", settingsPath: null, sourceUrl: null };
}
