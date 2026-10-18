# Product-page evidence

Checked on 18 October 2026 against the refreshed Airalo Partner API MCP specification, the synced catalogue, and a live product-information lookup. The MCP exposes API documentation; it does not itself execute partner API requests.

| Customer information | Supplier source | Implementation |
| --- | --- | --- |
| Covered countries and local carriers | `GET /v2/packages`, operator `countries` and `coverages` | Resolve code-only country names before merging coverage records. Regional display lists contain the covered countries, rather than the region itself. A listed country does not establish reception at a particular park or lodge. |
| When validity starts | Operator `activation_policy` in `GET /v2/packages`; also `GET /v2/packages/{package_slug}/product-information` | Translate `first-usage` and `installation` into buying guidance, shared with receipt emails. Unknown machine values remain unconfirmed. |
| Installation deadline | Operator `install_window_days` in `GET /v2/packages` | Show the supplied deadline separately from the number of days the plan lasts. |
| Device-specific setup and roaming | `GET /v2/sims/{sim_iccid}/instructions` | Personalised installation and network setup belong on the secure order page. |
| Detailed product summary and brochure | `GET /v2/packages/{package_slug}/product-information` | Available fields include services, allowances, validity, networks, fair use and a versioned PDF. This endpoint is not yet part of the storefront sync. |
| Hotspot support | No explicit hotspot/tethering field in the current package or product-information response schemas | Omitted from customer-facing pages, cards, filters and guidance at the owner's request on 19 October 2026. The internal catalogue value remains nullable. |
| Delivery completion | Async order webhook and `GET /v2/orders/{order_id}?include=sims,status` | A request acknowledgement is not delivery. Display the existing order's installation details when available. These schemas publish no delivery SLA. |

The live lookup for `safarilink-in-30days-20gb` returned HTTP 200, 20 GB, 30 days, 4G, first-use activation, Safaricom/Airtel, and PIB version 14. It returned no hotspot field. Its synced coverage identifies Kenya, Tanzania and Uganda. The API's brochure link was `https://assets.partners.airalo.com/package_versions/safarilink-in-30days-20gb/14.pdf`; links and versions must come from a current response rather than being hard-coded into the storefront.

The linked PDF was downloaded and read. It also contains no hotspot confirmation or delivery SLA. This response and brochure contain German product wording despite an English request header, and the activation value remains `first-usage`; do not treat the brochure as ready-to-display English customer guidance.

Delivery copy uses a 10-minute customer escalation point, consistent with the existing paid-but-unfulfilled alert threshold. This is a support action point, not a measured delivery time or guarantee. There were no recent records with a populated fulfilment timestamp in the anonymous timing sample, so there is no basis for publishing an observed average or percentile yet.

Do not copy the Airalo consumer store's automatic 70-minute refund promise into SIM.Africa: the current integration does not implement that promise. SIM.Africa's existing refund policy governs the support review.

Sources: [Partner API FAQ](https://developers.partners.airalo.com/faq-752238m0), [Airalo hotspot guidance](https://www.airalo.com/help/using-managing-esims/ZSEEHBT5HW6F/can-i-use-tethering-personal-hotspot/5XTAX1X7HR0B), [Airalo consumer delivery guidance](https://www.airalo.com/help/troubleshooting/0UEL63PDK5IJ/why-havent-i-received-my-esim-or-topup-yet/V6IHCV7TL8OM), and [SIM.Africa production alerts](production-alerts.md).
