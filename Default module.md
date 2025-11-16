---
title: Default module
language_tabs:
  - shell: Shell
  - http: HTTP
  - javascript: JavaScript
  - ruby: Ruby
  - python: Python
  - php: PHP
  - java: Java
  - go: Go
toc_footers: []
includes: []
search: true
code_clipboard: true
highlight_theme: darkula
headingLevel: 2
generator: "@tarslib/widdershins v4.0.30"

---

# Default module

Base URLs:

# Authentication

# REST API/Endpoints/Authenticate

## POST Request access token

POST /v2/token

This endpoint provides an access token required for making authenticated requests to the Airalo Partners API. Submit your client ID and client secret to obtain a token valid for **24 hours**. While the token remains valid for a year, we recommend refreshing it more frequently for enhanced security.  

#### Important Notes  
- The response contains the access token, which must be cached and reused for subsequent API calls until it expires or is refreshed.  
- Store the client ID and client secret securely in an **encrypted format** on your systems.  
- All actions performed using these credentials will be considered valid transactions, and the partner will be responsible for any associated costs.  

> Body Parameters

```yaml
client_id: <replace with client id>
client_secret: <replace with client secret>
grant_type: client_credentials

```

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|Accept|header|string| yes |none|
|body|body|object| no |none|
|» client_id|body|string| yes |Required. Unique identifier of your application. Must be kept secure and never exposed publicly.|
|» client_secret|body|string| yes |Required. Confidential key associated with your client ID. Must be kept secure and never exposed publicly.|
|» grant_type|body|string| yes |Required. The grant type should be set to "client_credentials". |

#### Description

**» grant_type**: Required. The grant type should be set to "client_credentials". 
It indicates server-to-server authentication, where the client application directly requests an access token without user intervention.

> Response Examples

> 200 Response

```json
{
  "data": {
    "token_type": "Bearer",
    "expires_in": 31622400,
    "access_token": "<access token>"
  },
  "meta": {
    "message": "success"
  }
}
```

> 422 Response

```json
{
  "data": {
    "client_id": "The selected client id is invalid."
  },
  "meta": {
    "message": "the parameter is invalid"
  }
}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|
|422|[Unprocessable Entity](https://tools.ietf.org/html/rfc2518#section-10.3)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» token_type|string|true|none||none|
|»» expires_in|integer|true|none||none|
|»» access_token|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

HTTP Status Code **422**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» client_id|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

# REST API/Endpoints/Browse packages

## GET Get packages

GET /v2/packages

:::highlight blue 💡
**Action Required: Synchronize at least once every hour.**
This step is vital for ensuring newly introduced packages are available and out-of-stock packages are excluded.
:::

Retrieve a list of local and global eSIM packages available through the Airalo Partners API. Local packages cover a single country, while global packages span multiple countries and regions. This endpoint helps you synchronize eSIM plans/packages with your system, ensuring newly introduced packages are available to your clients and out-of-stock packages are handled properly.  

#### Features  
- **Package Types**: Supports standard data packages and the new "Voice and Text" packages.  
- **Filtering**: Filter results by operator type or country code to tailor the package list to your needs.  
- **Pagination**: Adjust pagination settings to retrieve results in manageable chunks.  
- **Limit**: Set the `limit` parameter to a high value (e.g., 1,000) to fetch all packages in a single request without using pagination.  
- **Include Top-Up**: Use the `include:top-up` parameter to fetch eSIM packages along with their associated top-up packages.  

#### Rate Limit  
- This endpoint allows up to **40 requests per minute**. Ensure your implementation respects this limit to avoid rate limit errors.  

#### Multi-Currency
- This endpoint provides pricing information in multiple currencies for both net prices and recommended retail prices. All currency conversion rates are updated once daily at 00:00 UTC.

#### Important Notes  
- Include the access token, obtained from the **Request Access Token** endpoint, in the request headers for authentication.  

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|filter[type]|query|string| no |Optional. A string to filter packages by operator type. Possible values are "local" and "global".|
|filter[country]|query|string| no |Optional. A string to filter packages by country code. Examples include US, DE, GB, IT, and UA.|
|limit|query|string| no |Optional. An integer specifying how many items will be returned on each page.|
|page|query|string| no |Optional. An integer specifying the pagination's current page. |
|include|query|string| no |Optional. Valid value is topup. Includes topup packages to the response|
|Accept|header|string| yes |none|
|Authorization|header|string| yes |none|

#### Description

**filter[type]**: Optional. A string to filter packages by operator type. Possible values are "local" and "global".
  
If the filter is set to "global," the output will include only global and regional eSims. Global and regional packages do not use the "country_code" field, which will be empty. The "type" field in the operator object within the response will be set to "global." A package is considered worldwide if its "slug" field is set to "world" and regional if "slug" contains a region name, for example, "europe" or "Africa".
  
If the filter is set to "local," the response will contain only country-specific packages. To get the list of packages for a single country, you can use it in combination with filter[country] parameter. The "type" field in the operator object of the response will indicate a "local" type.
  
When the filter is not set, we return all types of eSIMs: local, regional, and global.

**page**: Optional. An integer specifying the pagination's current page. 
If the page is set to 2 or beyond, the response will have different format and contain an object representing the country's index in the list of packages.

> Response Examples

> 200 Response

```json
{
  "data": [
    {
      "slug": "united-states",
      "country_code": "US",
      "title": "United States",
      "image": {
        "width": 132,
        "height": 99,
        "url": "https://cdn.airalo.com/images/600de234-ec12-4e1f-b793-c70860e4545a.png"
      },
      "operators": [
        {
          "id": 687,
          "style": "light",
          "gradient_start": "#0f1b3f",
          "gradient_end": "#194281",
          "type": "local",
          "is_prepaid": false,
          "title": "Change",
          "esim_type": "Prepaid",
          "warning": null,
          "apn_type": "manual",
          "apn_value": "wbdata",
          "is_roaming": true,
          "info": [
            "5G Data-only eSIM.",
            "Rechargeable online with no expiry.",
            "Operates on T-Mobile and Verizon networks in the United States of America."
          ],
          "image": {
            "width": 1035,
            "height": 653,
            "url": "https://cdn.airalo.com/images/030f0576-f611-4eee-bba5-eb90a994c4ff.png"
          },
          "plan_type": "data",
          "activation_policy": "first-usage",
          "is_kyc_verify": false,
          "rechargeability": true,
          "other_info": "This eSIM is for travelers to the United States. The coverage applies to all 50 states of the United States, and Puerto Rico.",
          "coverages": [
            {
              "name": "US",
              "code": "US",
              "networks": [
                {
                  "name": "T-Mobile",
                  "types": [
                    "5G"
                  ]
                },
                {
                  "name": "Verizon",
                  "types": [
                    "5G"
                  ]
                }
              ]
            }
          ],
          "install_window_days": null,
          "topup_grace_window_days": null,
          "apn": {
            "ios": {
              "apn_type": "automatic",
              "apn_value": "wbdata"
            },
            "android": {
              "apn_type": "manual",
              "apn_value": "wbdata"
            }
          },
          "packages": [
            {
              "id": "change-7days-1gb",
              "type": "sim",
              "price": 4.5,
              "amount": 1024,
              "day": 7,
              "is_unlimited": false,
              "title": "1 GB - 7 Days",
              "short_info": "This eSIM doesn't come with a phone number.",
              "qr_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "manual_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "1 GB",
              "voice": null,
              "text": null,
              "net_price": 1.1,
              "prices": {
                "net_price": {
                  "AUD": 1.72,
                  "BRL": 6.26,
                  "GBP": 0.81,
                  "CAD": 1.53,
                  "AED": 4.04,
                  "EUR": 0.98,
                  "INR": 93.96,
                  "IDR": 17920,
                  "ILS": 3.86,
                  "JPY": 160,
                  "MYR": 4.65,
                  "MXN": 21.33,
                  "SGD": 1.42,
                  "KRW": 1512,
                  "USD": 1.1,
                  "VND": 28536
                },
                "recommended_retail_price": {
                  "AUD": 7.02,
                  "BRL": 25.6,
                  "GBP": 3.33,
                  "CAD": 6.26,
                  "AED": 16.52,
                  "EUR": 4,
                  "INR": 384.39,
                  "IDR": 73309,
                  "ILS": 15.8,
                  "JPY": 656,
                  "MYR": 19.04,
                  "MXN": 87.26,
                  "SGD": 5.8,
                  "KRW": 6186,
                  "USD": 4.5,
                  "VND": 116738
                }
              }
            },
            {
              "id": "change-15days-2gb",
              "type": "sim",
              "price": 8,
              "amount": 2048,
              "day": 15,
              "is_unlimited": false,
              "title": "2 GB - 15 Days",
              "short_info": null,
              "qr_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "manual_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "2 GB",
              "voice": null,
              "text": null,
              "net_price": 2.2,
              "prices": {
                "net_price": {
                  "AUD": 3.43,
                  "BRL": 12.52,
                  "GBP": 1.63,
                  "CAD": 3.06,
                  "AED": 8.07,
                  "EUR": 1.96,
                  "INR": 187.92,
                  "IDR": 35840,
                  "ILS": 7.72,
                  "JPY": 321,
                  "MYR": 9.31,
                  "MXN": 42.66,
                  "SGD": 2.84,
                  "KRW": 3024,
                  "USD": 2.2,
                  "VND": 57072
                },
                "recommended_retail_price": {
                  "AUD": 12.48,
                  "BRL": 45.52,
                  "GBP": 5.92,
                  "CAD": 11.12,
                  "AED": 29.36,
                  "EUR": 7.12,
                  "INR": 683.36,
                  "IDR": 130328,
                  "ILS": 28.08,
                  "JPY": 1166,
                  "MYR": 33.84,
                  "MXN": 155.12,
                  "SGD": 10.32,
                  "KRW": 10997,
                  "USD": 8,
                  "VND": 207534
                }
              }
            },
            {
              "id": "change-30days-3gb",
              "type": "sim",
              "price": 11,
              "amount": 3072,
              "day": 30,
              "is_unlimited": false,
              "title": "3 GB - 30 Days",
              "short_info": "This eSIM doesn't come with a phone number.",
              "qr_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "manual_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "3 GB",
              "voice": null,
              "text": null,
              "net_price": 3.1,
              "prices": {
                "net_price": {
                  "AUD": 4.84,
                  "BRL": 17.64,
                  "GBP": 2.29,
                  "CAD": 4.31,
                  "AED": 11.38,
                  "EUR": 2.76,
                  "INR": 264.8,
                  "IDR": 50502,
                  "ILS": 10.88,
                  "JPY": 452,
                  "MYR": 13.11,
                  "MXN": 60.11,
                  "SGD": 4,
                  "KRW": 4261,
                  "USD": 3.1,
                  "VND": 80420
                },
                "recommended_retail_price": {
                  "AUD": 17.16,
                  "BRL": 62.59,
                  "GBP": 8.14,
                  "CAD": 15.29,
                  "AED": 40.37,
                  "EUR": 9.79,
                  "INR": 939.62,
                  "IDR": 179200,
                  "ILS": 38.61,
                  "JPY": 1603,
                  "MYR": 46.53,
                  "MXN": 213.29,
                  "SGD": 14.19,
                  "KRW": 15120,
                  "USD": 11,
                  "VND": 285360
                }
              }
            },
            {
              "id": "change-30days-5gb",
              "type": "sim",
              "price": 16,
              "amount": 5120,
              "day": 30,
              "is_unlimited": false,
              "title": "5 GB - 30 Days",
              "short_info": "This eSIM doesn't come with a phone number.",
              "qr_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "manual_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "5 GB",
              "voice": null,
              "text": null,
              "net_price": 5,
              "prices": {
                "net_price": {
                  "AUD": 7.8,
                  "BRL": 28.45,
                  "GBP": 3.7,
                  "CAD": 6.95,
                  "AED": 18.35,
                  "EUR": 4.45,
                  "INR": 427.1,
                  "IDR": 81455,
                  "ILS": 17.55,
                  "JPY": 729,
                  "MYR": 21.15,
                  "MXN": 96.95,
                  "SGD": 6.45,
                  "KRW": 6873,
                  "USD": 5,
                  "VND": 129709
                },
                "recommended_retail_price": {
                  "AUD": 24.96,
                  "BRL": 91.04,
                  "GBP": 11.84,
                  "CAD": 22.24,
                  "AED": 58.72,
                  "EUR": 14.24,
                  "INR": 1366.72,
                  "IDR": 260655,
                  "ILS": 56.16,
                  "JPY": 2332,
                  "MYR": 67.68,
                  "MXN": 310.24,
                  "SGD": 20.64,
                  "KRW": 21993,
                  "USD": 16,
                  "VND": 415069
                }
              }
            },
            {
              "id": "change-30days-10gb",
              "type": "sim",
              "price": 26,
              "amount": 10240,
              "day": 30,
              "is_unlimited": false,
              "title": "10 GB - 30 Days",
              "short_info": "This eSIM doesn't come with a phone number.",
              "qr_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "manual_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "10 GB",
              "voice": null,
              "text": null,
              "net_price": 9.5,
              "prices": {
                "net_price": {
                  "AUD": 14.82,
                  "BRL": 54.06,
                  "GBP": 7.03,
                  "CAD": 13.2,
                  "AED": 34.86,
                  "EUR": 8.46,
                  "INR": 811.49,
                  "IDR": 154764,
                  "ILS": 33.34,
                  "JPY": 1384,
                  "MYR": 40.18,
                  "MXN": 184.2,
                  "SGD": 12.26,
                  "KRW": 13058,
                  "USD": 9.5,
                  "VND": 246447
                },
                "recommended_retail_price": {
                  "AUD": 40.56,
                  "BRL": 147.94,
                  "GBP": 19.24,
                  "CAD": 36.14,
                  "AED": 95.42,
                  "EUR": 23.14,
                  "INR": 2220.92,
                  "IDR": 423565,
                  "ILS": 91.26,
                  "JPY": 3789,
                  "MYR": 109.98,
                  "MXN": 504.14,
                  "SGD": 33.54,
                  "KRW": 35739,
                  "USD": 26,
                  "VND": 674487
                }
              }
            },
            {
              "id": "change-30days-20gb",
              "type": "sim",
              "price": 42,
              "amount": 20480,
              "day": 30,
              "is_unlimited": false,
              "title": "20 GB - 30 Days",
              "short_info": null,
              "qr_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "manual_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "20 GB",
              "voice": null,
              "text": null,
              "net_price": 17.5,
              "prices": {
                "net_price": {
                  "AUD": 27.3,
                  "BRL": 99.58,
                  "GBP": 12.95,
                  "CAD": 24.32,
                  "AED": 64.22,
                  "EUR": 15.58,
                  "INR": 1494.85,
                  "IDR": 285092,
                  "ILS": 61.42,
                  "JPY": 2550,
                  "MYR": 74.02,
                  "MXN": 339.32,
                  "SGD": 22.58,
                  "KRW": 24055,
                  "USD": 17.5,
                  "VND": 453982
                },
                "recommended_retail_price": {
                  "AUD": 65.52,
                  "BRL": 238.98,
                  "GBP": 31.08,
                  "CAD": 58.38,
                  "AED": 154.14,
                  "EUR": 37.38,
                  "INR": 3587.64,
                  "IDR": 684220,
                  "ILS": 147.42,
                  "JPY": 6121,
                  "MYR": 177.66,
                  "MXN": 814.38,
                  "SGD": 54.18,
                  "KRW": 57732,
                  "USD": 42,
                  "VND": 1089556
                }
              }
            }
          ],
          "countries": [
            {
              "country_code": "US",
              "title": "United States",
              "image": {
                "width": 132,
                "height": 99,
                "url": "https://cdn.airalo.com/images/600de234-ec12-4e1f-b793-c70860e4545a.png"
              }
            }
          ]
        },
        {
          "id": 823,
          "style": "light",
          "gradient_start": "#0f1b3f",
          "gradient_end": "#194281",
          "type": "local",
          "is_prepaid": false,
          "title": "Change+",
          "esim_type": "Prepaid",
          "warning": null,
          "apn_type": "manual",
          "apn_value": "wbdata",
          "is_roaming": true,
          "info": [
            "5G Data-only eSIM.",
            "Rechargeable online with no expiry.",
            "Operates on the T-Mobile network in the United States of America."
          ],
          "image": {
            "width": 1035,
            "height": 653,
            "url": "https://cdn.airalo.com/images/a4687e6a-b166-4c02-8a2e-deee2f032bfc.png"
          },
          "plan_type": "data-voice-text",
          "activation_policy": "first-usage",
          "is_kyc_verify": false,
          "rechargeability": true,
          "other_info": "This eSIM is for travelers to the United States. The coverage does applies to US states, except for Alaska. Puerto Rico is also covered. Incoming calls are deducted from the minutes balance. Outgoing international calls are not allowed.",
          "coverages": [
            {
              "name": "US",
              "code": "US",
              "networks": [
                {
                  "name": "T-Mobile",
                  "types": [
                    "5G"
                  ]
                }
              ]
            }
          ],
          "install_window_days": null,
          "topup_grace_window_days": null,
          "apn": {
            "ios": {
              "apn_type": "automatic",
              "apn_value": "wbdata"
            },
            "android": {
              "apn_type": "manual",
              "apn_value": "wbdata"
            }
          },
          "packages": [
            {
              "id": "change-plus-7days-1gb",
              "type": "sim",
              "price": 7,
              "amount": 1024,
              "day": 7,
              "is_unlimited": false,
              "title": "1 GB - 10 SMS - 20 Mins - 7 Days",
              "short_info": "This eSIM does come with a phone number.",
              "qr_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "manual_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "1 GB",
              "voice": 20,
              "text": 10,
              "net_price": 1.7,
              "prices": {
                "net_price": {
                  "AUD": 2.65,
                  "BRL": 9.67,
                  "GBP": 1.26,
                  "CAD": 2.36,
                  "AED": 6.24,
                  "EUR": 1.51,
                  "INR": 145.21,
                  "IDR": 27695,
                  "ILS": 5.97,
                  "JPY": 248,
                  "MYR": 7.19,
                  "MXN": 32.96,
                  "SGD": 2.19,
                  "KRW": 2337,
                  "USD": 1.7,
                  "VND": 44101
                },
                "recommended_retail_price": {
                  "AUD": 10.92,
                  "BRL": 39.83,
                  "GBP": 5.18,
                  "CAD": 9.73,
                  "AED": 25.69,
                  "EUR": 6.23,
                  "INR": 597.94,
                  "IDR": 114037,
                  "ILS": 24.57,
                  "JPY": 1020,
                  "MYR": 29.61,
                  "MXN": 135.73,
                  "SGD": 9.03,
                  "KRW": 9622,
                  "USD": 7,
                  "VND": 181593
                }
              }
            },
            {
              "id": "change-plus-15days-2gb",
              "type": "sim",
              "price": 12.5,
              "amount": 2048,
              "day": 15,
              "is_unlimited": false,
              "title": "2 GB - 20 SMS - 40 Mins - 15 Days",
              "short_info": null,
              "qr_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "manual_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "2 GB",
              "voice": 40,
              "text": 20,
              "net_price": 3.3,
              "prices": {
                "net_price": {
                  "AUD": 5.15,
                  "BRL": 18.78,
                  "GBP": 2.44,
                  "CAD": 4.59,
                  "AED": 12.11,
                  "EUR": 2.94,
                  "INR": 281.89,
                  "IDR": 53760,
                  "ILS": 11.58,
                  "JPY": 481,
                  "MYR": 13.96,
                  "MXN": 63.99,
                  "SGD": 4.26,
                  "KRW": 4536,
                  "USD": 3.3,
                  "VND": 85608
                },
                "recommended_retail_price": {
                  "AUD": 19.5,
                  "BRL": 71.12,
                  "GBP": 9.25,
                  "CAD": 17.38,
                  "AED": 45.88,
                  "EUR": 11.12,
                  "INR": 1067.75,
                  "IDR": 203637,
                  "ILS": 43.88,
                  "JPY": 1822,
                  "MYR": 52.88,
                  "MXN": 242.38,
                  "SGD": 16.12,
                  "KRW": 17182,
                  "USD": 12.5,
                  "VND": 324272
                }
              }
            },
            {
              "id": "change-plus-30days-3gb",
              "type": "sim",
              "price": 16,
              "amount": 3072,
              "day": 30,
              "is_unlimited": false,
              "title": "3 GB - 30 SMS - 60 Mins - 30 Days",
              "short_info": null,
              "qr_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "manual_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "3 GB",
              "voice": 60,
              "text": 30,
              "net_price": 4.5,
              "prices": {
                "net_price": {
                  "AUD": 7.02,
                  "BRL": 25.6,
                  "GBP": 3.33,
                  "CAD": 6.26,
                  "AED": 16.52,
                  "EUR": 4,
                  "INR": 384.39,
                  "IDR": 73309,
                  "ILS": 15.8,
                  "JPY": 656,
                  "MYR": 19.04,
                  "MXN": 87.26,
                  "SGD": 5.8,
                  "KRW": 6186,
                  "USD": 4.5,
                  "VND": 116738
                },
                "recommended_retail_price": {
                  "AUD": 24.96,
                  "BRL": 91.04,
                  "GBP": 11.84,
                  "CAD": 22.24,
                  "AED": 58.72,
                  "EUR": 14.24,
                  "INR": 1366.72,
                  "IDR": 260655,
                  "ILS": 56.16,
                  "JPY": 2332,
                  "MYR": 67.68,
                  "MXN": 310.24,
                  "SGD": 20.64,
                  "KRW": 21993,
                  "USD": 16,
                  "VND": 415069
                }
              }
            },
            {
              "id": "change-plus-30days-5gb",
              "type": "sim",
              "price": 22.5,
              "amount": 5120,
              "day": 30,
              "is_unlimited": false,
              "title": "5 GB - 50 SMS - 100 Mins - 30 Days",
              "short_info": null,
              "qr_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "manual_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "5 GB",
              "voice": 100,
              "text": 50,
              "net_price": 7,
              "prices": {
                "net_price": {
                  "AUD": 10.92,
                  "BRL": 39.83,
                  "GBP": 5.18,
                  "CAD": 9.73,
                  "AED": 25.69,
                  "EUR": 6.23,
                  "INR": 597.94,
                  "IDR": 114037,
                  "ILS": 24.57,
                  "JPY": 1020,
                  "MYR": 29.61,
                  "MXN": 135.73,
                  "SGD": 9.03,
                  "KRW": 9622,
                  "USD": 7,
                  "VND": 181593
                },
                "recommended_retail_price": {
                  "AUD": 35.1,
                  "BRL": 128.02,
                  "GBP": 16.65,
                  "CAD": 31.28,
                  "AED": 82.58,
                  "EUR": 20.02,
                  "INR": 1921.95,
                  "IDR": 366546,
                  "ILS": 78.98,
                  "JPY": 3279,
                  "MYR": 95.18,
                  "MXN": 436.28,
                  "SGD": 29.02,
                  "KRW": 30928,
                  "USD": 22.5,
                  "VND": 583690
                }
              }
            },
            {
              "id": "change-plus-30days-10gb",
              "type": "sim",
              "price": 34.5,
              "amount": 10240,
              "day": 30,
              "is_unlimited": false,
              "title": "10 GB - 100 SMS - 200 Mins - 30 Days",
              "short_info": null,
              "qr_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "manual_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "10 GB",
              "voice": 200,
              "text": 100,
              "net_price": 12.6,
              "prices": {
                "net_price": {
                  "AUD": 19.66,
                  "BRL": 71.69,
                  "GBP": 9.32,
                  "CAD": 17.51,
                  "AED": 46.24,
                  "EUR": 11.21,
                  "INR": 1076.29,
                  "IDR": 205266,
                  "ILS": 44.23,
                  "JPY": 1836,
                  "MYR": 53.3,
                  "MXN": 244.31,
                  "SGD": 16.25,
                  "KRW": 17320,
                  "USD": 12.6,
                  "VND": 326867
                },
                "recommended_retail_price": {
                  "AUD": 53.82,
                  "BRL": 196.3,
                  "GBP": 25.53,
                  "CAD": 47.96,
                  "AED": 126.62,
                  "EUR": 30.7,
                  "INR": 2946.99,
                  "IDR": 562038,
                  "ILS": 121.1,
                  "JPY": 5028,
                  "MYR": 145.94,
                  "MXN": 668.96,
                  "SGD": 44.5,
                  "KRW": 47423,
                  "USD": 34.5,
                  "VND": 894992
                }
              }
            },
            {
              "id": "change-plus-30days-20gb",
              "type": "sim",
              "price": 49,
              "amount": 20480,
              "day": 30,
              "is_unlimited": false,
              "title": "20 GB - 200 SMS - 400 Mins - 30 Days",
              "short_info": null,
              "qr_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "manual_installation": "<p><b>eSIM name:</b> Change</p><p><b>Coverage: </b>United States</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "20 GB",
              "voice": 400,
              "text": 200,
              "net_price": 20.4,
              "prices": {
                "net_price": {
                  "AUD": 31.82,
                  "BRL": 116.08,
                  "GBP": 15.1,
                  "CAD": 28.36,
                  "AED": 74.87,
                  "EUR": 18.16,
                  "INR": 1742.57,
                  "IDR": 332335,
                  "ILS": 71.6,
                  "JPY": 2973,
                  "MYR": 86.29,
                  "MXN": 395.56,
                  "SGD": 26.32,
                  "KRW": 28041,
                  "USD": 20.4,
                  "VND": 529213
                },
                "recommended_retail_price": {
                  "AUD": 76.44,
                  "BRL": 278.81,
                  "GBP": 36.26,
                  "CAD": 68.11,
                  "AED": 179.83,
                  "EUR": 43.61,
                  "INR": 4185.58,
                  "IDR": 798257,
                  "ILS": 171.99,
                  "JPY": 7141,
                  "MYR": 207.27,
                  "MXN": 950.11,
                  "SGD": 63.21,
                  "KRW": 67354,
                  "USD": 49,
                  "VND": 1271148
                }
              }
            }
          ],
          "countries": [
            {
              "country_code": "US",
              "title": "United States",
              "image": {
                "width": 132,
                "height": 99,
                "url": "https://cdn.airalo.com/images/600de234-ec12-4e1f-b793-c70860e4545a.png"
              }
            }
          ]
        }
      ]
    },
    {
      "slug": "france",
      "country_code": "FR",
      "title": "France",
      "image": {
        "width": 132,
        "height": 99,
        "url": "https://cdn.airalo.com/images/9753dedb-d495-47cf-b6e4-82e555564743.png"
      },
      "operators": [
        {
          "id": 826,
          "style": "dark",
          "gradient_start": "#F1D4FB",
          "gradient_end": "#EEC0FF",
          "type": "local",
          "is_prepaid": false,
          "title": "Élan",
          "esim_type": "Prepaid",
          "warning": null,
          "apn_type": "automatic",
          "apn_value": null,
          "is_roaming": false,
          "info": [
            "4G Data-only eSIM.",
            "Rechargeable online with no expiry.",
            "Operates on the Orange network in France."
          ],
          "image": {
            "width": 1035,
            "height": 653,
            "url": "https://cdn.airalo.com/images/6e8c08d1-9e2d-4feb-b60f-e8c4bd344d47.png"
          },
          "plan_type": "data",
          "activation_policy": "first-usage",
          "is_kyc_verify": false,
          "rechargeability": true,
          "other_info": "You can add a top-up to this eSIM within 120 days from when it was activated. Adding a new package will reset this period.",
          "coverages": [
            {
              "name": "FR",
              "code": "FR",
              "networks": [
                {
                  "name": "Orange",
                  "types": [
                    "4G"
                  ]
                }
              ]
            }
          ],
          "install_window_days": 1825,
          "topup_grace_window_days": 180,
          "apn": {
            "ios": {
              "apn_type": "automatic",
              "apn_value": null
            },
            "android": {
              "apn_type": "automatic",
              "apn_value": null
            }
          },
          "packages": [
            {
              "id": "elan-7days-1gb",
              "type": "sim",
              "price": 4.5,
              "amount": 1024,
              "day": 7,
              "is_unlimited": false,
              "title": "1 GB - 7 Days",
              "short_info": "This eSIM doesn't come with a phone number.",
              "qr_installation": "<p><b>eSIM name:</b> Élan</p><p><b>Coverage: </b>France</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on another device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Turn on the eSIM line.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p>",
              "manual_installation": "<p><b>eSIM name:</b> Élan</p><p><b>Coverage: </b>France</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Turn on the eSIM line</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "1 GB",
              "voice": null,
              "text": null,
              "net_price": 0.8,
              "prices": {
                "net_price": {
                  "AUD": 1.25,
                  "BRL": 4.55,
                  "GBP": 0.59,
                  "CAD": 1.11,
                  "AED": 2.94,
                  "EUR": 0.71,
                  "INR": 68.34,
                  "IDR": 13033,
                  "ILS": 2.81,
                  "JPY": 117,
                  "MYR": 3.38,
                  "MXN": 15.51,
                  "SGD": 1.03,
                  "KRW": 1100,
                  "USD": 0.8,
                  "VND": 20753
                },
                "recommended_retail_price": {
                  "AUD": 7.02,
                  "BRL": 25.6,
                  "GBP": 3.33,
                  "CAD": 6.26,
                  "AED": 16.52,
                  "EUR": 4,
                  "INR": 384.39,
                  "IDR": 73309,
                  "ILS": 15.8,
                  "JPY": 656,
                  "MYR": 19.04,
                  "MXN": 87.26,
                  "SGD": 5.8,
                  "KRW": 6186,
                  "USD": 4.5,
                  "VND": 116738
                }
              }
            },
            {
              "id": "elan-15days-2gb",
              "type": "sim",
              "price": 6,
              "amount": 2048,
              "day": 15,
              "is_unlimited": false,
              "title": "2 GB - 15 Days",
              "short_info": null,
              "qr_installation": "<p><b>eSIM name:</b> Élan</p><p><b>Coverage: </b>France</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on another device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Turn on the eSIM line.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p>",
              "manual_installation": "<p><b>eSIM name:</b> Élan</p><p><b>Coverage: </b>France</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Turn on the eSIM line</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "2 GB",
              "voice": null,
              "text": null,
              "net_price": 1.5,
              "prices": {
                "net_price": {
                  "AUD": 2.34,
                  "BRL": 8.54,
                  "GBP": 1.11,
                  "CAD": 2.08,
                  "AED": 5.5,
                  "EUR": 1.34,
                  "INR": 128.13,
                  "IDR": 24436,
                  "ILS": 5.26,
                  "JPY": 219,
                  "MYR": 6.34,
                  "MXN": 29.08,
                  "SGD": 1.94,
                  "KRW": 2062,
                  "USD": 1.5,
                  "VND": 38913
                },
                "recommended_retail_price": {
                  "AUD": 9.36,
                  "BRL": 34.14,
                  "GBP": 4.44,
                  "CAD": 8.34,
                  "AED": 22.02,
                  "EUR": 5.34,
                  "INR": 512.52,
                  "IDR": 97746,
                  "ILS": 21.06,
                  "JPY": 874,
                  "MYR": 25.38,
                  "MXN": 116.34,
                  "SGD": 7.74,
                  "KRW": 8247,
                  "USD": 6,
                  "VND": 155651
                }
              }
            },
            {
              "id": "elan-30days-3gb",
              "type": "sim",
              "price": 7.5,
              "amount": 3072,
              "day": 30,
              "is_unlimited": false,
              "title": "3 GB - 30 Days",
              "short_info": "This eSIM doesn't come with a phone number.",
              "qr_installation": "<p><b>eSIM name:</b> Élan</p><p><b>Coverage: </b>France</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on another device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Turn on the eSIM line.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p>",
              "manual_installation": "<p><b>eSIM name:</b> Élan</p><p><b>Coverage: </b>France</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Turn on the eSIM line</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "3 GB",
              "voice": null,
              "text": null,
              "net_price": 2.1,
              "prices": {
                "net_price": {
                  "AUD": 3.28,
                  "BRL": 11.95,
                  "GBP": 1.55,
                  "CAD": 2.92,
                  "AED": 7.71,
                  "EUR": 1.87,
                  "INR": 179.38,
                  "IDR": 34211,
                  "ILS": 7.37,
                  "JPY": 306,
                  "MYR": 8.88,
                  "MXN": 40.72,
                  "SGD": 2.71,
                  "KRW": 2887,
                  "USD": 2.1,
                  "VND": 54478
                },
                "recommended_retail_price": {
                  "AUD": 11.7,
                  "BRL": 42.68,
                  "GBP": 5.55,
                  "CAD": 10.42,
                  "AED": 27.52,
                  "EUR": 6.68,
                  "INR": 640.65,
                  "IDR": 122182,
                  "ILS": 26.32,
                  "JPY": 1093,
                  "MYR": 31.72,
                  "MXN": 145.42,
                  "SGD": 9.68,
                  "KRW": 10309,
                  "USD": 7.5,
                  "VND": 194564
                }
              }
            },
            {
              "id": "elan-30days-5gb",
              "type": "sim",
              "price": 10,
              "amount": 5120,
              "day": 30,
              "is_unlimited": false,
              "title": "5 GB - 30 Days",
              "short_info": "This eSIM doesn't come with a phone number.",
              "qr_installation": "<p><b>eSIM name:</b> Élan</p><p><b>Coverage: </b>France</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on another device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Turn on the eSIM line.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p>",
              "manual_installation": "<p><b>eSIM name:</b> Élan</p><p><b>Coverage: </b>France</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Turn on the eSIM line</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "5 GB",
              "voice": null,
              "text": null,
              "net_price": 3.5,
              "prices": {
                "net_price": {
                  "AUD": 5.46,
                  "BRL": 19.92,
                  "GBP": 2.59,
                  "CAD": 4.86,
                  "AED": 12.84,
                  "EUR": 3.12,
                  "INR": 298.97,
                  "IDR": 57018,
                  "ILS": 12.28,
                  "JPY": 510,
                  "MYR": 14.8,
                  "MXN": 67.86,
                  "SGD": 4.52,
                  "KRW": 4811,
                  "USD": 3.5,
                  "VND": 90796
                },
                "recommended_retail_price": {
                  "AUD": 15.6,
                  "BRL": 56.9,
                  "GBP": 7.4,
                  "CAD": 13.9,
                  "AED": 36.7,
                  "EUR": 8.9,
                  "INR": 854.2,
                  "IDR": 162910,
                  "ILS": 35.1,
                  "JPY": 1457,
                  "MYR": 42.3,
                  "MXN": 193.9,
                  "SGD": 12.9,
                  "KRW": 13746,
                  "USD": 10,
                  "VND": 259418
                }
              }
            },
            {
              "id": "elan-30days-10gb",
              "type": "sim",
              "price": 16,
              "amount": 10240,
              "day": 30,
              "is_unlimited": false,
              "title": "10 GB - 30 Days",
              "short_info": "This eSIM doesn't come with a phone number.",
              "qr_installation": "<p><b>eSIM name:</b> Élan</p><p><b>Coverage: </b>France</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on another device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Turn on the eSIM line.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p>",
              "manual_installation": "<p><b>eSIM name:</b> Élan</p><p><b>Coverage: </b>France</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Turn on the eSIM line</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "10 GB",
              "voice": null,
              "text": null,
              "net_price": 6,
              "prices": {
                "net_price": {
                  "AUD": 9.36,
                  "BRL": 34.14,
                  "GBP": 4.44,
                  "CAD": 8.34,
                  "AED": 22.02,
                  "EUR": 5.34,
                  "INR": 512.52,
                  "IDR": 97746,
                  "ILS": 21.06,
                  "JPY": 874,
                  "MYR": 25.38,
                  "MXN": 116.34,
                  "SGD": 7.74,
                  "KRW": 8247,
                  "USD": 6,
                  "VND": 155651
                },
                "recommended_retail_price": {
                  "AUD": 24.96,
                  "BRL": 91.04,
                  "GBP": 11.84,
                  "CAD": 22.24,
                  "AED": 58.72,
                  "EUR": 14.24,
                  "INR": 1366.72,
                  "IDR": 260655,
                  "ILS": 56.16,
                  "JPY": 2332,
                  "MYR": 67.68,
                  "MXN": 310.24,
                  "SGD": 20.64,
                  "KRW": 21993,
                  "USD": 16,
                  "VND": 415069
                }
              }
            },
            {
              "id": "elan-30days-20gb",
              "type": "sim",
              "price": 23.5,
              "amount": 20480,
              "day": 30,
              "is_unlimited": false,
              "title": "20 GB - 30 Days",
              "short_info": null,
              "qr_installation": "<p><b>eSIM name:</b> Élan</p><p><b>Coverage: </b>France</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on another device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Turn on the eSIM line.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p>",
              "manual_installation": "<p><b>eSIM name:</b> Élan</p><p><b>Coverage: </b>France</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Turn on the eSIM line</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p><p><br></p><p><br></p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "20 GB",
              "voice": null,
              "text": null,
              "net_price": 11.5,
              "prices": {
                "net_price": {
                  "AUD": 17.94,
                  "BRL": 65.44,
                  "GBP": 8.51,
                  "CAD": 15.98,
                  "AED": 42.2,
                  "EUR": 10.24,
                  "INR": 982.33,
                  "IDR": 187346,
                  "ILS": 40.36,
                  "JPY": 1676,
                  "MYR": 48.64,
                  "MXN": 222.98,
                  "SGD": 14.84,
                  "KRW": 15808,
                  "USD": 11.5,
                  "VND": 298331
                },
                "recommended_retail_price": {
                  "AUD": 36.66,
                  "BRL": 133.72,
                  "GBP": 17.39,
                  "CAD": 32.66,
                  "AED": 86.24,
                  "EUR": 20.92,
                  "INR": 2007.37,
                  "IDR": 382837,
                  "ILS": 82.48,
                  "JPY": 3425,
                  "MYR": 99.4,
                  "MXN": 455.66,
                  "SGD": 30.32,
                  "KRW": 32302,
                  "USD": 23.5,
                  "VND": 609632
                }
              }
            }
          ],
          "countries": [
            {
              "country_code": "FR",
              "title": "France",
              "image": {
                "width": 132,
                "height": 99,
                "url": "https://cdn.airalo.com/images/9753dedb-d495-47cf-b6e4-82e555564743.png"
              }
            }
          ]
        }
      ]
    },
    {
      "slug": "china",
      "country_code": "CN",
      "title": "China",
      "image": {
        "width": 132,
        "height": 99,
        "url": "https://cdn.airalo.com/images/301616a0-cd3e-4151-a4ec-78c8ddb04ca9.png"
      },
      "operators": [
        {
          "id": 1000,
          "style": "light",
          "gradient_start": "#ff2d2f",
          "gradient_end": "#de2627",
          "type": "local",
          "is_prepaid": false,
          "title": "Chinacom",
          "esim_type": "Prepaid",
          "warning": null,
          "apn_type": "manual",
          "apn_value": "globaldata",
          "is_roaming": true,
          "info": [
            "5G Data-only eSIM.",
            "Rechargeable online with no expiry.",
            "Operates on the China Mobile network in China."
          ],
          "image": {
            "width": 1035,
            "height": 653,
            "url": "https://cdn.airalo.com/images/0859ba94-c5af-417c-b366-51e1420d7308.png"
          },
          "plan_type": "data",
          "activation_policy": "first-usage",
          "is_kyc_verify": false,
          "rechargeability": false,
          "other_info": null,
          "coverages": [
            {
              "name": "CN",
              "code": "CN",
              "networks": [
                {
                  "name": "China Mobile",
                  "types": [
                    "5G"
                  ]
                }
              ]
            }
          ],
          "install_window_days": null,
          "topup_grace_window_days": null,
          "apn": {
            "ios": {
              "apn_type": "automatic",
              "apn_value": "globaldata"
            },
            "android": {
              "apn_type": "manual",
              "apn_value": "globaldata"
            }
          },
          "packages": [
            {
              "id": "chinam-mobile-10days-unlimited",
              "type": "sim",
              "price": 35,
              "amount": 0,
              "day": 10,
              "is_unlimited": true,
              "title": "Unlimited - 10 Days",
              "short_info": null,
              "qr_installation": "<p><b>eSIM name:</b> Chinacom</p><p><b>Coverage: </b>China</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Locate the APN settings in your settings menu.</li><li>Update the APN to \"globaldata\".</li><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p>",
              "manual_installation": "<p><b>eSIM name:</b> Chinacom</p><p><b>Coverage: </b>China</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Locate the APN settings in your settings menu.</li><li>Update the APN to \"globaldata\".</li><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p><p><br></p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "Unlimited",
              "voice": null,
              "text": null,
              "net_price": 25,
              "prices": {
                "net_price": {
                  "AUD": 39,
                  "BRL": 142.25,
                  "GBP": 18.5,
                  "CAD": 34.75,
                  "AED": 91.75,
                  "EUR": 22.25,
                  "INR": 2135.5,
                  "IDR": 407274,
                  "ILS": 87.75,
                  "JPY": 3643,
                  "MYR": 105.75,
                  "MXN": 484.75,
                  "SGD": 32.25,
                  "KRW": 34364,
                  "USD": 25,
                  "VND": 648545
                },
                "recommended_retail_price": {
                  "AUD": 54.6,
                  "BRL": 199.15,
                  "GBP": 25.9,
                  "CAD": 48.65,
                  "AED": 128.45,
                  "EUR": 31.15,
                  "INR": 2989.7,
                  "IDR": 570183,
                  "ILS": 122.85,
                  "JPY": 5101,
                  "MYR": 148.05,
                  "MXN": 678.65,
                  "SGD": 45.15,
                  "KRW": 48110,
                  "USD": 35,
                  "VND": 907963
                }
              }
            }
          ],
          "countries": [
            {
              "country_code": "CN",
              "title": "China",
              "image": {
                "width": 132,
                "height": 99,
                "url": "https://cdn.airalo.com/images/301616a0-cd3e-4151-a4ec-78c8ddb04ca9.png"
              }
            }
          ]
        },
        {
          "id": 4,
          "style": "light",
          "gradient_start": "#ff2d2f",
          "gradient_end": "#de2627",
          "type": "local",
          "is_prepaid": false,
          "title": "Chinacom",
          "esim_type": "Prepaid",
          "warning": null,
          "apn_type": "manual",
          "apn_value": "globaldata",
          "is_roaming": true,
          "info": [
            "5G Data-only eSIM.",
            "Rechargeable online with no expiry.",
            "Operates on the China Mobile network in China."
          ],
          "image": {
            "width": 1035,
            "height": 653,
            "url": "https://cdn.airalo.com/images/3834f175-be96-49c8-b4ab-91196e135037.png"
          },
          "plan_type": "data",
          "activation_policy": "first-usage",
          "is_kyc_verify": false,
          "rechargeability": true,
          "other_info": null,
          "coverages": [
            {
              "name": "CN",
              "code": "CN",
              "networks": [
                {
                  "name": "China Mobile",
                  "types": [
                    "5G"
                  ]
                }
              ]
            }
          ],
          "install_window_days": null,
          "topup_grace_window_days": null,
          "apn": {
            "ios": {
              "apn_type": "automatic",
              "apn_value": "globaldata"
            },
            "android": {
              "apn_type": "manual",
              "apn_value": "globaldata"
            }
          },
          "packages": [
            {
              "id": "chinacom-30days-20gb",
              "type": "sim",
              "price": 49,
              "amount": 20480,
              "day": 30,
              "is_unlimited": false,
              "title": "20 GB - 30 Days",
              "short_info": null,
              "qr_installation": "<p><b>eSIM name:</b> Chinacom</p><p><b>Coverage: </b>China</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Locate the APN settings in your settings menu.</li><li>Update the APN to \"globaldata\".</li><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p>",
              "manual_installation": "<p><b>eSIM name:</b> Chinacom</p><p><b>Coverage: </b>China</p><p><b>To manually activate the eSIM on your eSIM capable device:</b><br></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Locate the APN settings in your settings menu.</li><li>Update the APN to \"globaldata\".</li><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "20 GB",
              "voice": null,
              "text": null,
              "net_price": 18.5,
              "prices": {
                "net_price": {
                  "AUD": 28.86,
                  "BRL": 105.26,
                  "GBP": 13.69,
                  "CAD": 25.72,
                  "AED": 67.9,
                  "EUR": 16.46,
                  "INR": 1580.27,
                  "IDR": 301383,
                  "ILS": 64.94,
                  "JPY": 2696,
                  "MYR": 78.26,
                  "MXN": 358.72,
                  "SGD": 23.86,
                  "KRW": 25430,
                  "USD": 18.5,
                  "VND": 479923
                },
                "recommended_retail_price": {
                  "AUD": 76.44,
                  "BRL": 278.81,
                  "GBP": 36.26,
                  "CAD": 68.11,
                  "AED": 179.83,
                  "EUR": 43.61,
                  "INR": 4185.58,
                  "IDR": 798257,
                  "ILS": 171.99,
                  "JPY": 7141,
                  "MYR": 207.27,
                  "MXN": 950.11,
                  "SGD": 63.21,
                  "KRW": 67354,
                  "USD": 49,
                  "VND": 1271148
                }
              }
            },
            {
              "id": "chinacom-30days-10gb",
              "type": "sim",
              "price": 28,
              "amount": 10240,
              "day": 30,
              "is_unlimited": false,
              "title": "10 GB - 30 Days",
              "short_info": null,
              "qr_installation": "<p><b>eSIM name:</b> Chinacom</p><p><b>Coverage: </b>China</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Locate the APN settings in your settings menu.</li><li>Update the APN to \"globaldata\".</li><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p>",
              "manual_installation": "<p><b>eSIM name:</b> Chinacom</p><p><b>Coverage: </b>China</p><p><b>To manually activate the eSIM on your eSIM capable device:</b><br></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Locate the APN settings in your settings menu.</li><li>Update the APN to \"globaldata\".</li><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "10 GB",
              "voice": null,
              "text": null,
              "net_price": 10,
              "prices": {
                "net_price": {
                  "AUD": 15.6,
                  "BRL": 56.9,
                  "GBP": 7.4,
                  "CAD": 13.9,
                  "AED": 36.7,
                  "EUR": 8.9,
                  "INR": 854.2,
                  "IDR": 162910,
                  "ILS": 35.1,
                  "JPY": 1457,
                  "MYR": 42.3,
                  "MXN": 193.9,
                  "SGD": 12.9,
                  "KRW": 13746,
                  "USD": 10,
                  "VND": 259418
                },
                "recommended_retail_price": {
                  "AUD": 43.68,
                  "BRL": 159.32,
                  "GBP": 20.72,
                  "CAD": 38.92,
                  "AED": 102.76,
                  "EUR": 24.92,
                  "INR": 2391.76,
                  "IDR": 456147,
                  "ILS": 98.28,
                  "JPY": 4080,
                  "MYR": 118.44,
                  "MXN": 542.92,
                  "SGD": 36.12,
                  "KRW": 38488,
                  "USD": 28,
                  "VND": 726370
                }
              }
            },
            {
              "id": "chinacom-30days-5gb",
              "type": "sim",
              "price": 16.5,
              "amount": 5120,
              "day": 30,
              "is_unlimited": false,
              "title": "5 GB - 30 Days",
              "short_info": "This eSIM doesn't come with a phone number.",
              "qr_installation": "<p><b>eSIM name:</b> Chinacom</p><p><b>Coverage: </b>China</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Locate the APN settings in your settings menu.</li><li>Update the APN to \"globaldata\".</li><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p>",
              "manual_installation": "<p><b>eSIM name:</b> Chinacom</p><p><b>Coverage: </b>China</p><p><b>To manually activate the eSIM on your eSIM capable device:</b><br></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Locate the APN settings in your settings menu.</li><li>Update the APN to \"globaldata\".</li><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "5 GB",
              "voice": null,
              "text": null,
              "net_price": 5,
              "prices": {
                "net_price": {
                  "AUD": 7.8,
                  "BRL": 28.45,
                  "GBP": 3.7,
                  "CAD": 6.95,
                  "AED": 18.35,
                  "EUR": 4.45,
                  "INR": 427.1,
                  "IDR": 81455,
                  "ILS": 17.55,
                  "JPY": 729,
                  "MYR": 21.15,
                  "MXN": 96.95,
                  "SGD": 6.45,
                  "KRW": 6873,
                  "USD": 5,
                  "VND": 129709
                },
                "recommended_retail_price": {
                  "AUD": 25.74,
                  "BRL": 93.88,
                  "GBP": 12.21,
                  "CAD": 22.94,
                  "AED": 60.56,
                  "EUR": 14.68,
                  "INR": 1409.43,
                  "IDR": 268801,
                  "ILS": 57.92,
                  "JPY": 2405,
                  "MYR": 69.8,
                  "MXN": 319.94,
                  "SGD": 21.28,
                  "KRW": 22680,
                  "USD": 16.5,
                  "VND": 428040
                }
              }
            },
            {
              "id": "chinacom-30days-3gb",
              "type": "sim",
              "price": 11.5,
              "amount": 3072,
              "day": 30,
              "is_unlimited": false,
              "title": "3 GB - 30 Days",
              "short_info": "This eSIM doesn't come with a phone number.",
              "qr_installation": "<p><b>eSIM name:</b> Chinacom</p><p><b>Coverage: </b>China</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Locate the APN settings in your settings menu.</li><li>Update the APN to \"globaldata\".</li><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p>",
              "manual_installation": "<p><b>eSIM name:</b> Chinacom</p><p><b>Coverage: </b>China</p><p><b>To manually activate the eSIM on your eSIM capable device:</b><br></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Locate the APN settings in your settings menu.</li><li>Update the APN to \"globaldata\".</li><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "3 GB",
              "voice": null,
              "text": null,
              "net_price": 3.2,
              "prices": {
                "net_price": {
                  "AUD": 4.99,
                  "BRL": 18.21,
                  "GBP": 2.37,
                  "CAD": 4.45,
                  "AED": 11.74,
                  "EUR": 2.85,
                  "INR": 273.34,
                  "IDR": 52131,
                  "ILS": 11.23,
                  "JPY": 466,
                  "MYR": 13.54,
                  "MXN": 62.05,
                  "SGD": 4.13,
                  "KRW": 4399,
                  "USD": 3.2,
                  "VND": 83014
                },
                "recommended_retail_price": {
                  "AUD": 17.94,
                  "BRL": 65.44,
                  "GBP": 8.51,
                  "CAD": 15.98,
                  "AED": 42.2,
                  "EUR": 10.24,
                  "INR": 982.33,
                  "IDR": 187346,
                  "ILS": 40.36,
                  "JPY": 1676,
                  "MYR": 48.64,
                  "MXN": 222.98,
                  "SGD": 14.84,
                  "KRW": 15808,
                  "USD": 11.5,
                  "VND": 298331
                }
              }
            },
            {
              "id": "chinacom-15days-2gb",
              "type": "sim",
              "price": 8.5,
              "amount": 2048,
              "day": 15,
              "is_unlimited": false,
              "title": "2 GB - 15 Days",
              "short_info": null,
              "qr_installation": "<p><b>eSIM name:</b> Chinacom</p><p><b>Coverage: </b>China</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Locate the APN settings in your settings menu.</li><li>Update the APN to \"globaldata\".</li><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p>",
              "manual_installation": "<p><b>eSIM name:</b> Chinacom</p><p><b>Coverage: </b>China</p><p><b>To manually activate the eSIM on your eSIM capable device:</b><br></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Locate the APN settings in your settings menu.</li><li>Update the APN to \"globaldata\".</li><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "2 GB",
              "voice": null,
              "text": null,
              "net_price": 2.3,
              "prices": {
                "net_price": {
                  "AUD": 3.59,
                  "BRL": 13.09,
                  "GBP": 1.7,
                  "CAD": 3.2,
                  "AED": 8.44,
                  "EUR": 2.05,
                  "INR": 196.47,
                  "IDR": 37469,
                  "ILS": 8.07,
                  "JPY": 335,
                  "MYR": 9.73,
                  "MXN": 44.6,
                  "SGD": 2.97,
                  "KRW": 3162,
                  "USD": 2.3,
                  "VND": 59666
                },
                "recommended_retail_price": {
                  "AUD": 13.26,
                  "BRL": 48.36,
                  "GBP": 6.29,
                  "CAD": 11.82,
                  "AED": 31.2,
                  "EUR": 7.56,
                  "INR": 726.07,
                  "IDR": 138473,
                  "ILS": 29.84,
                  "JPY": 1239,
                  "MYR": 35.96,
                  "MXN": 164.82,
                  "SGD": 10.96,
                  "KRW": 11684,
                  "USD": 8.5,
                  "VND": 220505
                }
              }
            },
            {
              "id": "chinacom-7days-1gb",
              "type": "sim",
              "price": 5,
              "amount": 1024,
              "day": 7,
              "is_unlimited": false,
              "title": "1 GB - 7 Days",
              "short_info": "This eSIM doesn't come with a phone number.",
              "qr_installation": "<p><b>eSIM name:</b> Chinacom</p><p><b>Coverage: </b>China</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Locate the APN settings in your settings menu.</li><li>Update the APN to \"globaldata\".</li><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p>",
              "manual_installation": "<p><b>eSIM name:</b> Chinacom</p><p><b>Coverage: </b>China</p><p><b>To manually activate the eSIM on your eSIM capable device:</b><br></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Locate the APN settings in your settings menu.</li><li>Update the APN to \"globaldata\".</li><li>Enable data roaming.</li></ol><p><b>To top up:</b></p><p>Visit airalo.com/my-esims or if purchased through the Airalo website/app visit “My eSIMs” tab.</p>",
              "is_fair_usage_policy": false,
              "fair_usage_policy": null,
              "data": "1 GB",
              "voice": null,
              "text": null,
              "net_price": 1.2,
              "prices": {
                "net_price": {
                  "AUD": 1.87,
                  "BRL": 6.83,
                  "GBP": 0.89,
                  "CAD": 1.67,
                  "AED": 4.4,
                  "EUR": 1.07,
                  "INR": 102.5,
                  "IDR": 19549,
                  "ILS": 4.21,
                  "JPY": 175,
                  "MYR": 5.08,
                  "MXN": 23.27,
                  "SGD": 1.55,
                  "KRW": 1649,
                  "USD": 1.2,
                  "VND": 31130
                },
                "recommended_retail_price": {
                  "AUD": 7.8,
                  "BRL": 28.45,
                  "GBP": 3.7,
                  "CAD": 6.95,
                  "AED": 18.35,
                  "EUR": 4.45,
                  "INR": 427.1,
                  "IDR": 81455,
                  "ILS": 17.55,
                  "JPY": 729,
                  "MYR": 21.15,
                  "MXN": 96.95,
                  "SGD": 6.45,
                  "KRW": 6873,
                  "USD": 5,
                  "VND": 129709
                }
              }
            }
          ],
          "countries": [
            {
              "country_code": "CN",
              "title": "China",
              "image": {
                "width": 132,
                "height": 99,
                "url": "https://cdn.airalo.com/images/301616a0-cd3e-4151-a4ec-78c8ddb04ca9.png"
              }
            }
          ]
        }
      ]
    }
  ],
  "links": {
    "first": "https://partners-api.airalo.com/v2/packages?limit=3&language=en&page=1",
    "last": "https://partners-api.airalo.com/v2/packages?limit=3&language=en&page=71",
    "prev": null,
    "next": "https://partners-api.airalo.com/v2/packages?limit=3&language=en&page=2"
  },
  "meta": {
    "message": "success",
    "current_page": 1,
    "from": 1,
    "last_page": 71,
    "path": "https://partners-api.airalo.com/v2/packages",
    "per_page": "3",
    "to": 3,
    "total": 211
  }
}
```

> 422 Response

```json
{
  "data": {
    "limit": "The limit must be an integer."
  },
  "meta": {
    "message": "the parameter is invalid"
  }
}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|
|422|[Unprocessable Entity](https://tools.ietf.org/html/rfc2518#section-10.3)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|[object]|true|none||none|
|»» slug|string|true|none||none|
|»» country_code|string|true|none||none|
|»» title|string|true|none||none|
|»» image|object|true|none||none|
|»»» width|integer|true|none||none|
|»»» height|integer|true|none||none|
|»»» url|string|true|none||none|
|»» operators|[object]|true|none||none|
|»»» id|integer|true|none||none|
|»»» style|string|true|none||none|
|»»» gradient_start|string|true|none||none|
|»»» gradient_end|string|true|none||none|
|»»» type|string|true|none||none|
|»»» is_prepaid|boolean|true|none||none|
|»»» title|string|true|none||none|
|»»» esim_type|string|true|none||none|
|»»» warning|null|true|none||none|
|»»» apn_type|string|true|none||none|
|»»» apn_value|string¦null|true|none||none|
|»»» is_roaming|boolean|true|none||none|
|»»» info|[string]|true|none||none|
|»»» image|object|true|none||none|
|»»»» width|integer|true|none||none|
|»»»» height|integer|true|none||none|
|»»»» url|string|true|none||none|
|»»» plan_type|string|true|none||none|
|»»» activation_policy|string|true|none||none|
|»»» is_kyc_verify|boolean|true|none||none|
|»»» rechargeability|boolean|true|none||none|
|»»» other_info|string¦null|true|none||none|
|»»» coverages|[object]|true|none||none|
|»»»» name|string|true|none||none|
|»»»» code|string|true|none||none|
|»»»» networks|[object]|true|none||none|
|»»»»» name|string|true|none||none|
|»»»»» types|[string]|true|none||none|
|»»» install_window_days|integer¦null|true|none||The # of days from when an eSIM is bought from operator until it can be installed on a device. If this time passes - the sim is recycled and gone (cannot be used/ topped up)|
|»»» topup_grace_window_days|integer¦null|true|none||The # of days from when an eSIM is exhausted or expired until a topup is bought. If this period passes and no topup is bought, the sim is recycled and can no longer be topped up. Note that after each topup this period restarts.|
|»»» apn|object|true|none||none|
|»»»» ios|object|true|none||none|
|»»»»» apn_type|string|true|none||none|
|»»»»» apn_value|string¦null|true|none||none|
|»»»» android|object|true|none||none|
|»»»»» apn_type|string|true|none||none|
|»»»»» apn_value|string¦null|true|none||none|
|»»» packages|[object]|true|none||none|
|»»»» id|string|true|none||none|
|»»»» type|string|true|none||none|
|»»»» price|number|true|none||none|
|»»»» amount|integer|true|none||none|
|»»»» day|integer|true|none||none|
|»»»» is_unlimited|boolean|true|none||none|
|»»»» title|string|true|none||none|
|»»»» short_info|string¦null|true|none||none|
|»»»» qr_installation|string|true|none||none|
|»»»» manual_installation|string|true|none||none|
|»»»» is_fair_usage_policy|boolean¦null|true|none||none|
|»»»» fair_usage_policy|string¦null|true|none||none|
|»»»» data|string|true|none||none|
|»»»» voice|integer¦null|true|none||none|
|»»»» text|integer¦null|true|none||none|
|»»»» net_price|number|true|none||none|
|»»»» prices|object|true|none||none|
|»»»»» net_price|object|true|none||none|
|»»»»»» AUD|number|true|none||none|
|»»»»»» BRL|number|true|none||none|
|»»»»»» GBP|number|true|none||none|
|»»»»»» CAD|number|true|none||none|
|»»»»»» AED|number|true|none||none|
|»»»»»» EUR|number|true|none||none|
|»»»»»» INR|number|true|none||none|
|»»»»»» IDR|integer|true|none||none|
|»»»»»» ILS|number|true|none||none|
|»»»»»» JPY|integer|true|none||none|
|»»»»»» MYR|number|true|none||none|
|»»»»»» MXN|number|true|none||none|
|»»»»»» SGD|number|true|none||none|
|»»»»»» KRW|integer|true|none||none|
|»»»»»» USD|number|true|none||none|
|»»»»»» VND|integer|true|none||none|
|»»»»» recommended_retail_price|object|true|none||none|
|»»»»»» AUD|number|true|none||none|
|»»»»»» BRL|number|true|none||none|
|»»»»»» GBP|number|true|none||none|
|»»»»»» CAD|number|true|none||none|
|»»»»»» AED|number|true|none||none|
|»»»»»» EUR|integer|true|none||none|
|»»»»»» INR|number|true|none||none|
|»»»»»» IDR|integer|true|none||none|
|»»»»»» ILS|number|true|none||none|
|»»»»»» JPY|integer|true|none||none|
|»»»»»» MYR|number|true|none||none|
|»»»»»» MXN|number|true|none||none|
|»»»»»» SGD|number|true|none||none|
|»»»»»» KRW|integer|true|none||none|
|»»»»»» USD|number|true|none||none|
|»»»»»» VND|integer|true|none||none|
|»»» countries|[object]|true|none||none|
|»»»» country_code|string|true|none||none|
|»»»» title|string|true|none||none|
|»»»» image|object|true|none||none|
|»»»»» width|integer|true|none||none|
|»»»»» height|integer|true|none||none|
|»»»»» url|string|true|none||none|
|» links|object|true|none||none|
|»» first|string|true|none||none|
|»» last|string|true|none||none|
|»» prev|null|true|none||none|
|»» next|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|
|»» current_page|integer|true|none||none|
|»» from|integer|true|none||none|
|»» last_page|integer|true|none||none|
|»» path|string|true|none||none|
|»» per_page|string|true|none||none|
|»» to|integer|true|none||none|
|»» total|integer|true|none||none|

HTTP Status Code **422**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» limit|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

# REST API/Endpoints/Place order

## POST Submit order

POST /v2/orders

This endpoint allows you to submit an order to the Airalo Partner API by providing the required parameters, such as `package_id` and `quantity`. You may also include an optional `description` field to track your internal order ID or add any relevant notes related to the order.

For more information and best practices, visit our [FAQ page](https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ).

When submitting the order, the response includes the field `direct_apple_installation_url` with installation instructions that now provide Apple’s universal link, enabling direct installation on devices running iOS 17.4 or later for a smoother user experience.

You can also provide your user’s email address using the `to_email` parameter, which will send an email to your user asynchronously. The email uses a white-label template powered by our eSIM cloud feature. It provides your users with a link to access and install the eSIM, includes installation instructions, and supports multiple languages. 

<img src="https://lh3.googleusercontent.com/pw/AP1GczN6x9C8NVgjy_sptiiYf262zSJWxwWu1lgCss0YNHnw8s1FJeqECe2kCCXxy9BwJkaKM8v-ADXnILoeREKxQxYjUU55qapXoGsHIUtajxf_ARivNHVWSpzw0oQoyVmEpTNPq_AdIXGBMQmU5eS2cq1F=w504-h600-s-no-gm" style="border: 1px solid lightgrey;"/>

> Body Parameters

```yaml
quantity: "1"
package_id: kallur-digital-7days-1gb
type: sim
description: 1 sim kallur-digital-7days-1gb
brand_settings_name: our perfect brand
to_email: valid_email@address.com
"sharing_option[]": link
"copy_address[]": valid_email@address.com

```

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|Accept|header|string| yes |none|
|Authorization|header|string| yes |none|
|body|body|object| no |none|
|» quantity|body|string| yes |Required. The quantity of items in the order. Maximum of 50.|
|» package_id|body|string| yes |Required. The package ID associated with the order. You can obtain this from the "Packages / Get Packages" endpoint.|
|» type|body|string| yes |Optional. The only possible value for this endpoint is "sim". If left empty, default "sim" value will be used.|
|» description|body|string| yes |Optional. A custom description for the order, which can help you identify it later.|
|» brand_settings_name|body|string| yes |Nullable. The definition under what brand the eSIM should be shared. Null for unbranded.|
|» to_email|body|string| yes |Optional. If specified, email with esim sharing will be sent. sharing_option should be specified as well.|
|» sharing_option[]|body|string| yes |Optional. Array. Required when to_email is set. Available options: link, pdf|
|» copy_address[]|body|string| yes |Optional. Array. It uses when to_email is set.|

> Response Examples

```json
{
  "data": {
    "package_id": "kallur-digital-7days-1gb",
    "quantity": "1",
    "type": "sim",
    "description": "Example description to identify the order",
    "esim_type": "Prepaid",
    "validity": 7,
    "package": "Kallur Digital-1 GB - 7 Days",
    "data": "1 GB",
    "price": 9.5,
    "created_at": "2023-02-27 14:09:55",
    "id": 9666,
    "code": "20230227-009666",
    "currency": "USD",
    "manual_installation": "<p><b>eSIM name: </b>Kallur Digital</p><p><b>Coverage:</b> Faroe Islands</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><p>1. Settings> Cellular/Mobile> Add Cellular/Mobile Plan.</p><p>2. Manually enter the SM-DP+ Address and activation code.</p><p>3. Confirm the eSIM plan details</p><p>4. Label the eSIM.</p><p><b>To access Data:</b></p><p>1. Enable data roaming.</p><p><b>To top-up:</b></p><p></p><p>Visit airalo.com/my-esims or \"My eSIMs\" tab in your Airaloo app.</p><p><br></p>",
    "qrcode_installation": "<p><b>eSIM name:</b> Kallur Digital</p><p><b>Coverage: </b>Faroe Islands</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><p>1. Settings> Cellular/Mobile> Add Cellular/Mobile Plan.</p><p>2. Scan QR code</p><p>3. Confirm the eSIM plan details</p><p>4. Label the eSIM</p><p><b>To access Data:</b></p><p>1. Enable data roaming</p>",
    "installation_guides": {
      "en": "https://sandbox.airalo.com/installation-guide"
    },
    "brand_settings_name": "our perfect brand",
    "sims": [
      {
        "id": 11047,
        "created_at": "2023-02-27 14:09:55",
        "iccid": "891000000000009125",
        "lpa": "lpa.airalo.com",
        "imsis": null,
        "matching_id": "TEST",
        "qrcode": "LPA:1$lpa.airalo.com$TEST",
        "qrcode_url": "https://sandbox.airalo.com/qr?expires=1763820595&id=13301&signature=1f0d45226a3857bd0645bf77225b7aee7e250f926763ee1d1a6e4be7fefde71e",
        "direct_apple_installation_url": "https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$wbg.prod.ondemandconnectivity.com$Y7MRQ886FCDJD4RH",
        "airalo_code": null,
        "apn_type": "automatic",
        "apn_value": null,
        "is_roaming": true,
        "confirmation_code": null
      }
    ]
  },
  "meta": {
    "message": "success"
  }
}
```

```json
{
  "data": {
    "id": 583747,
    "code": "20250415-583747",
    "currency": "USD",
    "package_id": "uki-mobile-15days-2gb",
    "quantity": 1,
    "type": "sim",
    "description": "Example description to identify the order",
    "esim_type": "Prepaid",
    "validity": 15,
    "package": "Uki Mobile-2 GB - 15 Days",
    "data": "2 GB",
    "price": 7.5,
    "created_at": "2025-04-15 14:02:38",
    "manual_installation": "<p><br></p><p><b>eSIM name:</b> Uki Mobile<br></p><p><br></p><p><b>Coverage: </b>United Kingdom</p><p><br></p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><p><br></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><br></p><p><b>To access Data:</b></p><p><br></p><ol><li>Enable data roaming.</li></ol><p><br></p>",
    "qrcode_installation": "<p><br></p><p><b>eSIM name:</b> Uki Mobile<br></p><p><br></p><p><b>Coverage: </b>United Kingdom<br></p><p><br></p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><p><br></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><br></p><p><b>To access Data:</b></p><p><br></p><ol><li>Enable data roaming.</li></ol><p><br></p>",
    "installation_guides": {
      "en": "https://www.airalo.com/help/getting-started-with-airalo"
    },
    "text": null,
    "voice": null,
    "net_price": 1.6,
    "brand_settings_name": "Brand Test Production",
    "sims": [
      {
        "id": 709006,
        "created_at": "2025-04-15 14:02:38",
        "iccid": "8944465400003573253",
        "lpa": "RSP-3088.IDEMIA.IO",
        "imsis": null,
        "matching_id": "YVTGM-5LZC6-PIC56-KFEZJ",
        "qrcode": "LPA:1$RSP-3088.IDEMIA.IO$YVTGM-5LZC6-PIC56-KFEZJ",
        "qrcode_url": "https://www.airalo.com/qr?expires=1831039358&id=43113221&signature=dedf8d95a5d931e521527cf687aba8bd37da50fe9d63ba913188c31634792fb4",
        "airalo_code": null,
        "apn_type": "manual",
        "apn_value": "globaldata",
        "is_roaming": true,
        "confirmation_code": null,
        "apn": {
          "ios": {
            "apn_type": "automatic",
            "apn_value": "globaldata"
          },
          "android": {
            "apn_type": "manual",
            "apn_value": "globaldata"
          }
        },
        "msisdn": "883190601604295",
        "direct_apple_installation_url": "https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$RSP-3088.IDEMIA.IO$YVTGM-5LZC6-PIC56-KFEZJ"
      }
    ]
  },
  "meta": {
    "message": "success"
  }
}
```

> 422 Response

```json
{
  "data": {
    "package_id": "The selected package is invalid.",
    "quantity": "The quantity may not be greater than 50."
  },
  "meta": {
    "message": "the parameter is invalid"
  }
}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|
|422|[Unprocessable Entity](https://tools.ietf.org/html/rfc2518#section-10.3)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» package_id|string|true|none||none|
|»» quantity|string|true|none||none|
|»» type|string|true|none||none|
|»» description|string|true|none||none|
|»» esim_type|string|true|none||none|
|»» validity|integer|true|none||none|
|»» package|string|true|none||none|
|»» data|string|true|none||none|
|»» price|number|true|none||none|
|»» created_at|string|true|none||none|
|»» id|integer|true|none||none|
|»» code|string|true|none||none|
|»» currency|string|true|none||none|
|»» manual_installation|string|true|none||none|
|»» qrcode_installation|string|true|none||none|
|»» installation_guides|object|true|none||none|
|»»» en|string|true|none||none|
|»» brand_settings_name|string|true|none||none|
|»» sims|[object]|true|none||none|
|»»» id|integer|false|none||none|
|»»» created_at|string|false|none||none|
|»»» iccid|string|false|none||none|
|»»» lpa|string|false|none||none|
|»»» imsis|null|false|none||none|
|»»» matching_id|string|false|none||none|
|»»» qrcode|string|false|none||none|
|»»» qrcode_url|string|false|none||none|
|»»» direct_apple_installation_url|string|false|none||none|
|»»» airalo_code|null|false|none||none|
|»»» apn_type|string|false|none||none|
|»»» apn_value|null|false|none||none|
|»»» is_roaming|boolean|false|none||none|
|»»» confirmation_code|null|false|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

HTTP Status Code **422**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» package_id|string|true|none||none|
|»» quantity|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

## POST Submit order async

POST /v2/orders-async

This endpoint allows you to submit an asynchronous order to the Airalo Partners API. This ensures greater performance and reduces the wait time for your desired flow. Each async order will generate unique `nanoid` stored in reponse's `request_id` - Make sure you store this id in your system, as it is a reference for the order which is pending processing. You should check map it for every successfully received order response on your webhook url.  

Provide the required information, such as quantity and package ID, and include optional description if needed.

The access token, obtained from the "Request Access Token" endpoint, should be included in the request.

For more informations, best practices visit our FAQ page: [https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ](https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ)

**direct_apple_installation_url:**

Partner API now supports direct installation on iOS devices. With the introduction of Universal Links by Apple, users with iOS 17.4 or higher can directly install eSIMs using a special URL, which can be provided to your end clients if they are using iOS version 17.4 or above.

> Body Parameters

```yaml
quantity: "1"
package_id: kallur-digital-7days-1gb
type: sim
description: 1 sim kallur-digital-7days-1gb
webhook_url: https://your-webhook.com

```

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|Accept|header|string| yes |none|
|Authorization|header|string| yes |none|
|body|body|object| no |none|
|» quantity|body|string| yes |Required. The quantity of items in the order. Maximum of 50.|
|» package_id|body|string| yes |Required. The package ID associated with the order. You can obtain this from the "Packages / Get Packages" endpoint.|
|» type|body|string| yes |Optional. The only possible value for this endpoint is "sim". If left empty, default "sim" value will be used.|
|» description|body|string| yes |Optional. A custom description for the order, which can help you identify it later.|
|» webhook_url|body|string| yes |Optional. A custom, valid url to which you will receive the order details data asynchronously. Note that you can optin or provide in request. `The webhook_url if provided in payload will overwrite the one which is opted in.`|

> Response Examples

> 200 Response

```
{}
```

> 202 Response

```json
{
  "data": {
    "request_id": "3NhR3gKmqCWK7IWppurpDX3Cg",
    "accepted_at": "2024-07-11 15:26:02"
  },
  "meta": {
    "message": "success"
  }
}
```

> 422 Response

```json
{
  "data": {
    "package_id": "The selected package is invalid.",
    "quantity": "The quantity may not be greater than 50."
  },
  "meta": {
    "message": "the parameter is invalid"
  }
}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|
|202|[Accepted](https://tools.ietf.org/html/rfc7231#section-6.3.3)|none|Inline|
|422|[Unprocessable Entity](https://tools.ietf.org/html/rfc2518#section-10.3)|none|Inline|

### Responses Data Schema

HTTP Status Code **202**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» request_id|string|true|none||none|
|»» accepted_at|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

HTTP Status Code **422**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» package_id|string|true|none||none|
|»» quantity|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

## POST Future orders

POST /v2/future-orders

This endpoint allows you to submit an order to the Airalo Partner API, which will be created on the specified due date.

To proceed, provide the required information:
- Due date
- Quantity
- Package ID
- Description (optional)

Please note:
- On success, the endpoint response will include a unique 25-character request_id.
- You must store this value in your system to cancel the order later if needed and to know for which order you got a response on your webhook URL.
- An access token from the "Request Access Token" endpoint is required in the request.

**Delivery modes**
**What is a webhook URL?**
Webhook URL is a URL that is configured on your domain and your won webserver.
That URL should be able to receive HTTP POST requests with your order data that will be sent from our servers .
NOTE: We check the liveness of your webhook URL with an HTTP HEAD request to which we expect 200 OK response.

**What happens when the due date arrives?**
When the due date arrives your order is processed and the order details are sent as a POST HTTP request to 
either your opted in "async_orders" notification type url (more info [here](https://partner-api-airalo.apidog.io/async-orders-11883038e0) )
or on the "webhhok_url" optional parameter of this endpoint which overrides the above opted in URL.
NOTE that you must have one of the above (either opted in URL or webhhok_url) provided in order to make a future order.

if you provide the optional parameter "sharing_option", which goes together with the "to_email" parameter 
then an email with the eSim details will also be sent to the email provided in the "to_email" parameter as well.
Depending from the selected sharing option which can be one of link or pdf or both you will get the eSim data 
either in a PDF format attached to the email or as a link.

**What is the format of the message that is sent to the webhook URL?**
The format of the message that is sent to the webhook URL is the same as the response of the [regular order](https://partner-api-airalo.apidog.io/submit-order-11883024e0).
It only has one additional parameter named "request_id" which is the same request_id that you got in the response 
when you made the future order at the time of making the order, 
so that you know for which future order you got details on your webhook URL.

For more details and best practices, visit our [FAQ page](https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ).

**SANBOX MODE**

NOTE that this endpoint has a slightly different behaviour in sandbox mode.
Here are the differences.
1. In sandbox mode the future orders will not be processed on the actual due date but they will be processed immediatelly upon submission.
2. Because the future orders are not processed on the due date, their status is always processed so in order to simulate future orders with other statuses there are 3 special packages for that. Here are the pacakges with the explanations:
    - `test-create-pending-future-order-7days-1gb` - special package for creating a future order with pending status
    - `test-create-failed-future-order-7days-1gb` - special package for creating a future order with failed status
    - `test-create-retry-future-order-7days-1gb` - special package for creating a future order with retry status 

By using the packages above future orders with the above statuses can be created and the `request_id` from those orders can be used to test the [cancel future order API](https://app.apidog.com/link/project/742850/apis/api-14459873) to cancel the future order.

By using the above packages you can also test the [GET future orders API Endpoint](https://app.apidog.com/link/project/742850/apis/api-21307288?branchId=1052533) to test the filters as well.

> Body Parameters

> Request with "webhook_url"
With this request a future order will be created that will be processed on date 2025-04-09 10:00 and when the ordfer is complete the order details will be delivered to the URL provided in the "webhook_url" parameter. 
NOTE that this URL is a URL that is hosted by your webserver.

```json
{
  "quantity": 1,
  "package_id": "change-7days-1gb",
  "due_date": "2025-04-09 10:00",
  "description": "Just a future order ..",
  "webhook_url": "http://somePartnerDomain.com/webhook-url-path-to-wait-for-the order-details"
}
```

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|Accept|header|string| yes |none|
|Authorization|header|string| yes |none|
|body|body|object| no |none|
|» quantity|body|integer| yes |The quantity of items in the order. Maximum of 50.|
|» package_id|body|string| yes |Required. The package ID associated with the order. You can obtain this from the "Packages / Get Packages" endpoint.|
|» due_date|body|string(date-time)| yes |Required. Date and time string field in the format YYYY-MM-DD HH:MM. This date must be minimum two days in the future from current time and maximum 1 year in the future. The order processing starts at the moment the due date arrives.|
|» to_email|body|string| no |If specified, email with esim sharing will be sent. sharing_option should be specified as well.|
|» sharing_option|body|[string]| no |Array. Required when to_email is set. Available options: link, pdf|
|» copy_address|body|string| no |Array. It is used when to_email is set.|
|» webhook_url|body|string| no |Optional. A custom, valid url to which you will receive the order details data asynchronously. Note that you can optin or provide in request. The webhook_url if provided in payload will overwrite the one which is opted in.|
|» description|body|string| no |Optional. A custom description for the order, which can help you identify it later.|
|» brand_settings_name|body|string¦null| no |Nullable. The definition under what brand the eSIM should be shared. Null for unbranded.|

#### Enum

|Name|Value|
|---|---|
|» sharing_option|link|
|» sharing_option|pdf|

> Response Examples

> 200 Response

```json
{
  "data": {
    "request_id": "9HrK4-KGgz8n71eGgdNS5cV7Y",
    "due_date": "2025-03-28 10:00",
    "latest_cancellation_date": "2025-03-27 10:00"
  },
  "meta": {
    "message": "success"
  }
}
```

> 422 Response

```json
{
  "data": {
    "quantity": "The quantity must be at least 1."
  },
  "meta": {
    "message": "the parameter is invalid"
  }
}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|
|422|[Unprocessable Entity](https://tools.ietf.org/html/rfc2518#section-10.3)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» request_id|string|true|none||A unique string from 25 charachers for your submitted order that you can use it later to make other operations on the order. For example to cancel it if needed.|
|»» due_date|string|true|none||The submitted due date with the order|
|»» latest_cancellation_date|string|true|none||Latest cancelation date|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

HTTP Status Code **422**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» quantity|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

## POST eSIM voucher

POST /v2/voucher/esim

This endpoint allows you to create an esim voucher to the Airalo Partners API. Provide the required information, such as quantity and package id

The access token, obtained from the "Request Access Token" endpoint, should be included in the request.

For more informations, best practices visit our FAQ page: [https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ](https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ)

**Body Structure:**

``` json
{
    "vouchers": [
        {
            "package_id": "replace with actual package slug",
            "quantity": 3,
            "booking_reference": "123"
        }
    ]
}

 ```

**Request parameters:**

- **vouchers** (array, required):
    
    - An array of voucher objects to be created for eSIMs. Each voucher object contains the following fields:
        
        - **package_id** (string, required):
            
            - The unique identifier (slug) of the eSIM package for which the voucher is being issued.
                
            - Example: "package_id": "eu-europe-5gb-30days"
                
        - **quantity** (integer, required):
            
            - The number of vouchers you wish to purchase for the specified package.
                
            - Example: "quantity": 3
                
        - **booking_reference** (string, optional):
            
            - An optional field used to store the booking reference for this voucher, which can be used for tracking purposes in your own system.
                
            - Example: "booking_reference": "123"
                
            - If not provided, this field will be ignored.

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|Authorization|header|string| yes |none|
|Content-Type|header|string| yes |none|

> Response Examples

> 200 Response

```
{"data":[{"package_id":"jaco-mobile-7days-1gb","codes":["BIXLAAAA","BSXLAAAA"],"booking_reference":"123"},{"package_id":"liberation-mobile-30days-3gb","codes":["1HKGDUMP"],"booking_reference":"123"}],"meta":{"message":"success"}}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|[object]|true|none||none|
|»» package_id|string|true|none||none|
|»» codes|[string]|true|none||none|
|»» booking_reference|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

# REST API/Endpoints/Install eSIM

## GET Get installation instructions

GET /v2/sims/{sim_iccid}/instructions

This endpoint allows you to retrieve the language specific installation instructions of a specific eSIM from the Airalo Partners API using the eSIM's ICCID.

The access token, obtained from the "Request Access Token" endpoint, should be included in the request.

For more informations, best practices visit our FAQ page: [https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ](https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ)

**direct_apple_installation_url:**

Partner API now supports direct installation on iOS devices. With the introduction of Universal Links by Apple, users with iOS 17.4 or higher can directly install eSIMs using a special URL, which can be provided to your end clients if they are using iOS version 17.4 or above.

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|sim_iccid|path|string| yes |The ICCID of the eSIM for which you want to retrieve the details.|
|Accept|header|string| yes |none|
|Authorization|header|string| yes |none|
|Accept-Language|header|string| yes |none|

> Response Examples

> 200 Response

```json
{
  "data": {
    "instructions": {
      "language": "EN",
      "ios": [
        {
          "model": null,
          "version": "14,15,13",
          "installation_via_qr_code": {
            "steps": {
              "1": "Go to Settings > Cellular/Mobile > Add Cellular/Mobile Plan.",
              "2": "Scan the QR Code.",
              "3": "Tap on 'Add Cellular Plan'.",
              "4": "Label the eSIM.",
              "5": "Choose preferred default line to call or send messages.",
              "6": "Choose the preferred line to use with iMessage, FaceTime, and Apple ID.",
              "7": "Choose the eSIM plan as your default line for Cellular Data and do not turn on 'Allow Cellular Data Switching' to prevent charges on your other line.",
              "8": "Your eSIM has been installed successfully, please scroll down to see the settings for accessing data."
            },
            "qr_code_data": "LPA:1$lpa.airalo.com$TEST",
            "qr_code_url": "https://sandbox.airalo.com/qr?expires=1797582688&id=115516&signature=3ee338b2d3405e913f1961993947236cc5c6b6c6c1d22d5e7da6e1281b6cefe6",
            "direct_apple_installation_url": "https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$wbg.prod.ondemandconnectivity.com$Y7MRQ886FCDJD4RH"
          },
          "installation_manual": {
            "steps": {
              "1": "Go to Settings > Cellular/Mobile > Add Cellular/Mobile Plan.",
              "2": "Tap on 'Enter Details Manually'.",
              "3": "Enter your SM-DP+ Address and Activation Code.",
              "4": "Tap on 'Add Cellular Plan'.",
              "5": "Label the eSIM.",
              "6": "Choose preferred default line to call or send messages.",
              "7": "Choose the preferred line to use with iMessage, FaceTime, and Apple ID.",
              "8": "Choose the eSIM plan as your default line for Cellular Data and do not turn on 'Allow Cellular Data Switching' to prevent charges on your other line.",
              "9": "Your eSIM has been installed successfully, please scroll down to see the settings for accessing data."
            },
            "smdp_address_and_activation_code": "lpa.airalo.com"
          },
          "network_setup": {
            "steps": {
              "1": "Select your  eSIM under 'Cellular Plans'.",
              "2": "Ensure that 'Turn On This Line' is toggled on.",
              "3": "Go to 'Network Selection' and select the supported network.",
              "4": "Turn on the Data Roaming.",
              "5": "Need help? Chat with us."
            },
            "apn_type": "manual",
            "apn_value": "singleall",
            "is_roaming": true
          }
        }
      ],
      "android": [
        {
          "model": null,
          "version": null,
          "installation_via_qr_code": {
            "steps": {
              "1": "Go to Settings > Connections > SIM Card Manager.",
              "2": "Tap on 'Add Mobile Plan'.",
              "3": "Tap on 'Scan Carrier QR Code' and tap on 'Add'.",
              "4": "When the plan has been registered, tap 'Ok' to turn on a new mobile plan.",
              "5": "Your eSIM has been installed successfully, please scroll down to see the settings for accessing data."
            },
            "qr_code_data": "LPA:1$lpa.airalo.com$TEST",
            "qr_code_url": "https://sandbox.airalo.com/qr?expires=1797582688&id=115516&signature=3ee338b2d3405e913f1961993947236cc5c6b6c6c1d22d5e7da6e1281b6cefe6"
          },
          "installation_manual": {
            "steps": {
              "1": "Go to Settings > Connections > SIM Card Manager.",
              "2": "Tap on 'Add Mobile Plan'.",
              "3": "Tap on 'Scan Carrier QR Code' and tap on 'Enter code instead'.",
              "4": "Enter the Activation Code (SM-DP+ Address & Activation Code).",
              "5": "When the plan has been registered, tap 'Ok' to turn on a new mobile plan.",
              "6": "Your eSIM has been installed successfully, please scroll down to see the settings for accessing data."
            },
            "smdp_address_and_activation_code": "lpa.airalo.com"
          },
          "network_setup": {
            "steps": {
              "1": "In the 'SIM Card Manager' select your  eSIM.",
              "2": "Ensure that your eSIM is turned on under 'Mobile Networks'.",
              "3": "Enable the Mobile Data.",
              "4": "Turn on the Data Roaming.",
              "5": "Go to Settings > Connections > Mobile networks > Network Operators.",
              "6": "Ensure that the supported network is selected.",
              "7": "Need help? Chat with us."
            },
            "apn_type": "manual",
            "apn_value": "singleall",
            "is_roaming": true
          }
        }
      ]
    }
  },
  "meta": {
    "message": "success"
  }
}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» instructions|object|true|none||none|
|»»» language|string|true|none||none|
|»»» ios|[object]|true|none||none|
|»»»» model|null|false|none||none|
|»»»» version|string|false|none||none|
|»»»» installation_via_qr_code|object|false|none||none|
|»»»»» steps|object|true|none||none|
|»»»»»» 1|string|true|none||none|
|»»»»»» 2|string|true|none||none|
|»»»»»» 3|string|true|none||none|
|»»»»»» 4|string|true|none||none|
|»»»»»» 5|string|true|none||none|
|»»»»»» 6|string|true|none||none|
|»»»»»» 7|string|true|none||none|
|»»»»»» 8|string|true|none||none|
|»»»»» qr_code_data|string|true|none||none|
|»»»»» qr_code_url|string|true|none||none|
|»»»»» direct_apple_installation_url|string|true|none||none|
|»»»» installation_manual|object|false|none||none|
|»»»»» steps|object|true|none||none|
|»»»»»» 1|string|true|none||none|
|»»»»»» 2|string|true|none||none|
|»»»»»» 3|string|true|none||none|
|»»»»»» 4|string|true|none||none|
|»»»»»» 5|string|true|none||none|
|»»»»»» 6|string|true|none||none|
|»»»»»» 7|string|true|none||none|
|»»»»»» 8|string|true|none||none|
|»»»»»» 9|string|true|none||none|
|»»»»» smdp_address_and_activation_code|string|true|none||none|
|»»»» network_setup|object|false|none||none|
|»»»»» steps|object|true|none||none|
|»»»»»» 1|string|true|none||none|
|»»»»»» 2|string|true|none||none|
|»»»»»» 3|string|true|none||none|
|»»»»»» 4|string|true|none||none|
|»»»»»» 5|string|true|none||none|
|»»»»» apn_type|string|true|none||none|
|»»»»» apn_value|string|true|none||none|
|»»»»» is_roaming|boolean|true|none||none|
|»»» android|[object]|true|none||none|
|»»»» model|null|false|none||none|
|»»»» version|null|false|none||none|
|»»»» installation_via_qr_code|object|false|none||none|
|»»»»» steps|object|true|none||none|
|»»»»»» 1|string|true|none||none|
|»»»»»» 2|string|true|none||none|
|»»»»»» 3|string|true|none||none|
|»»»»»» 4|string|true|none||none|
|»»»»»» 5|string|true|none||none|
|»»»»» qr_code_data|string|true|none||none|
|»»»»» qr_code_url|string|true|none||none|
|»»»» installation_manual|object|false|none||none|
|»»»»» steps|object|true|none||none|
|»»»»»» 1|string|true|none||none|
|»»»»»» 2|string|true|none||none|
|»»»»»» 3|string|true|none||none|
|»»»»»» 4|string|true|none||none|
|»»»»»» 5|string|true|none||none|
|»»»»»» 6|string|true|none||none|
|»»»»» smdp_address_and_activation_code|string|true|none||none|
|»»»» network_setup|object|false|none||none|
|»»»»» steps|object|true|none||none|
|»»»»»» 1|string|true|none||none|
|»»»»»» 2|string|true|none||none|
|»»»»»» 3|string|true|none||none|
|»»»»»» 4|string|true|none||none|
|»»»»»» 5|string|true|none||none|
|»»»»»» 6|string|true|none||none|
|»»»»»» 7|string|true|none||none|
|»»»»» apn_type|string|true|none||none|
|»»»»» apn_value|string|true|none||none|
|»»»»» is_roaming|boolean|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

## GET Get eSIM

GET /v2/sims/{sim_iccid}

This endpoint allows you to retrieve the details of a specific eSIM from the Airalo Partners API using the eSIM's ICCID. Note that only eSIM orders made via the API are retrievable via this endpoint. You can include related data in the response by specifying optional parameters.

The access token, obtained from the "Request Access Token" endpoint, should be included in the request.

For more informations, best practices visit our FAQ page: [https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ](https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ)

**direct_apple_installation_url:**

Partner API now supports direct installation on iOS devices. With the introduction of Universal Links by Apple, users with iOS 17.4 or higher can directly install eSIMs using a special URL, which can be provided to your end clients if they are using iOS version 17.4 or above.

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|sim_iccid|path|string| yes |The ICCID of the eSIM for which you want to retrieve the details.|
|include|query|string| no |Optional. A comma-separated string to include related data in the response. Possible values are "order", "order.status", "order.user" and "share".|
|Accept|header|string| yes |none|
|Authorization|header|string| yes |none|

> Response Examples

> 200 Response

```json
{
  "data": {
    "id": 11028,
    "created_at": "2023-02-27 08:30:14",
    "iccid": "8944465400000267221",
    "lpa": "lpa.airalo.com",
    "imsis": null,
    "matching_id": "TEST",
    "qrcode": "LPA:1$lpa.airalo.com$TEST",
    "qrcode_url": "https://sandbox.airalo.com/qr?expires=1763800214&id=13282&signature=93bc1599eaaea3175eb32a9f23b3961273e97f04c50ba1b57b68ac99bc6677df",
    "direct_apple_installation_url": "https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$wbg.prod.ondemandconnectivity.com$Y7MRQ886FCDJD4RH",
    "voucher_code": null,
    "airalo_code": null,
    "apn_type": "automatic",
    "apn_value": null,
    "is_roaming": true,
    "confirmation_code": "5751",
    "order": null,
    "brand_settings_name": "our perfect brand",
    "recycled": true,
    "recycled_at": "2025-05-05 10:52:39",
    "simable": {
      "id": 9647,
      "created_at": "2023-02-27 08:30:14",
      "code": "20230227-009647",
      "description": null,
      "type": "sim",
      "package_id": "kallur-digital-7days-1gb",
      "quantity": 1,
      "package": "Kallur Digital-1 GB - 7 Days",
      "esim_type": "Prepaid",
      "validity": "7",
      "price": "9.50",
      "data": "1 GB",
      "currency": "USD",
      "manual_installation": "<p><b>eSIM name: </b>Kallur Digital</p><p><b>Coverage:</b> Faroe Islands</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><p>1. Settings> Cellular/Mobile> Add Cellular/Mobile Plan.</p><p>2. Manually enter the SM-DP+ Address and activation code.</p><p>3. Confirm the eSIM plan details</p><p>4. Label the eSIM.</p><p><b>To access Data:</b></p><p>1. Enable data roaming.</p><p><b>To top-up:</b></p><p></p><p>Visit airalo.com/my-esims or \"My eSIMs\" tab in your Airaloo app.</p><p><br></p>",
      "qrcode_installation": "<p><b>eSIM name:</b> Kallur Digital</p><p><b>Coverage: </b>Faroe Islands</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><p>1. Settings> Cellular/Mobile> Add Cellular/Mobile Plan.</p><p>2. Scan QR code</p><p>3. Confirm the eSIM plan details</p><p>4. Label the eSIM</p><p><b>To access Data:</b></p><p>1. Enable data roaming</p>",
      "installation_guides": {
        "en": "https://sandbox.airalo.com/installation-guide"
      },
      "status": {
        "name": "Completed",
        "slug": "completed"
      },
      "user": {
        "id": 120,
        "created_at": "2023-02-20 08:41:57",
        "name": "User Name",
        "email": "email@domain.com",
        "mobile": null,
        "address": null,
        "state": null,
        "city": null,
        "postal_code": null,
        "country_id": null,
        "company": "Company Name"
      },
      "sharing": {
        "link": "https://esims.cloud/our-perfect-brand/a4g5ht-58sdf1a",
        "access_code": "4812"
      }
    }
  },
  "meta": {
    "message": "succes"
  }
}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» id|integer|true|none||none|
|»» created_at|string|true|none||none|
|»» iccid|string|true|none||none|
|»» lpa|string|true|none||none|
|»» imsis|null|true|none||none|
|»» matching_id|string|true|none||none|
|»» qrcode|string|true|none||none|
|»» qrcode_url|string|true|none||none|
|»» direct_apple_installation_url|string|true|none||none|
|»» voucher_code|null|true|none||none|
|»» airalo_code|null|true|none||none|
|»» apn_type|string|true|none||none|
|»» apn_value|null|true|none||none|
|»» is_roaming|boolean|true|none||none|
|»» confirmation_code|string|true|none||none|
|»» order|null|true|none||none|
|»» brand_settings_name|string|true|none||none|
|»» recycled|boolean|true|none||true - if sim is recycled. - false - otherwise|
|»» recycled_at|string(date-time)¦null|true|none||Timestamp of when the sim was recycled in format Y-m-d H:i:s|
|»» simable|object|true|none||none|
|»»» id|integer|true|none||none|
|»»» created_at|string|true|none||none|
|»»» code|string|true|none||none|
|»»» description|null|true|none||none|
|»»» type|string|true|none||none|
|»»» package_id|string|true|none||none|
|»»» quantity|integer|true|none||none|
|»»» package|string|true|none||none|
|»»» esim_type|string|true|none||none|
|»»» validity|string|true|none||none|
|»»» price|string|true|none||none|
|»»» data|string|true|none||none|
|»»» currency|string|true|none||none|
|»»» manual_installation|string|true|none||none|
|»»» qrcode_installation|string|true|none||none|
|»»» installation_guides|object|true|none||none|
|»»»» en|string|true|none||none|
|»»» status|object|true|none||none|
|»»»» name|string|true|none||none|
|»»»» slug|string|true|none||none|
|»»» user|object|true|none||none|
|»»»» id|integer|true|none||none|
|»»»» created_at|string|true|none||none|
|»»»» name|string|true|none||none|
|»»»» email|string|true|none||none|
|»»»» mobile|null|true|none||none|
|»»»» address|null|true|none||none|
|»»»» state|null|true|none||none|
|»»»» city|null|true|none||none|
|»»»» postal_code|null|true|none||none|
|»»»» country_id|null|true|none||none|
|»»»» company|string|true|none||none|
|»»» sharing|object|true|none||none|
|»»»» link|string|true|none||none|
|»»»» access_code|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

# REST API/Endpoints/Monitor usage

## GET Get usage (data, text & voice)

GET /v2/sims/{sim_iccid}/usage

:::highlight blue 💡
**This endpoint comes with a rate limit: 100 requests per minute (per unique iccid) and a built-in cache of 20 minutes**
:::

This endpoint enables you to retrieve the total data, voice & text usage for a specific eSIM identified by its ICCID.

The access token, obtained from the "Request Access Token" endpoint, should be included in the request.

**Response atttributes units explained:**
- `total` : Response value is total megabytes on package
- `remaining` :  Response value is in total megabytes **remaining**

- `total_text` :  Response value is the initial total text messages on package
- `remaining_text` :  Response value is in total number of text messages **remaining**

- `total_voice` :  Response value is the initial total voice minutes on package
- `remaining_voice` :  Response value is in total minutes **remaining**

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|sim_iccid|path|string| yes |The ICCID of the eSIM for which you want to retrieve the data usage details.|
|Accept|header|string| yes |none|
|Authorization|header|string| yes |none|

> Response Examples

> 200 Response

```json
"{\n    \"data\": {\n        \"remaining\": 767,\n        \"total\": 2048,\n        \"expired_at\": \"2022-01-01 00:00:00\",\n        \"is_unlimited\": true,\n        \"status\": \"ACTIVE\", // All Cases: [ NOT_ACTIVE, ACTIVE, FINISHED, UNKNOWN, EXPIRED ]\n        \"remaining_voice\": 0,\n        \"remaining_text\": 0,\n        \"total_voice\": 0,\n        \"total_text\": 0\n    },\n    \"meta\": {\n        \"message\": \"api.succes\"\n    }\n}"
```

> 404 Response

```json
{
  "data": [],
  "meta": {
    "message": "messages.resource_not_found"
  }
}
```

> 429 Response

```json
{
  "message": "Too Many Attempts."
}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|none|Inline|
|429|[Too Many Requests](https://tools.ietf.org/html/rfc6585#section-4)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» remaining|integer|true|none||none|
|»» total|integer|true|none||none|
|»» expired_at|string|true|none||none|
|»» is_unlimited|boolean|true|none||none|
|»» status|string|true|none||All Cases: [ NOT_ACTIVE, ACTIVE, FINISHED, UNKNOWN, EXPIRED ]|
|»» remaining_voice|integer|true|none||none|
|»» remaining_text|integer|true|none||none|
|»» total_voice|integer|true|none||none|
|»» total_text|integer|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

HTTP Status Code **404**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|[any]|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

HTTP Status Code **429**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» message|string|true|none||none|

# REST API/Endpoints/Place top up order

## GET Get  top-up package list

GET /v2/sims/{iccid}/topups

**Endpoint do support new type of packages - "Voice and Text"**  
**To get the list of available packages for an eSIM:**

Make a GET request to the endpoint URL [https://partners-api.airalo.com/v1/sims/:iccid/topups](https://partners-api.airalo.com/v1/sims/:iccid/topups), replace :iccid with the ICCID of the eSIM for which you want to purchase a top-up.

The API will respond with a JSON object containing an array of available top-up packages, each of which includes an ID, price, data amount, duration, and other information.

For more informations, best practices visit our FAQ page: [https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ](https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ)

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|iccid|path|string| yes |eSIM ICCID, used to query a list of available top-up packages.|
|Accept|header|string| yes |none|
|Authorization|header|string| yes |none|

#### Description

**iccid**: eSIM ICCID, used to query a list of available top-up packages.
Required. Can be obtained by execuring GET to the "eSIMs List" endpoint

> Response Examples

> 200 Response

```json
{
  "data": [
    {
      "id": "bonbon-mobile-30days-3gb-topup",
      "type": "topup",
      "price": 10,
      "amount": 3072,
      "day": 30,
      "is_unlimited": false,
      "title": "3 GB - 100 SMS - 100 Mins - 30 Days",
      "data": "3 GB",
      "short_info": "This eSIM doesn't come with a phone number.",
      "voice": 100,
      "text": 100
    },
    {
      "id": "bonbon-mobile-30days-5gb-topup",
      "type": "topup",
      "price": 15,
      "amount": 5120,
      "day": 30,
      "is_unlimited": false,
      "title": "5 GB - 30 Days",
      "data": "5 GB",
      "short_info": "This eSIM doesn't come with a phone number.",
      "voice": 100,
      "text": 100
    },
    {
      "id": "bonbon-mobile-30days-10gb-topup",
      "type": "topup",
      "price": 22.5,
      "amount": 10240,
      "day": 30,
      "is_unlimited": false,
      "title": "10 GB - 30 Days",
      "data": "10 GB",
      "short_info": "This eSIM doesn't come with a phone number.",
      "voice": 100,
      "text": 100
    }
  ]
}
```

> 422 Response

```json
{
  "code": 73,
  "reason": "The eSIM with iccid 8910300000005271146 has been recycled. It can no longer be used or topped up."
}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|
|422|[Unprocessable Entity](https://tools.ietf.org/html/rfc2518#section-10.3)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|[object]|true|none||none|
|»» id|string|true|none||none|
|»» type|string|true|none||none|
|»» price|integer|true|none||none|
|»» amount|integer|true|none||none|
|»» day|integer|true|none||none|
|»» is_unlimited|boolean|true|none||none|
|»» title|string|true|none||none|
|»» data|string|true|none||none|
|»» short_info|string|true|none||none|
|»» voice|integer|true|none||none|
|»» text|integer|true|none||none|

HTTP Status Code **422**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» code|integer|true|none||none|
|» reason|string|true|none||none|

## POST Submit top-up order

POST /v2/orders/topups

**To submit a top-up order:**

Make a POST request to the endpoint URL {{url}}/{{version}}/orders/topups

Include a request body in the form of a FormData object, which contains the following required fields:

1) package_id: The ID of the top-up package you want to purchase

2) iccid: The ICCID of the eSIM for which you want to purchase the top-up package.

You can also include an optional description field to provide additional information about the order.

The API will respond with a JSON object containing the details of the order, including the package ID, quantity, price, and other information.

**The complete workflow for buying a top-up package:**

1) GET {{url}}/{{version}}/sims to see the list of purchased eSIMs  
2) GET {{url}}/{{version}}/sims/:iccid/topups to see the list of available top-ups for the eSIMs  
3) POST {{url}}/{{version}}/orders/topups with the proper "iccid" and "package_id" values to purchase a top-up  
4) GET {{url}}/{{version}}/sims/:iccid/packages to see the list of all packages for the eSIM, including the original package and top-ups

For more informations, best practices visit our FAQ page: [https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ](https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ)

> Body Parameters

```yaml
package_id: bonbon-mobile-30days-3gb-topup
iccid: "89340000000000872"
description: Example description to identify the order

```

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|Accept|header|string| yes |none|
|Authorization|header|string| yes |none|
|body|body|object| no |none|
|» package_id|body|string| yes |Required. A Topup Package ID, can be obtainer by executing a GET request to the "eSIM: List available top-up packages" endpoint|
|» iccid|body|string| yes |Required. eSIM ICCID, that identifies the eSIM for the top-up package.|
|» description|body|string| yes |Optional. Order description to identify the order.|

#### Description

**» iccid**: Required. eSIM ICCID, that identifies the eSIM for the top-up package.
Can be obtained by execuring GET to the "eSIMs List" endpoint

> Response Examples

> 200 Response

```json
{
  "data": {
    "package_id": "bonbon-mobile-30days-3gb-topup",
    "quantity": "1",
    "type": "topup",
    "description": "Topup (89340000000000872)",
    "esim_type": "Prepaid",
    "validity": 30,
    "package": "Bonbon Mobile 2-3 GB - 30 Days",
    "data": "3 GB",
    "price": 10,
    "created_at": "2023-02-07 07:42:17",
    "id": 174,
    "code": "20230207-000174",
    "currency": "USD",
    "manual_installation": "",
    "qrcode_installation": "",
    "installation_guides": {
      "en": "http://airalo.local:8080/installation-guide"
    }
  },
  "meta": {
    "message": "success"
  }
}
```

> 422 Response

```json
{
  "data": {
    "package_id": "validation.order_exceed_limit"
  },
  "meta": {
    "message": "the parameter is invalid"
  }
}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|
|422|[Unprocessable Entity](https://tools.ietf.org/html/rfc2518#section-10.3)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» package_id|string|true|none||none|
|»» quantity|string|true|none||none|
|»» type|string|true|none||none|
|»» description|string|true|none||none|
|»» esim_type|string|true|none||none|
|»» validity|integer|true|none||none|
|»» package|string|true|none||none|
|»» data|string|true|none||none|
|»» price|integer|true|none||none|
|»» created_at|string|true|none||none|
|»» id|integer|true|none||none|
|»» code|string|true|none||none|
|»» currency|string|true|none||none|
|»» manual_installation|string|true|none||none|
|»» qrcode_installation|string|true|none||none|
|»» installation_guides|object|true|none||none|
|»»» en|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

HTTP Status Code **422**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» package_id|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

# REST API/Endpoints/Manage orders

## GET Get order list

GET /v2/orders

This endpoint allows you to retrieve a list of your orders from the Airalo Partners API. By using various filters, you can customize the results to match specific criteria. The access token, obtained from the "Request Access Token" endpoint, should be included in the request.

For more informations, best practices visit our FAQ page: [https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ](https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ)

> Body Parameters

```yaml
{}

```

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|include|query|string| no |Optional. A comma-separated string to include related data in the response. Possible values are "sims", "user", and "status".|
|filter[created_at]|query|string| no |Optional. A string to filter orders by their creation date. Specify the date range using a dash (-) as a delimiter for correct parsing.|
|filter[code]|query|string| no |Optional. Filter orders by their order code. This performs a like search using the format '%ORDER_CODE%'.|
|filter[order_status]|query|string| no |Optional. A string to filter orders by their status. Possible values: "completed", "failed", "partially_refunded", and "refunded".|
|filter[iccid]|query|string| no |Optional. Filter orders by the sim's ICCID. This performs a like search using the format '%SIM_ICCID%'.|
|filter[description]|query|string| no |Optional. A string to filter orders by their description. This performs a like search using the format '%DESCRIPTION%'.|
|limit|query|string| no |Optional. An integer specifying how many orders will be returned on each page.|
|page|query|string| no |Optional. An integer specifying the pagination's current page.|
|Accept|header|string| yes |none|
|Authorization|header|string| yes |none|
|body|body|object| no |none|

> Response Examples

> 200 Response

```json
{
  "data": [
    {
      "id": 9666,
      "created_at": "2023-02-27 14:09:55",
      "code": "20230227-009666",
      "description": "Example description to identify the order",
      "type": "sim",
      "package_id": "kallur-digital-7days-1gb",
      "quantity": 1,
      "package": "Kallur Digital-1 GB - 7 Days",
      "esim_type": "Prepaid",
      "validity": "7",
      "price": "9.50",
      "data": "1 GB",
      "currency": "USD",
      "manual_installation": "<p><b>eSIM name: </b>Kallur Digital</p><p><b>Coverage:</b> Faroe Islands</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><p>1. Settings> Cellular/Mobile> Add Cellular/Mobile Plan.</p><p>2. Manually enter the SM-DP+ Address and activation code.</p><p>3. Confirm the eSIM plan details</p><p>4. Label the eSIM.</p><p><b>To access Data:</b></p><p>1. Enable data roaming.</p><p><b>To top-up:</b></p><p></p><p>Visit airalo.com/my-esims or \"My eSIMs\" tab in your Airaloo app.</p><p><br></p>",
      "qrcode_installation": "<p><b>eSIM name:</b> Kallur Digital</p><p><b>Coverage: </b>Faroe Islands</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><p>1. Settings> Cellular/Mobile> Add Cellular/Mobile Plan.</p><p>2. Scan QR code</p><p>3. Confirm the eSIM plan details</p><p>4. Label the eSIM</p><p><b>To access Data:</b></p><p>1. Enable data roaming</p>",
      "installation_guides": {
        "en": "https://sandbox.airalo.com/installation-guide"
      },
      "sims": [
        {
          "id": 11047,
          "created_at": "2023-02-27 14:09:55",
          "iccid": "891000000000009125",
          "lpa": "lpa.airalo.com",
          "imsis": null,
          "matching_id": "TEST",
          "qrcode": "LPA:1$lpa.airalo.com$TEST",
          "qrcode_url": "https://sandbox.airalo.com/qr?expires=1763820595&id=13301&signature=1f0d45226a3857bd0645bf77225b7aee7e250f926763ee1d1a6e4be7fefde71e",
          "airalo_code": null,
          "apn_type": "automatic",
          "apn_value": null,
          "is_roaming": true,
          "confirmation_code": null
        }
      ],
      "user": {
        "id": 120,
        "created_at": "2023-02-20 08:41:57",
        "name": "User Name",
        "email": "User.Name+sandbox2@airalo.com",
        "mobile": null,
        "address": null,
        "state": null,
        "city": null,
        "postal_code": null,
        "country_id": null,
        "company": "User Name Airalo 2"
      },
      "status": {
        "name": "Completed",
        "slug": "completed"
      }
    },
    {
      "id": 9647,
      "created_at": "2023-02-27 08:30:14",
      "code": "20230227-009647",
      "description": null,
      "type": "sim",
      "package_id": "kallur-digital-7days-1gb",
      "quantity": 1,
      "package": "Kallur Digital-1 GB - 7 Days",
      "esim_type": "Prepaid",
      "validity": "7",
      "price": "9.50",
      "data": "1 GB",
      "currency": "USD",
      "manual_installation": "<p><b>eSIM name: </b>Kallur Digital</p><p><b>Coverage:</b> Faroe Islands</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><p>1. Settings> Cellular/Mobile> Add Cellular/Mobile Plan.</p><p>2. Manually enter the SM-DP+ Address and activation code.</p><p>3. Confirm the eSIM plan details</p><p>4. Label the eSIM.</p><p><b>To access Data:</b></p><p>1. Enable data roaming.</p><p><b>To top-up:</b></p><p></p><p>Visit airalo.com/my-esims or \"My eSIMs\" tab in your Airaloo app.</p><p><br></p>",
      "qrcode_installation": "<p><b>eSIM name:</b> Kallur Digital</p><p><b>Coverage: </b>Faroe Islands</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><p>1. Settings> Cellular/Mobile> Add Cellular/Mobile Plan.</p><p>2. Scan QR code</p><p>3. Confirm the eSIM plan details</p><p>4. Label the eSIM</p><p><b>To access Data:</b></p><p>1. Enable data roaming</p>",
      "installation_guides": {
        "en": "https://sandbox.airalo.com/installation-guide"
      },
      "sims": [
        {
          "id": 11028,
          "created_at": "2023-02-27 08:30:14",
          "iccid": "891000000000009106",
          "lpa": "lpa.airalo.com",
          "imsis": null,
          "matching_id": "TEST",
          "qrcode": "LPA:1$lpa.airalo.com$TEST",
          "qrcode_url": "https://sandbox.airalo.com/qr?expires=1763800214&id=13282&signature=93bc1599eaaea3175eb32a9f23b3961273e97f04c50ba1b57b68ac99bc6677df",
          "airalo_code": null,
          "apn_type": "automatic",
          "apn_value": null,
          "is_roaming": true,
          "confirmation_code": null
        }
      ],
      "user": {
        "id": 120,
        "created_at": "2023-02-20 08:41:57",
        "name": "User Name",
        "email": "User.Name+sandbox2@airalo.com",
        "mobile": null,
        "address": null,
        "state": null,
        "city": null,
        "postal_code": null,
        "country_id": null,
        "company": "User Name Airalo 2"
      },
      "status": {
        "name": "Completed",
        "slug": "completed"
      }
    },
    {
      "id": 9583,
      "created_at": "2023-02-24 05:34:28",
      "code": "20230224-009583",
      "description": null,
      "type": "sim",
      "package_id": "mariocom-30days-3gb",
      "quantity": 1,
      "package": "Mariocom-3 GB - 30 Days",
      "esim_type": "Prepaid",
      "validity": "30",
      "price": "27.00",
      "data": "3 GB",
      "currency": "USD",
      "manual_installation": "<p><b>eSIM name:</b> Mariocom</p><p><b>Coverage: </b>Liberia</p><p><b>To manually activate the eSIM on your eSIM capable device:</b><br></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.<br></li></ol>",
      "qrcode_installation": "<p><b>eSIM name:</b> Mariocom</p><p><b>Coverage: </b>Liberia</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.<br></li></ol>",
      "installation_guides": {
        "en": "https://sandbox.airalo.com/installation-guide"
      },
      "sims": [
        {
          "id": 10970,
          "created_at": "2023-02-24 05:34:28",
          "iccid": "891000000000009048",
          "lpa": "lpa.airalo.com",
          "imsis": null,
          "matching_id": "TEST",
          "qrcode": "LPA:1$lpa.airalo.com$TEST",
          "qrcode_url": "https://sandbox.airalo.com/qr?expires=1763530468&id=13224&signature=f8e3e726e95a588f1043979615ca456b316e59eecbe17e7e9cb0eabfc0050359",
          "airalo_code": null,
          "apn_type": "automatic",
          "apn_value": null,
          "is_roaming": true,
          "confirmation_code": null
        }
      ],
      "user": {
        "id": 120,
        "created_at": "2023-02-20 08:41:57",
        "name": "User Name",
        "email": "User.Name+sandbox2@airalo.com",
        "mobile": null,
        "address": null,
        "state": null,
        "city": null,
        "postal_code": null,
        "country_id": null,
        "company": "User Name Airalo 2"
      },
      "status": {
        "name": "Completed",
        "slug": "completed"
      }
    },
    {
      "id": 9566,
      "created_at": "2023-02-22 14:24:03",
      "code": "20230222-009566",
      "description": "Description c i._ +++# m#+&_#n_W",
      "type": "topup",
      "package_id": "bonbon-mobile-30days-3gb-topup",
      "quantity": 1,
      "package": "Bonbon Mobile-3 GB - 30 Days",
      "esim_type": "Prepaid",
      "validity": "30",
      "price": "10.00",
      "data": "3 GB",
      "currency": "USD",
      "manual_installation": "",
      "qrcode_installation": "",
      "installation_guides": {
        "en": "https://sandbox.airalo.com/installation-guide"
      },
      "sims": [],
      "user": {
        "id": 120,
        "created_at": "2023-02-20 08:41:57",
        "name": "User Name",
        "email": "User.Name+sandbox2@airalo.com",
        "mobile": null,
        "address": null,
        "state": null,
        "city": null,
        "postal_code": null,
        "country_id": null,
        "company": "User Name Airalo 2"
      },
      "status": {
        "name": "Completed",
        "slug": "completed"
      }
    },
    {
      "id": 9565,
      "created_at": "2023-02-22 14:24:01",
      "code": "20230222-009565",
      "description": null,
      "type": "sim",
      "package_id": "bonbon-mobile-30days-10gb",
      "quantity": 1,
      "package": "Bonbon Mobile-10 GB - 30 Days",
      "esim_type": "Prepaid",
      "validity": "30",
      "price": "22.50",
      "data": "10 GB",
      "currency": "USD",
      "manual_installation": "<p><b>eSIM name:</b> Bonbon Mobile</p><p><b>Coverage: </b>France</p><p><b>To manually activate the eSIM on your eSIM capable device:</b><br></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Locate the APN settings in your settings menu.</li><li>Update the APN to \"rh\".</li><li>Enable data roaming.</li></ol>",
      "qrcode_installation": "<p><b>eSIM name:</b> Bonbon Mobile</p><p><b>Coverage: </b>France</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b><br></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Locate the APN settings in your settings menu.</li><li>Update the APN to \"rh\".</li><li>Enable data roaming.</li></ol>",
      "installation_guides": {
        "en": "https://sandbox.airalo.com/installation-guide"
      },
      "sims": [
        {
          "id": 10954,
          "created_at": "2023-02-22 14:24:01",
          "iccid": "891000000000009032",
          "lpa": "lpa.airalo.com",
          "imsis": null,
          "matching_id": "TEST",
          "qrcode": "LPA:1$lpa.airalo.com$TEST",
          "qrcode_url": "https://sandbox.airalo.com/qr?expires=1763389441&id=13208&signature=d2d5d4b5c048dc2df05e8a7230352007a76366b04c07f6faf6ab77ee8b9b1881",
          "airalo_code": null,
          "apn_type": "manual",
          "apn_value": "rh",
          "is_roaming": true,
          "confirmation_code": null
        }
      ],
      "user": {
        "id": 120,
        "created_at": "2023-02-20 08:41:57",
        "name": "User Name",
        "email": "User.Name+sandbox2@airalo.com",
        "mobile": null,
        "address": null,
        "state": null,
        "city": null,
        "postal_code": null,
        "country_id": null,
        "company": "User Name Airalo 2"
      },
      "status": {
        "name": "Completed",
        "slug": "completed"
      }
    }
  ],
  "meta": {
    "message": "success",
    "current_page": 1,
    "from": 1,
    "last_page": 18,
    "path": "https://sandbox-partners-api.airalo.com/v1/orders",
    "per_page": "5",
    "to": 5,
    "total": 87
  },
  "links": {
    "first": "https://sandbox-partners-api.airalo.com/v1/orders?include=sims%2Cuser%2Cstatus&limit=5&page=1",
    "last": "https://sandbox-partners-api.airalo.com/v1/orders?include=sims%2Cuser%2Cstatus&limit=5&page=18",
    "prev": null,
    "next": "https://sandbox-partners-api.airalo.com/v1/orders?include=sims%2Cuser%2Cstatus&limit=5&page=2"
  }
}
```

> 422 Response

```json
{
  "data": {
    "limit": "The limit must be an integer.",
    "page": "The page must be an integer."
  },
  "meta": {
    "message": "the parameter is invalid"
  }
}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|
|422|[Unprocessable Entity](https://tools.ietf.org/html/rfc2518#section-10.3)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|[object]|true|none||none|
|»» id|integer|true|none||none|
|»» created_at|string|true|none||none|
|»» code|string|true|none||none|
|»» description|string¦null|true|none||none|
|»» type|string|true|none||none|
|»» package_id|string|true|none||none|
|»» quantity|integer|true|none||none|
|»» package|string|true|none||none|
|»» esim_type|string|true|none||none|
|»» validity|string|true|none||none|
|»» price|string|true|none||none|
|»» data|string|true|none||none|
|»» currency|string|true|none||none|
|»» manual_installation|string|true|none||none|
|»» qrcode_installation|string|true|none||none|
|»» installation_guides|object|true|none||none|
|»»» en|string|true|none||none|
|»» sims|[object]|true|none||none|
|»»» id|integer|true|none||none|
|»»» created_at|string|true|none||none|
|»»» iccid|string|true|none||none|
|»»» lpa|string|true|none||none|
|»»» imsis|null|true|none||none|
|»»» matching_id|string|true|none||none|
|»»» qrcode|string|true|none||none|
|»»» qrcode_url|string|true|none||none|
|»»» airalo_code|null|true|none||none|
|»»» apn_type|string|true|none||none|
|»»» apn_value|string¦null|true|none||none|
|»»» is_roaming|boolean|true|none||none|
|»»» confirmation_code|null|true|none||none|
|»» user|object|true|none||none|
|»»» id|integer|true|none||none|
|»»» created_at|string|true|none||none|
|»»» name|string|true|none||none|
|»»» email|string|true|none||none|
|»»» mobile|null|true|none||none|
|»»» address|null|true|none||none|
|»»» state|null|true|none||none|
|»»» city|null|true|none||none|
|»»» postal_code|null|true|none||none|
|»»» country_id|null|true|none||none|
|»»» company|string|true|none||none|
|»» status|object|true|none||none|
|»»» name|string|true|none||none|
|»»» slug|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|
|»» current_page|integer|true|none||none|
|»» from|integer|true|none||none|
|»» last_page|integer|true|none||none|
|»» path|string|true|none||none|
|»» per_page|string|true|none||none|
|»» to|integer|true|none||none|
|»» total|integer|true|none||none|
|» links|object|true|none||none|
|»» first|string|true|none||none|
|»» last|string|true|none||none|
|»» prev|null|true|none||none|
|»» next|string|true|none||none|

HTTP Status Code **422**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» limit|string|true|none||none|
|»» page|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

## GET Future Orders

GET /v2/future-orders

This endpoint allows you to get all your submitted future orders that are in pending, failed or retry status
The following filter parameters are available:

 - status (optional) -  Defaults to pending. Other possible statuses are: failed and retry
 - limit (optional) - Defaults to 25. Limit the returned results
 - from_due_date - Datetime field in the format: Y-m-d H:i. Filters data starting from this date forward. Example: 2025-02-27 10:00
 - to_due_date - Datetime field in the format: Y-m-d H:i. Filters data starting from this date backward. Example: 2025-02-27 10:00

NOTE: that processed orders will not be displayed here.

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|status|query|string| no |Defaults to pending. Other possible status options: failed, retry|
|limit|query|string| no |Limit the returned results|
|from_due_date|query|string| no |Date in format: 2025-02-27 10:00|
|to_due_date|query|string| no |Date in format: 2025-02-27 10:00|

> Response Examples

> 200 Response

```json
{
  "data": [
    {
      "request_id": "ehFeHAa_R1GyIgHxNrP6Iz0Hy",
      "quantity": 1,
      "description": "",
      "status": "pending",
      "package_id": "change-7days-1gb",
      "due_date": "2025-03-24 10:00",
      "latest_cancellation_date": "2025-03-23 10:00"
    },
    {
      "request_id": "UPMpgaC9rWr799augw9KbI_ia",
      "quantity": 1,
      "description": "",
      "status": "pending",
      "package_id": "change-7days-1gb",
      "due_date": "2025-02-27 10:00",
      "latest_cancellation_date": "2025-02-26 10:00"
    },
    {
      "request_id": "-s5Cx8jTjvx2UH_euzhaHbwiu",
      "quantity": 1,
      "description": "",
      "status": "pending",
      "package_id": "change-7days-1gb",
      "due_date": "2025-02-27 10:00",
      "latest_cancellation_date": "2025-02-26 10:00"
    }
  ],
  "links": {
    "first": "https://partners-api.airalo.com/v2/future-orders?filter%5B%27status%27%5D=%27failed%27&status=pending&page=1",
    "last": "https://partners-api.airalo.com/v2/future-orders?filter%5B%27status%27%5D=%27failed%27&status=pending&page=3",
    "prev": null,
    "next": "https://partners-api.airalo.com/v2/future-orders?filter%5B%27status%27%5D=%27failed%27&status=pending&page=2"
  },
  "meta": {
    "message": "success",
    "current_page": 1,
    "from": 1,
    "last_page": 1,
    "path": "https://partners-api.airalo.com/v2/future-orders",
    "per_page": "25",
    "to": 3,
    "total": 3
  }
}
```

> 422 Response

```json
{
  "data": {
    "from_due_date": "The from due date is not a valid date."
  },
  "meta": {
    "message": "the parameter is invalid"
  }
}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|
|422|[Unprocessable Entity](https://tools.ietf.org/html/rfc2518#section-10.3)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|[object]|true|none||none|
|»» request_id|string|true|none||none|
|»» quantity|integer|true|none||none|
|»» description|string|true|none||none|
|»» status|string|true|none||none|
|»» package_id|string|true|none||none|
|»» due_date|string|true|none||none|
|»» latest_cancellation_date|string|true|none||none|
|» links|object|true|none||none|
|»» first|string|true|none||none|
|»» last|string|true|none||none|
|»» prev|null|true|none||none|
|»» next|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|
|»» current_page|integer|true|none||none|
|»» from|integer|true|none||none|
|»» last_page|integer|true|none||none|
|»» path|string|true|none||none|
|»» per_page|string|true|none||none|
|»» to|integer|true|none||none|
|»» total|integer|true|none||none|

HTTP Status Code **422**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» from_due_date|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

## GET Get order

GET /v2/orders/{order_id}

This endpoint allows you to retrieve the details of a specific order from the Airalo Partners API using the order ID. You can also include related data in the response by specifying optional parameters. The access token, obtained from the "Request Access Token" endpoint, should be included in the request.

For more informations, best practices visit our FAQ page: [https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ](https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ)

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|order_id|path|string| yes |The order ID for which you want to retrieve the details.|
|include|query|string| no |Optional. A comma-separated string to include related data in the response. Possible values are "sims", "user", and "status".|
|Accept|header|string| yes |none|
|Authorization|header|string| yes |none|

> Response Examples

> 200 Response

```json
{
  "data": {
    "id": 9565,
    "created_at": "2023-02-22 14:24:01",
    "code": "20230222-009565",
    "description": null,
    "type": "sim",
    "package_id": "bonbon-mobile-30days-10gb",
    "quantity": 1,
    "package": "Bonbon Mobile-10 GB - 30 Days",
    "esim_type": "Prepaid",
    "validity": "30",
    "price": "22.50",
    "data": "10 GB",
    "currency": "USD",
    "manual_installation": "<p><b>eSIM name:</b> Bonbon Mobile</p><p><b>Coverage: </b>France</p><p><b>To manually activate the eSIM on your eSIM capable device:</b><br></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Locate the APN settings in your settings menu.</li><li>Update the APN to \"rh\".</li><li>Enable data roaming.</li></ol>",
    "qrcode_installation": "<p><b>eSIM name:</b> Bonbon Mobile</p><p><b>Coverage: </b>France</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b><br></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Locate the APN settings in your settings menu.</li><li>Update the APN to \"rh\".</li><li>Enable data roaming.</li></ol>",
    "installation_guides": {
      "en": "https://sandbox.airalo.com/installation-guide"
    },
    "sims": [
      {
        "id": 10954,
        "created_at": "2023-02-22 14:24:01",
        "iccid": "891000000000009032",
        "lpa": "lpa.airalo.com",
        "imsis": null,
        "matching_id": "TEST",
        "qrcode": "LPA:1$lpa.airalo.com$TEST",
        "qrcode_url": "https://sandbox.airalo.com/qr?expires=1763389441&id=13208&signature=d2d5d4b5c048dc2df05e8a7230352007a76366b04c07f6faf6ab77ee8b9b1881",
        "voucher_code": null,
        "airalo_code": null,
        "apn_type": "manual",
        "apn_value": "rh",
        "is_roaming": true,
        "confirmation_code": null
      }
    ],
    "user": {
      "id": 120,
      "created_at": "2023-02-20 08:41:57",
      "name": "User Name",
      "email": "User.Name+sandbox2@airalo.com",
      "mobile": null,
      "address": null,
      "state": null,
      "city": null,
      "postal_code": null,
      "country_id": null,
      "company": "User Name Airalo 2"
    },
    "status": {
      "name": "Completed",
      "slug": "completed"
    }
  },
  "meta": {
    "message": "success"
  }
}
```

> 401 Response

```json
{
  "data": [],
  "meta": {
    "message": "This action is unauthorized."
  }
}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» id|integer|true|none||none|
|»» created_at|string|true|none||none|
|»» code|string|true|none||none|
|»» description|null|true|none||none|
|»» type|string|true|none||none|
|»» package_id|string|true|none||none|
|»» quantity|integer|true|none||none|
|»» package|string|true|none||none|
|»» esim_type|string|true|none||none|
|»» validity|string|true|none||none|
|»» price|string|true|none||none|
|»» data|string|true|none||none|
|»» currency|string|true|none||none|
|»» manual_installation|string|true|none||none|
|»» qrcode_installation|string|true|none||none|
|»» installation_guides|object|true|none||none|
|»»» en|string|true|none||none|
|»» sims|[object]|true|none||none|
|»»» id|integer|false|none||none|
|»»» created_at|string|false|none||none|
|»»» iccid|string|false|none||none|
|»»» lpa|string|false|none||none|
|»»» imsis|null|false|none||none|
|»»» matching_id|string|false|none||none|
|»»» qrcode|string|false|none||none|
|»»» qrcode_url|string|false|none||none|
|»»» voucher_code|null|false|none||none|
|»»» airalo_code|null|false|none||none|
|»»» apn_type|string|false|none||none|
|»»» apn_value|string|false|none||none|
|»»» is_roaming|boolean|false|none||none|
|»»» confirmation_code|null|false|none||none|
|»» user|object|true|none||none|
|»»» id|integer|true|none||none|
|»»» created_at|string|true|none||none|
|»»» name|string|true|none||none|
|»»» email|string|true|none||none|
|»»» mobile|null|true|none||none|
|»»» address|null|true|none||none|
|»»» state|null|true|none||none|
|»»» city|null|true|none||none|
|»»» postal_code|null|true|none||none|
|»»» country_id|null|true|none||none|
|»»» company|string|true|none||none|
|»» status|object|true|none||none|
|»»» name|string|true|none||none|
|»»» slug|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

HTTP Status Code **401**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|[any]|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

## POST Cancel future orders

POST /v2/cancel-future-orders

This endpoint allows you to submit future order cancellation requests via the Airalo Partner API.

To proceed, provide an array of request_id strings from the "Create Future Order" endpoint response.

Please note:
- Future orders can be canceled up to 24 hours before the due date.
- You can include up to 10 future orders in a single request.
- An access token from the "Request Access Token" endpoint is required.

For more details and best practices, visit our [FAQ page](https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ).

> Body Parameters

```json
{
  "request_ids": [
    "wPnaOiEcdyP11pEPeJ-jLhT_I",
    "Q2FMVdpbIAFh0RVvtjKkya8a1",
    "OKjfHGS5qzRWzt74iKfm9YeVe"
  ]
}
```

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|Accept|header|string| yes |none|
|Authorization|header|string| yes |none|
|body|body|object| no |none|
|» request_ids|body|[string]| yes |none|

> Response Examples

> 200 Response

```json
{
  "data": [],
  "meta": {
    "message": "Future orders cancelled successfully"
  }
}
```

> 422 Response

```json
{
  "data": {
    "request_ids.1": "Each request ID must be exactly 25 characters long."
  },
  "meta": {
    "message": "the parameter is invalid"
  }
}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|
|422|[Unprocessable Entity](https://tools.ietf.org/html/rfc2518#section-10.3)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|[string]|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

HTTP Status Code **422**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||The data object provides specific error messags for each of the provided request_ids, starting from index 0 which represents the first of the provided request_ids in the array.. In this case "request_ids.1" represents the sercond request ID in the array.|
|»» request_ids.1|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

# REST API/Endpoints/Manage eSIMs

## PUT Update eSIM brand

PUT /v2/sims/{sim_iccid}/brand

This endpoint allows you to update assigned brand settings name of a specific eSIM from the Airalo Partners API using the eSIM's ICCID. This brand is used to apply branding on sharing link or share e-mails.If brand is set as null value, eSIM will be shared with unbranded visual.

  
The access token, obtained from the "Request Access Token" endpoint, should be included in the request.

  
For more informations, best practices visit our FAQ page: [https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ](https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ)

> Body Parameters

```yaml
brand_settings_name: our perfect brand

```

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|sim_iccid|path|string| yes |The ICCID of the eSIM for which you want to update the brand.|
|Accept|header|string| yes |none|
|Authorization|header|string| yes |none|
|body|body|object| no |none|
|» brand_settings_name|body|string| yes |Nullable. The definition under what brand the eSIM should be shared. Null for unbranded.|

> Response Examples

> 200 Response

```json
{
  "data": {
    "brand_settings_name": "our perfect brand"
  },
  "meta": {
    "message": "succes"
  }
}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» brand_settings_name|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

## GET Get eSIMs list

GET /v2/sims

:::highlight blue 💡
**GDPR and Data Storage** 
For compliance with GDPR and global privacy regulations, Airalo does not store any of your end-users' personally identifiable information (PII). You are solely responsible for handling and storing all customer data on your end.

**Associating eSIMs with Customers** 
To retrieve or manage all eSIMs associated with a specific customer, you must store and map the customer's data to the ICCID within your own system. The ICCID is the primary identifier for managing an eSIM post-purchase.
:::

This endpoint allows you to retrieve a list of your eSIMs from the Airalo Partners API. You can customize the results using various filters and include related data in the response by specifying optional parameters.

The access token, obtained from the "Request Access Token" endpoint, should be included in the request.

`direct_apple_installation_url`: Partner API now supports direct installation on iOS devices. With the introduction of Universal Links by Apple, users with iOS 17.4 or higher can directly install eSIMs using a special URL, which can be provided to your end clients if they are using iOS version 17.4 or above.

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|include|query|string| no |Optional. A comma-separated string to include related data in the response. Possible values are "order", "order.status", "order.user" and "share".|
|filter[created_at]|query|string| no |Optional. A string to filter eSIMs by their creation date. Specify the date range using a dash (-) as a delimiter for correct parsing.|
|filter[iccid]|query|string| no |Optional. A string to filter eSIMs by their ICCID. This performs a like search using the format '%SIM_ICCID%'.|
|limit|query|string| no |Optional. An integer specifying how many sims will be returned on each page.|
|page|query|string| no |Optional. An integer specifying the pagination's current page.|
|Accept|header|string| yes |none|
|Authorization|header|string| yes |none|

> Response Examples

> 200 Response

```json
{
  "data": [
    {
      "id": 11047,
      "created_at": "2023-02-27 14:09:55",
      "iccid": "891000000000009125",
      "lpa": "lpa.airalo.com",
      "imsis": null,
      "matching_id": "TEST",
      "qrcode": "LPA:1$lpa.airalo.com$TEST",
      "qrcode_url": "https://sandbox.airalo.com/qr?expires=1763820595&id=13301&signature=1f0d45226a3857bd0645bf77225b7aee7e250f926763ee1d1a6e4be7fefde71e",
      "direct_apple_installation_url": "https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$wbg.prod.ondemandconnectivity.com$Y7MRQ886FCDJD4RH",
      "voucher_code": null,
      "airalo_code": null,
      "apn_type": "automatic",
      "apn_value": null,
      "is_roaming": true,
      "confirmation_code": null,
      "order": null,
      "brand_settings_name": "our perfect brand",
      "recycled": true,
      "recycled_at": "2025-05-05 10:52:39",
      "simable": {
        "id": 9666,
        "created_at": "2023-02-27 14:09:55",
        "code": "20230227-009666",
        "description": "Example description to identify the order",
        "type": "sim",
        "package_id": "kallur-digital-7days-1gb",
        "quantity": 1,
        "package": "Kallur Digital-1 GB - 7 Days",
        "esim_type": "Prepaid",
        "validity": "7",
        "price": "9.50",
        "data": "1 GB",
        "currency": "USD",
        "manual_installation": "<p><b>eSIM name: </b>Kallur Digital</p><p><b>Coverage:</b> Faroe Islands</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><p>1. Settings> Cellular/Mobile> Add Cellular/Mobile Plan.</p><p>2. Manually enter the SM-DP+ Address and activation code.</p><p>3. Confirm the eSIM plan details</p><p>4. Label the eSIM.</p><p><b>To access Data:</b></p><p>1. Enable data roaming.</p><p><b>To top-up:</b></p><p></p><p>Visit airalo.com/my-esims or \"My eSIMs\" tab in your Airaloo app.</p><p><br></p>",
        "qrcode_installation": "<p><b>eSIM name:</b> Kallur Digital</p><p><b>Coverage: </b>Faroe Islands</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><p>1. Settings> Cellular/Mobile> Add Cellular/Mobile Plan.</p><p>2. Scan QR code</p><p>3. Confirm the eSIM plan details</p><p>4. Label the eSIM</p><p><b>To access Data:</b></p><p>1. Enable data roaming</p>",
        "installation_guides": {
          "en": "https://sandbox.airalo.com/installation-guide"
        },
        "status": {
          "name": "Completed",
          "slug": "completed"
        },
        "user": {
          "id": 120,
          "created_at": "2023-02-20 08:41:57",
          "name": "User Name",
          "email": "User.Name+sandbox2@airalo.com",
          "mobile": null,
          "address": null,
          "state": null,
          "city": null,
          "postal_code": null,
          "country_id": null,
          "company": "User Name Airalo 2"
        },
        "sharing": {
          "link": "https://esims.cloud/our-perfect-brand/sdf15-51li",
          "access_code": "8264"
        }
      }
    },
    {
      "id": 11028,
      "created_at": "2023-02-27 08:30:14",
      "iccid": "891000000000009106",
      "lpa": "lpa.airalo.com",
      "imsis": null,
      "matching_id": "TEST",
      "qrcode": "LPA:1$lpa.airalo.com$TEST",
      "qrcode_url": "https://sandbox.airalo.com/qr?expires=1763800214&id=13282&signature=93bc1599eaaea3175eb32a9f23b3961273e97f04c50ba1b57b68ac99bc6677df",
      "direct_apple_installation_url": "https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$wbg.prod.ondemandconnectivity.com$Y7MRQ886FCDJD4RH",
      "voucher_code": null,
      "airalo_code": null,
      "apn_type": "automatic",
      "apn_value": null,
      "is_roaming": true,
      "confirmation_code": null,
      "order": null,
      "brand_settings_name": "our perfect brand",
      "simable": {
        "id": 9647,
        "created_at": "2023-02-27 08:30:14",
        "code": "20230227-009647",
        "description": null,
        "type": "sim",
        "package_id": "kallur-digital-7days-1gb",
        "quantity": 1,
        "package": "Kallur Digital-1 GB - 7 Days",
        "esim_type": "Prepaid",
        "validity": "7",
        "price": "9.50",
        "data": "1 GB",
        "currency": "USD",
        "manual_installation": "<p><b>eSIM name: </b>Kallur Digital</p><p><b>Coverage:</b> Faroe Islands</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><p>1. Settings> Cellular/Mobile> Add Cellular/Mobile Plan.</p><p>2. Manually enter the SM-DP+ Address and activation code.</p><p>3. Confirm the eSIM plan details</p><p>4. Label the eSIM.</p><p><b>To access Data:</b></p><p>1. Enable data roaming.</p><p><b>To top-up:</b></p><p></p><p>Visit airalo.com/my-esims or \"My eSIMs\" tab in your Airaloo app.</p><p><br></p>",
        "qrcode_installation": "<p><b>eSIM name:</b> Kallur Digital</p><p><b>Coverage: </b>Faroe Islands</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><p>1. Settings> Cellular/Mobile> Add Cellular/Mobile Plan.</p><p>2. Scan QR code</p><p>3. Confirm the eSIM plan details</p><p>4. Label the eSIM</p><p><b>To access Data:</b></p><p>1. Enable data roaming</p>",
        "installation_guides": {
          "en": "https://sandbox.airalo.com/installation-guide"
        },
        "status": {
          "name": "Completed",
          "slug": "completed"
        },
        "user": {
          "id": 120,
          "created_at": "2023-02-20 08:41:57",
          "name": "User Name",
          "email": "User.Name+sandbox2@airalo.com",
          "mobile": null,
          "address": null,
          "state": null,
          "city": null,
          "postal_code": null,
          "country_id": null,
          "company": "User Name Airalo 2"
        },
        "sharing": {
          "link": "https://esims.cloud/our-perfect-brand/fds5-48jtd",
          "access_code": "3482"
        }
      }
    },
    {
      "id": 10970,
      "created_at": "2023-02-24 05:34:28",
      "iccid": "891000000000009048",
      "lpa": "lpa.airalo.com",
      "imsis": null,
      "matching_id": "TEST",
      "qrcode": "LPA:1$lpa.airalo.com$TEST",
      "qrcode_url": "https://sandbox.airalo.com/qr?expires=1763530468&id=13224&signature=f8e3e726e95a588f1043979615ca456b316e59eecbe17e7e9cb0eabfc0050359",
      "direct_apple_installation_url": "https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$wbg.prod.ondemandconnectivity.com$Y7MRQ886FCDJD4RH",
      "voucher_code": null,
      "airalo_code": null,
      "apn_type": "automatic",
      "apn_value": null,
      "is_roaming": true,
      "confirmation_code": null,
      "order": null,
      "brand_settings_name": null,
      "simable": {
        "id": 9583,
        "created_at": "2023-02-24 05:34:28",
        "code": "20230224-009583",
        "description": null,
        "type": "sim",
        "package_id": "mariocom-30days-3gb",
        "quantity": 1,
        "package": "Mariocom-3 GB - 30 Days",
        "esim_type": "Prepaid",
        "validity": "30",
        "price": "27.00",
        "data": "3 GB",
        "currency": "USD",
        "manual_installation": "<p><b>eSIM name:</b> Mariocom</p><p><b>Coverage: </b>Liberia</p><p><b>To manually activate the eSIM on your eSIM capable device:</b><br></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.<br></li></ol>",
        "qrcode_installation": "<p><b>eSIM name:</b> Mariocom</p><p><b>Coverage: </b>Liberia</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.<br></li></ol>",
        "installation_guides": {
          "en": "https://sandbox.airalo.com/installation-guide"
        },
        "status": {
          "name": "Completed",
          "slug": "completed"
        },
        "user": {
          "id": 120,
          "created_at": "2023-02-20 08:41:57",
          "name": "User Name",
          "email": "User.Name+sandbox2@airalo.com",
          "mobile": null,
          "address": null,
          "state": null,
          "city": null,
          "postal_code": null,
          "country_id": null,
          "company": "User Name Airalo 2"
        },
        "sharing": {
          "link": "https://esims.cloud/our-perfect-brand/a4g5ht-58sdf1a",
          "access_code": "4812"
        }
      }
    },
    {
      "id": 10954,
      "created_at": "2023-02-22 14:24:01",
      "iccid": "891000000000009032",
      "lpa": "lpa.airalo.com",
      "imsis": null,
      "matching_id": "TEST",
      "qrcode": "LPA:1$lpa.airalo.com$TEST",
      "qrcode_url": "https://sandbox.airalo.com/qr?expires=1763389441&id=13208&signature=d2d5d4b5c048dc2df05e8a7230352007a76366b04c07f6faf6ab77ee8b9b1881",
      "direct_apple_installation_url": "https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$wbg.prod.ondemandconnectivity.com$Y7MRQ886FCDJD4RH",
      "voucher_code": null,
      "airalo_code": null,
      "apn_type": "manual",
      "apn_value": "rh",
      "is_roaming": true,
      "confirmation_code": null,
      "order": null,
      "brand_settings_name": null,
      "simable": {
        "id": 9565,
        "created_at": "2023-02-22 14:24:01",
        "code": "20230222-009565",
        "description": null,
        "type": "sim",
        "package_id": "bonbon-mobile-30days-10gb",
        "quantity": 1,
        "package": "Bonbon Mobile-10 GB - 30 Days",
        "esim_type": "Prepaid",
        "validity": "30",
        "price": "22.50",
        "data": "10 GB",
        "currency": "USD",
        "manual_installation": "<p><b>eSIM name:</b> Bonbon Mobile</p><p><b>Coverage: </b>France</p><p><b>To manually activate the eSIM on your eSIM capable device:</b><br></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Locate the APN settings in your settings menu.</li><li>Update the APN to \"rh\".</li><li>Enable data roaming.</li></ol>",
        "qrcode_installation": "<p><b>eSIM name:</b> Bonbon Mobile</p><p><b>Coverage: </b>France</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b><br></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Locate the APN settings in your settings menu.</li><li>Update the APN to \"rh\".</li><li>Enable data roaming.</li></ol>",
        "installation_guides": {
          "en": "https://sandbox.airalo.com/installation-guide"
        },
        "status": {
          "name": "Completed",
          "slug": "completed"
        },
        "user": {
          "id": 120,
          "created_at": "2023-02-20 08:41:57",
          "name": "User Name",
          "email": "User.Name+sandbox2@airalo.com",
          "mobile": null,
          "address": null,
          "state": null,
          "city": null,
          "postal_code": null,
          "country_id": null,
          "company": "User Name Airalo 2"
        },
        "sharing": {
          "link": "https://esims.cloud/our-perfect-brand/nf21gs-gfds94f",
          "access_code": "6465"
        }
      }
    },
    {
      "id": 10938,
      "created_at": "2023-02-22 09:49:21",
      "iccid": "891000000000009016",
      "lpa": "lpa.airalo.com",
      "imsis": null,
      "matching_id": "TEST",
      "qrcode": "LPA:1$lpa.airalo.com$TEST",
      "qrcode_url": "https://sandbox.airalo.com/qr?expires=1763372961&id=13192&signature=00df38513e8e7fb9af0e04b970e79894cb71e2a0f29346a77d8ca60de367766f",
      "direct_apple_installation_url": "https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$wbg.prod.ondemandconnectivity.com$Y7MRQ886FCDJD4RH",
      "voucher_code": null,
      "airalo_code": null,
      "apn_type": "automatic",
      "apn_value": null,
      "is_roaming": true,
      "confirmation_code": null,
      "order": null,
      "brand_settings_name": "our perfect brand",
      "simable": {
        "id": 9546,
        "created_at": "2023-02-22 09:49:21",
        "code": "20230222-009546",
        "description": null,
        "type": "sim",
        "package_id": "nigercell-30days-3gb",
        "quantity": 1,
        "package": "Nigercell-3 GB - 30 Days",
        "esim_type": "Prepaid",
        "validity": "30",
        "price": "19.00",
        "data": "3 GB",
        "currency": "USD",
        "manual_installation": "<p><b>eSIM name:</b> Nigercell</p><p><b>Coverage: </b>Nigeria</p><p><b>To manually activate the eSIM on your eSIM capable device:</b><br></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol>",
        "qrcode_installation": "<p><b>eSIM name:</b> Nigercell</p><p><b>Coverage: </b>Nigeria</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol>",
        "installation_guides": {
          "en": "https://sandbox.airalo.com/installation-guide"
        },
        "status": {
          "name": "Completed",
          "slug": "completed"
        },
        "user": {
          "id": 120,
          "created_at": "2023-02-20 08:41:57",
          "name": "User Name",
          "email": "User.Name+sandbox2@airalo.com",
          "mobile": null,
          "address": null,
          "state": null,
          "city": null,
          "postal_code": null,
          "country_id": null,
          "company": "User Name Airalo 2"
        },
        "sharing": {
          "link": "https://esims.cloud/our-perfect-brand/n82zaa-jnd5s9",
          "access_code": "1537"
        }
      }
    }
  ],
  "links": {
    "first": "https://sandbox-partners-api.airalo.com/v1/sims?include=order%2Corder.status%2Corder.user&limit=5&page=1",
    "last": "https://sandbox-partners-api.airalo.com/v1/sims?include=order%2Corder.status%2Corder.user&limit=5&page=16",
    "prev": null,
    "next": "https://sandbox-partners-api.airalo.com/v1/sims?include=order%2Corder.status%2Corder.user&limit=5&page=2"
  },
  "meta": {
    "message": "success",
    "current_page": 1,
    "from": 1,
    "last_page": 16,
    "path": "https://sandbox-partners-api.airalo.com/v1/sims",
    "per_page": "5",
    "to": 5,
    "total": 77
  }
}
```

> 422 Response

```json
{
  "data": {
    "limit": "The limit must be an integer."
  },
  "meta": {
    "message": "the parameter is invalid"
  }
}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|
|422|[Unprocessable Entity](https://tools.ietf.org/html/rfc2518#section-10.3)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|[object]|true|none||none|
|»» id|integer|true|none||none|
|»» created_at|string|true|none||none|
|»» iccid|string|true|none||none|
|»» lpa|string|true|none||none|
|»» imsis|null|true|none||none|
|»» matching_id|string|true|none||none|
|»» qrcode|string|true|none||none|
|»» qrcode_url|string|true|none||none|
|»» direct_apple_installation_url|string|true|none||none|
|»» voucher_code|null|true|none||none|
|»» airalo_code|null|true|none||none|
|»» apn_type|string|true|none||none|
|»» apn_value|string¦null|true|none||none|
|»» is_roaming|boolean|true|none||none|
|»» confirmation_code|null|true|none||none|
|»» order|null|true|none||none|
|»» brand_settings_name|string¦null|true|none||none|
|»» recycled|boolean|true|none||true - if sim is recycled. - false - otherwise|
|»» recycled_at|string(date-time)¦null|true|none||Timestamp of when the sim was recycled in format Y-m-d H:i:s|
|»» simable|object|true|none||none|
|»»» id|integer|true|none||none|
|»»» created_at|string|true|none||none|
|»»» code|string|true|none||none|
|»»» description|string¦null|true|none||none|
|»»» type|string|true|none||none|
|»»» package_id|string|true|none||none|
|»»» quantity|integer|true|none||none|
|»»» package|string|true|none||none|
|»»» esim_type|string|true|none||none|
|»»» validity|string|true|none||none|
|»»» price|string|true|none||none|
|»»» data|string|true|none||none|
|»»» currency|string|true|none||none|
|»»» manual_installation|string|true|none||none|
|»»» qrcode_installation|string|true|none||none|
|»»» installation_guides|object|true|none||none|
|»»»» en|string|true|none||none|
|»»» status|object|true|none||none|
|»»»» name|string|true|none||none|
|»»»» slug|string|true|none||none|
|»»» user|object|true|none||none|
|»»»» id|integer|true|none||none|
|»»»» created_at|string|true|none||none|
|»»»» name|string|true|none||none|
|»»»» email|string|true|none||none|
|»»»» mobile|null|true|none||none|
|»»»» address|null|true|none||none|
|»»»» state|null|true|none||none|
|»»»» city|null|true|none||none|
|»»»» postal_code|null|true|none||none|
|»»»» country_id|null|true|none||none|
|»»»» company|string|true|none||none|
|»»» sharing|object|true|none||none|
|»»»» link|string|true|none||none|
|»»»» access_code|string|true|none||none|
|» links|object|true|none||none|
|»» first|string|true|none||none|
|»» last|string|true|none||none|
|»» prev|null|true|none||none|
|»» next|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|
|»» current_page|integer|true|none||none|
|»» from|integer|true|none||none|
|»» last_page|integer|true|none||none|
|»» path|string|true|none||none|
|»» per_page|string|true|none||none|
|»» to|integer|true|none||none|
|»» total|integer|true|none||none|

HTTP Status Code **422**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» limit|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

## GET Get  eSIM package history

GET /v2/sims/{iccid}/packages

:::highlight blue 💡
**GDPR and Data Storage** 
For compliance with GDPR and global privacy regulations, Airalo does not store any of your end-users' personally identifiable information (PII). You are solely responsible for handling and storing all customer data on your end.

**Associating eSIMs with Customers** 
To retrieve or manage all eSIMs associated with a specific customer, you must store and map the customer's data to the ICCID within your own system. The ICCID is the primary identifier for managing an eSIM post-purchase.
:::

**This endpoint comes with a Rate Limit:** you can pull specific eSIM history info once every 15 minutes. If you send another request too soon, the server's going to respond with a 429 HTTP code. Please check the 'Retry-After' header, it'll tell you how many seconds to wait before the rate limit resets and you can fetch fresh info.

**Please, use a caching mechanism on the client side to deal with frequent customer requests.**

**To get and display this eSIM’s data package history, including top-ups:**

Make a GET request to the endpoint URL [https://partners-api.airalo.com/v1/sims/:iccid/packages](https://partners-api.airalo.com/v1/sims/:iccid/packages), replacing :iccid with the ICCID of the eSIM for which you want to retrieve top-up package information.

The API will respond with a JSON object containing an array of purchased top-up packages for the eSIM, each of which includes an ID, remaining data amount, activation and expiration dates, and other information.

For more informations, best practices visit our FAQ page: [https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ](https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ)

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|iccid|path|string| yes |eSIM ICCID, used to query a list of purchased packages, including top-ups. Required. Can be obtained by execuring GET to the "eSIMs List" endpoint|
|Accept|header|string| yes |none|
|Authorization|header|string| yes |none|

#### Description

**iccid**: eSIM ICCID, used to query a list of purchased packages, including top-ups. Required. Can be obtained by execuring GET to the "eSIMs List" endpoint

> Response Examples

> 200 Response

```json
{
  "data": [
    {
      "id": 728,
      "status": "ACTIVE",
      "remaining": 2378,
      "activated_at": "2023-01-09T10:30:45+00:00",
      "expired_at": "2023-02-09T10:30:45+00:00",
      "finished_at": null,
      "package": {
        "id": "bonbon-mobile-30days-3gb-topup",
        "type": "topup",
        "price": 10,
        "net_price": 6,
        "amount": 3072,
        "day": 30,
        "is_unlimited": false,
        "title": "3 GB - 30 Days",
        "data": "3 GB",
        "short_info": null
      }
    },
    {
      "id": 725,
      "status": "ACTIVE",
      "remaining": 2496,
      "activated_at": "2023-01-09T10:30:45+00:00",
      "expired_at": "2023-02-09T10:30:45+00:00",
      "finished_at": null,
      "package": {
        "id": "bonbon-mobile-30days-3gb-topup",
        "type": "topup",
        "price": 10,
        "net_price": 6,
        "amount": 3072,
        "day": 30,
        "is_unlimited": false,
        "title": "3 GB - 30 Days",
        "data": "3 GB",
        "short_info": null
      }
    }
  ]
}
```

> 429 Response

```json
{
  "message": "Too Many Attempts."
}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|
|429|[Too Many Requests](https://tools.ietf.org/html/rfc6585#section-4)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|[object]|true|none||none|
|»» id|integer|true|none||none|
|»» status|string|true|none||none|
|»» remaining|integer|true|none||none|
|»» activated_at|string|true|none||none|
|»» expired_at|string|true|none||none|
|»» finished_at|null|true|none||none|
|»» package|object|true|none||none|
|»»» id|string|true|none||none|
|»»» type|string|true|none||none|
|»»» price|integer|true|none||none|
|»»» net_price|integer|true|none||none|
|»»» amount|integer|true|none||none|
|»»» day|integer|true|none||none|
|»»» is_unlimited|boolean|true|none||none|
|»»» title|string|true|none||none|
|»»» data|string|true|none||none|
|»»» short_info|null|true|none||none|

HTTP Status Code **429**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» message|string|true|none||none|

# REST API/Endpoints/Compatible devices

## GET [Deprecated] Get compatible device list

GET /v2/compatible-devices

:::warning
This endpoint is deprecated and will be eventually removed.  
Please use `/v2/compatible-devices-lite` instead.
:::

This endpoint provides a comprehensive list of devices that are compatible with eSIMs. Use this information to ensure that your customers have devices that support eSIM functionality.  

#### Important Notes  
- Include the access token, obtained from the **Request Access Token** endpoint, in the request headers to authenticate your API call.  
- The returned list is regularly updated to include the latest compatible devices, ensuring accurate and reliable information for your integration.  
- Use this endpoint to validate device compatibility before processing eSIM orders.  

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|Accept|header|string| yes |none|
|Authorization|header|string| yes |none|

> Response Examples

> 200 Response

```json
{
  "data": [
    {
      "model": "zangya_sprout",
      "os": "android",
      "brand": "bq",
      "name": "Aquaris X2"
    },
    {
      "model": "zangyapro_sprout",
      "os": "android",
      "brand": "bq",
      "name": "Aquaris X2 PRO"
    },
    {
      "model": "StrongPhone_G9",
      "os": "android",
      "brand": "Evolveo",
      "name": "EVOLVEO StrongPhone G9"
    },
    {
      "model": "gila",
      "os": "android",
      "brand": "Fossil",
      "name": "Fossil Gen 5 LTE"
    },
    {
      "model": "blueline",
      "os": "android",
      "brand": "Google",
      "name": "Pixel 3"
    },
    {
      "model": "bonito",
      "os": "android",
      "brand": "Google",
      "name": "Pixel 3a XL"
    },
    {
      "model": "bramble",
      "os": "android",
      "brand": "Google",
      "name": "Pixel 4a (5G)"
    },
    {
      "model": "coral",
      "os": "android",
      "brand": "Google",
      "name": "Pixel 4 XL"
    },
    {
      "model": "crosshatch",
      "os": "android",
      "brand": "Google",
      "name": "Pixel 3 XL"
    },
    {
      "model": "flame",
      "os": "android",
      "brand": "Google",
      "name": "Pixel 4"
    },
    {
      "model": "redfin",
      "os": "android",
      "brand": "Google",
      "name": "Pixel 5"
    },
    {
      "model": "sargo",
      "os": "android",
      "brand": "Google",
      "name": "Pixel 3a"
    },
    {
      "model": "sunfish",
      "os": "android",
      "brand": "Google",
      "name": "Pixel 4a"
    },
    {
      "model": "taimen",
      "os": "android",
      "brand": "Google",
      "name": "Pixel 2 XL"
    },
    {
      "model": "walleye",
      "os": "android",
      "brand": "Google",
      "name": "Pixel 2"
    },
    {
      "model": "HZ0010J",
      "os": "android",
      "brand": "Hoozo",
      "name": "HZ0010J"
    },
    {
      "model": "d-42A",
      "os": "android",
      "brand": "Lenovo",
      "name": "d-42A"
    },
    {
      "model": "hera_pro",
      "os": "android",
      "brand": "MiTAC",
      "name": "N672"
    },
    {
      "model": "surfing_pro",
      "os": "android",
      "brand": "MiTAC",
      "name": "N630"
    },
    {
      "model": "rover",
      "os": "android",
      "brand": "Mobvoi",
      "name": "TicWatch Pro 3 Cellular/LTE"
    },
    {
      "model": "coralia",
      "os": "android",
      "brand": "Montblanc",
      "name": "Summit 2+"
    },
    {
      "model": "olson",
      "os": "android",
      "brand": "Motorola",
      "name": "motorola razr"
    },
    {
      "model": "smith",
      "os": "android",
      "brand": "Motorola",
      "name": "motorola razr 5G"
    },
    {
      "model": "mkz_sdm660_64",
      "os": "android",
      "brand": "Motorola Solutions",
      "name": "MOTOTRBO ION"
    },
    {
      "model": "Hammer_Blade_3",
      "os": "android",
      "brand": "Myphone",
      "name": "Hammer Blade 3"
    },
    {
      "model": "Hammer_Expl_Pro",
      "os": "android",
      "brand": "Myphone",
      "name": "Hammer Explorer Pro"
    },
    {
      "model": "myPhone_Now_eSIM",
      "os": "android",
      "brand": "Myphone",
      "name": "myPhone Now eSIM"
    },
    {
      "model": "Hammer_Explorer",
      "os": "android",
      "brand": "MyPhone (PL)",
      "name": "Hammer_Explorer"
    },
    {
      "model": "OP4EC1",
      "os": "android",
      "brand": "Oppo",
      "name": "Reno6 Pro+ 5G"
    },
    {
      "model": "OP4F57L1",
      "os": "android",
      "brand": "Oppo",
      "name": "Find X3 Pro"
    },
    {
      "model": "orca",
      "os": "android",
      "brand": "Oppo",
      "name": "OPPO Watch"
    },
    {
      "model": "TAB-7304-16G3GS",
      "os": "android",
      "brand": "Premier",
      "name": "TAB-7304-16G3GS"
    },
    {
      "model": "C330",
      "os": "android",
      "brand": "Rakuten",
      "name": "C330"
    },
    {
      "model": "gaea",
      "os": "android",
      "brand": "Rakuten",
      "name": "Rakuten BIG s"
    },
    {
      "model": "P710",
      "os": "android",
      "brand": "Rakuten",
      "name": "Rakuten Hand"
    },
    {
      "model": "b2q",
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Z Flip3 5G"
    },
    {
      "model": "bloomq",
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Z Flip"
    },
    {
      "model": "bloomxq",
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Z Flip 5G"
    },
    {
      "model": "c1q",
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Note20 5G"
    },
    {
      "model": "c1s",
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Note20"
    },
    {
      "model": "c2q",
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Note20 Ultra 5G"
    },
    {
      "model": "c2s",
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Note20 Ultra"
    },
    {
      "model": "freshul",
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Watch4"
    },
    {
      "model": "freshus",
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Watch4"
    },
    {
      "model": "o1s",
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy S21 5G"
    },
    {
      "model": "p3s",
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy S21 Ultra 5G"
    },
    {
      "model": "t2s",
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy S21+ 5G"
    },
    {
      "model": "wiseul",
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Watch4 Classic"
    },
    {
      "model": "wiseus",
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Watch4 Classic"
    },
    {
      "model": "x1s",
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy S20 5G"
    },
    {
      "model": "y2s",
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy S20+ 5G"
    },
    {
      "model": "z3s",
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy S20 Ultra 5G"
    },
    {
      "model": "JeridL",
      "os": "android",
      "brand": "Sharp",
      "name": "AQUOS sense4 lite SH-RM15"
    },
    {
      "model": "duo",
      "os": "android",
      "brand": "Surface",
      "name": "Surface Duo"
    },
    {
      "model": "TAG-TAB-III",
      "os": "android",
      "brand": "TAG-TECH",
      "name": "TAG-TAB-III"
    },
    {
      "model": "X_EEA",
      "os": "android",
      "brand": "Teclast",
      "name": "X_EEA"
    },
    {
      "model": "PQ6001",
      "os": "android",
      "brand": "Vsmart",
      "name": "Active 1"
    },
    {
      "model": "EC55",
      "os": "android",
      "brand": "Zebra",
      "name": "EC55"
    },
    {
      "model": "ET56L",
      "os": "android",
      "brand": "Zebra",
      "name": "ET56"
    },
    {
      "model": "ET56S",
      "os": "android",
      "brand": "Zebra",
      "name": "ET56"
    },
    {
      "model": "L10AW",
      "os": "android",
      "brand": "Zebra",
      "name": "Zebra Technologies L10"
    },
    {
      "model": "MC2700",
      "os": "android",
      "brand": "Zebra",
      "name": "Zebra Technologies MC2700"
    },
    {
      "model": "TC26",
      "os": "android",
      "brand": "Zebra",
      "name": "TC26"
    },
    {
      "model": "TC57",
      "os": "android",
      "brand": "Zebra",
      "name": "TC57"
    },
    {
      "model": "TC57X",
      "os": "android",
      "brand": "Zebra",
      "name": "Zebra Technologies TC57x"
    },
    {
      "model": "TC77",
      "os": "android",
      "brand": "Zebra",
      "name": "TC77"
    },
    {
      "model": "Z7750R",
      "os": "android",
      "brand": "ZTE",
      "name": "ZR01"
    },
    {
      "model": "iPad11,2",
      "os": "ios",
      "brand": "Apple",
      "name": "iPad mini 5th Gen"
    },
    {
      "model": "iPad11,4",
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Air 3rd Gen"
    },
    {
      "model": "iPad11,7",
      "os": "ios",
      "brand": "Apple",
      "name": "iPad 8th Gen (WiFi+Cellular)"
    },
    {
      "model": "iPad13,10",
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 12.9 inch 5th Gen"
    },
    {
      "model": "iPad13,11",
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 12.9 inch 5th Gen"
    },
    {
      "model": "iPad13,2",
      "os": "ios",
      "brand": "Apple",
      "name": "iPad air 4th Gen (WiFi+Cellular)"
    },
    {
      "model": "iPad13,4",
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 11 inch 3rd Gen"
    },
    {
      "model": "iPad13,5 ",
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 11 inch 3rd Gen"
    },
    {
      "model": "iPad13,6",
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 11 inch 3rd Gen"
    },
    {
      "model": "iPad13,7",
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 11 inch 3rd Gen"
    },
    {
      "model": "iPad13,8",
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 12.9 inch 5th Gen"
    },
    {
      "model": "iPad13,9",
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 12.9 inch 5th Gen"
    },
    {
      "model": "iPad8,10",
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 11 inch 4th Gen (WiFi+Cellular)"
    },
    {
      "model": "iPad8,12",
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 12.9 inch 4th Gen (WiFi+Cellular)"
    },
    {
      "model": "iPad8,3",
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 11 inch 3rd Gen (WiFi+Cellular)"
    },
    {
      "model": "iPad8,4",
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 11 inch 3rd Gen (1TB, WiFi+Cellular)"
    },
    {
      "model": "iPad8,7",
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 12.9 inch 3rd Gen (WiFi+Cellular)"
    },
    {
      "model": "iPad8,8",
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 12.9 inch 3rd Gen (1TB, WiFi+Cellular)"
    },
    {
      "model": "iPhone11,2",
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone XS"
    },
    {
      "model": "iPhone11,4",
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone XS Max"
    },
    {
      "model": "iPhone11,6",
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone XS Max Global"
    },
    {
      "model": "iPhone11,8",
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone XR"
    },
    {
      "model": "iPhone12,1",
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone 11"
    },
    {
      "model": "iPhone12,3",
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone 11 Pro"
    },
    {
      "model": "iPhone12,5",
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone 11 Pro Max"
    },
    {
      "model": "iPhone12,8",
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone SE 2nd Gen"
    },
    {
      "model": "iPhone13,1",
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone 12 Mini"
    },
    {
      "model": "iPhone13,2",
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone 12"
    },
    {
      "model": "iPhone13,3",
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone 12 Pro"
    },
    {
      "model": "iPhone13,4",
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone 12 Pro Max"
    }
  ]
}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|[object]|true|none||none|
|»» model|string|true|none||none|
|»» os|string|true|none||none|
|»» brand|string|true|none||none|
|»» name|string|true|none||none|

## GET Get compatible device lite list

GET /v2/compatible-devices-lite

This endpoint provides a comprehensive list of devices that are compatible with eSIMs. Use this information to ensure that your customers have devices that support eSIM functionality.  

#### Important Notes  
- Include the access token, obtained from the **Request Access Token** endpoint, in the request headers to authenticate your API call.  
- The returned list is regularly updated to include the latest compatible devices, ensuring accurate and reliable information for your integration.  
- Use this endpoint to validate device compatibility before processing eSIM orders.  

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|Accept|header|string| yes |none|
|Authorization|header|string| yes |none|

> Response Examples

> 200 Response

```json
{
  "data": [
    {
      "os": "android",
      "brand": "bq",
      "name": "Aquaris X2"
    },
    {
      "os": "android",
      "brand": "bq",
      "name": "Aquaris X2 PRO"
    },
    {
      "os": "android",
      "brand": "Evolveo",
      "name": "EVOLVEO StrongPhone G9"
    },
    {
      "os": "android",
      "brand": "Fossil",
      "name": "Fossil Gen 5 LTE"
    },
    {
      "os": "android",
      "brand": "Google",
      "name": "Pixel 3"
    },
    {
      "os": "android",
      "brand": "Google",
      "name": "Pixel 3a XL"
    },
    {
      "os": "android",
      "brand": "Google",
      "name": "Pixel 4a (5G)"
    },
    {
      "os": "android",
      "brand": "Google",
      "name": "Pixel 4 XL"
    },
    {
      "os": "android",
      "brand": "Google",
      "name": "Pixel 3 XL"
    },
    {
      "os": "android",
      "brand": "Google",
      "name": "Pixel 4"
    },
    {
      "os": "android",
      "brand": "Google",
      "name": "Pixel 5"
    },
    {
      "os": "android",
      "brand": "Google",
      "name": "Pixel 3a"
    },
    {
      "os": "android",
      "brand": "Google",
      "name": "Pixel 4a"
    },
    {
      "os": "android",
      "brand": "Google",
      "name": "Pixel 2 XL"
    },
    {
      "os": "android",
      "brand": "Google",
      "name": "Pixel 2"
    },
    {
      "os": "android",
      "brand": "Hoozo",
      "name": "HZ0010J"
    },
    {
      "os": "android",
      "brand": "Lenovo",
      "name": "d-42A"
    },
    {
      "os": "android",
      "brand": "MiTAC",
      "name": "N672"
    },
    {
      "os": "android",
      "brand": "MiTAC",
      "name": "N630"
    },
    {
      "os": "android",
      "brand": "Mobvoi",
      "name": "TicWatch Pro 3 Cellular/LTE"
    },
    {
      "os": "android",
      "brand": "Montblanc",
      "name": "Summit 2+"
    },
    {
      "os": "android",
      "brand": "Motorola",
      "name": "motorola razr"
    },
    {
      "os": "android",
      "brand": "Motorola",
      "name": "motorola razr 5G"
    },
    {
      "os": "android",
      "brand": "Motorola Solutions",
      "name": "MOTOTRBO ION"
    },
    {
      "os": "android",
      "brand": "Myphone",
      "name": "Hammer Blade 3"
    },
    {
      "os": "android",
      "brand": "Myphone",
      "name": "Hammer Explorer Pro"
    },
    {
      "os": "android",
      "brand": "Myphone",
      "name": "myPhone Now eSIM"
    },
    {
      "os": "android",
      "brand": "MyPhone (PL)",
      "name": "Hammer_Explorer"
    },
    {
      "os": "android",
      "brand": "Oppo",
      "name": "Reno6 Pro+ 5G"
    },
    {
      "os": "android",
      "brand": "Oppo",
      "name": "Find X3 Pro"
    },
    {
      "os": "android",
      "brand": "Oppo",
      "name": "OPPO Watch"
    },
    {
      "os": "android",
      "brand": "Premier",
      "name": "TAB-7304-16G3GS"
    },
    {
      "os": "android",
      "brand": "Rakuten",
      "name": "C330"
    },
    {
      "os": "android",
      "brand": "Rakuten",
      "name": "Rakuten BIG s"
    },
    {
      "os": "android",
      "brand": "Rakuten",
      "name": "Rakuten Hand"
    },
    {
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Z Flip3 5G"
    },
    {
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Z Flip"
    },
    {
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Z Flip 5G"
    },
    {
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Note20 5G"
    },
    {
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Note20"
    },
    {
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Note20 Ultra 5G"
    },
    {
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Note20 Ultra"
    },
    {
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Watch4"
    },
    {
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Watch4"
    },
    {
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy S21 5G"
    },
    {
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy S21 Ultra 5G"
    },
    {
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy S21+ 5G"
    },
    {
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Watch4 Classic"
    },
    {
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy Watch4 Classic"
    },
    {
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy S20 5G"
    },
    {
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy S20+ 5G"
    },
    {
      "os": "android",
      "brand": "Samsung",
      "name": "Galaxy S20 Ultra 5G"
    },
    {
      "os": "android",
      "brand": "Sharp",
      "name": "AQUOS sense4 lite SH-RM15"
    },
    {
      "os": "android",
      "brand": "Surface",
      "name": "Surface Duo"
    },
    {
      "os": "android",
      "brand": "TAG-TECH",
      "name": "TAG-TAB-III"
    },
    {
      "os": "android",
      "brand": "Teclast",
      "name": "X_EEA"
    },
    {
      "os": "android",
      "brand": "Vsmart",
      "name": "Active 1"
    },
    {
      "os": "android",
      "brand": "Zebra",
      "name": "EC55"
    },
    {
      "os": "android",
      "brand": "Zebra",
      "name": "ET56"
    },
    {
      "os": "android",
      "brand": "Zebra",
      "name": "ET56"
    },
    {
      "os": "android",
      "brand": "Zebra",
      "name": "Zebra Technologies L10"
    },
    {
      "os": "android",
      "brand": "Zebra",
      "name": "Zebra Technologies MC2700"
    },
    {
      "os": "android",
      "brand": "Zebra",
      "name": "TC26"
    },
    {
      "os": "android",
      "brand": "Zebra",
      "name": "TC57"
    },
    {
      "os": "android",
      "brand": "Zebra",
      "name": "Zebra Technologies TC57x"
    },
    {
      "os": "android",
      "brand": "Zebra",
      "name": "TC77"
    },
    {
      "os": "android",
      "brand": "ZTE",
      "name": "ZR01"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPad mini 5th Gen"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Air 3rd Gen"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPad 8th Gen (WiFi+Cellular)"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 12.9 inch 5th Gen"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 12.9 inch 5th Gen"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPad air 4th Gen (WiFi+Cellular)"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 11 inch 3rd Gen"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 11 inch 3rd Gen"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 11 inch 3rd Gen"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 11 inch 3rd Gen"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 12.9 inch 5th Gen"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 12.9 inch 5th Gen"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 11 inch 4th Gen (WiFi+Cellular)"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 12.9 inch 4th Gen (WiFi+Cellular)"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 11 inch 3rd Gen (WiFi+Cellular)"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 11 inch 3rd Gen (1TB, WiFi+Cellular)"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 12.9 inch 3rd Gen (WiFi+Cellular)"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPad Pro 12.9 inch 3rd Gen (1TB, WiFi+Cellular)"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone XS"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone XS Max"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone XS Max Global"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone XR"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone 11"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone 11 Pro"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone 11 Pro Max"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone SE 2nd Gen"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone 12 Mini"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone 12"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone 12 Pro"
    },
    {
      "os": "ios",
      "brand": "Apple",
      "name": "iPhone 12 Pro Max"
    }
  ]
}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|[object]|true|none||none|
|»» os|string|true|none||none|
|»» brand|string|true|none||none|
|»» name|string|true|none||none|

# REST API/Endpoints/Notifications

## POST Webhook simulator

POST /v2/simulator/webhook

With this endpoint, you can trigger a `Low data notification` webhook event with mock data to your opted-in webhook URL. This is useful during the testing/integration phase where you can test your server when receiving such events.

Parameters

- "event" - string **required**
    
- "type" - string **required**
    
- "iccid" - string **optional**
    

For more informations, best practices visit our FAQ page: [https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ](https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ)

> Body Parameters

```json
{
  "event": "low_data_notification",
  "type": "expire_1",
  "iccid": "8997212330099025334"
}
```

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|Authorization|header|string| yes |none|
|body|body|object| no |none|
|» event|body|string| yes |none|
|» type|body|string| yes |none|
|» iccid|body|string| yes |none|

> Response Examples

> 200 Response

```
{"success":"Notification sent"}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» success|string|true|none||none|

# REST API/Endpoints/Notifications/Notification: Async orders

## POST Opt in

POST /v2/notifications/opt-in

:::info
Email notifications for Async orders are not supported.
:::

This feature allows you to subscribe to `Async orders` notifications. You will receive the order's data payload on your specified webhook url. It will also include Airalo's signature header which ensures maximum security it was us who send you this HTTP request (check [https://partners-doc.airalo.com/#827cb567-db17-484a-a484-5ca10b7fa41b](https://partners-doc.airalo.com/#827cb567-db17-484a-a484-5ca10b7fa41b))

**Parameters**

- `type`: "async_orders"
    
- `webhook_url`: "[https://example.com"](https://example.com) - in case of notification to be  
    delivered via your webhook implementation, provide your webhook  
    implementation url
    

The response will include the `contact_point` field, which reflects webhook URL you provided when opting in to the webhook. 

> Body Parameters

```json
{
  "type": "async_orders",
  "webhook_url": "https://example.com"
}
```

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|Accept|header|string| yes |none|
|Authorization|header|string| yes |none|
|body|body|object| no |none|
|» type|body|string| yes |none|
|» webhook_url|body|string| yes |none|

> Response Examples

> 200 Response

```
{"data":{"notification":{"type":"async_orders","contact_point":"https://example.com"}},"meta":{"message":"success"}}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» notification|object|true|none||none|
|»»» type|string|true|none||none|
|»»» contact_point|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

## GET Get notification details

GET /v2/notifications/opt-in

This endpoint allows you to retrieve the details of `Async orders notification` from the Airalo partner API. If the below highlighted response is returned, it means you are successfully opted in for the notification.

The access token, obtained from the [Request Access Token endpoint](https://developers.partners.airalo.com/request-access-token-11883021e0), should be included in the request.

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|Accept|header|string| yes |none|
|Authorization|header|string| yes |none|

> Response Examples

> 200 Response

```
{"data":{"notification":{"type":"async_orders","contact_point":"https://example.com"}},"meta":{"message":"success"}}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» notification|object|true|none||none|
|»»» type|string|true|none||none|
|»»» contact_point|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

## POST Opt out

POST /v2/notifications/opt-out

This endpoint allows you to opt out of notifications regarding async orders.

> Body Parameters

```json
{
  "type": "async_orders"
}
```

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|Accept|header|string| yes |none|
|Authorization|header|string| yes |none|
|body|body|object| no |none|
|» type|body|string| yes |none|

> Response Examples

> 204 Response

```
{}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|204|[No Content](https://tools.ietf.org/html/rfc7231#section-6.3.5)|none|Inline|

### Responses Data Schema

# REST API/Endpoints/Check balance

## GET Get balance

GET /v2/balance

This feature allow you to know your account balances, so you can have an overview on your financial portfolio. You can monitor my balances and can top-up my Airalo credit to avoid order failing due to Insufficient funds If there is no account, the response should be an empty array for the accounts

For more informations, best practices visit our FAQ page: [https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ](https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ)

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|Authorization|header|string| yes |none|

> Response Examples

> 200 Response

```
{"data":{"balances":{"name":"balance","availableBalance":{"amount":0,"currency":"USD"}}},"meta":{"message":"success"}}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### Responses Data Schema

HTTP Status Code **200**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» balances|object|true|none||none|
|»»» name|string|true|none||none|
|»»» availableBalance|object|true|none||none|
|»»»» amount|integer|true|none||none|
|»»»» currency|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

# REST API/Endpoints/Request refund

## POST Request refund

POST /v2/refund

# Overview

The Airalo Refund API makes it simple to request refunds for eSIMs. This guide walks you through everything you need to know, including the API endpoint, request and response formats, error handling, and sample requests.

## ⚠️ Important Disclaimer

> **The Refund API helps streamline the refund request process by reducing manual effort. However, submitting a request through this API does *not* guarantee approval.**  
>  
> Each refund request is **individually** reviewed based on Airalo's Refund Policy to ensure it meets all terms and conditions. Refund approvals remain subject to Airalo’s internal policies and decisions.  
>  If your request meets the contract terms, the refund will be credited to your account as Airalo credits, ready to use for future transactions.
>

> Body Parameters

```
iccids:
  - "894000000000001"
  - "894000000000002"
reason: SERVICE_ISSUES
notes: Connection issues in the region.

```

### Params

|Name|Location|Type|Required|Description|
|---|---|---|---|---|
|Accept|header|string| no |Indicates the expected response format.|
|Authorization|header|string| no |Bearer token for authenticating the request|
|body|body|string| no |none|

> Response Examples

> 202 Response

```json
{
  "data": {
    "refund_id": "12345",
    "created_at": "2024-10-12 09:30"
  },
  "meta": {
    "message": "success"
  }
}
```

> 422 Response

```json
{
  "data": [],
  "meta": {
    "message": "The following ICCIDs do not belong to your company: 894000000000001, 894000000000002"
  }
}
```

### Responses

|HTTP Status Code |Meaning|Description|Data schema|
|---|---|---|---|
|202|[Accepted](https://tools.ietf.org/html/rfc7231#section-6.3.3)|none|Inline|
|422|[Unprocessable Entity](https://tools.ietf.org/html/rfc2518#section-10.3)|none|Inline|

### Responses Data Schema

HTTP Status Code **202**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|object|true|none||none|
|»» refund_id|string|true|none||none|
|»» created_at|string|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

HTTP Status Code **422**

|Name|Type|Required|Restrictions|Title|description|
|---|---|---|---|---|---|
|» data|[string]|true|none||none|
|» meta|object|true|none||none|
|»» message|string|true|none||none|

# Data Schema

<h2 id="tocS_Pet">Pet</h2>

<a id="schemapet"></a>
<a id="schema_Pet"></a>
<a id="tocSpet"></a>
<a id="tocspet"></a>

```json
{
  "id": 1,
  "category": {
    "id": 1,
    "name": "string"
  },
  "name": "doggie",
  "photoUrls": [
    "string"
  ],
  "tags": [
    {
      "id": 1,
      "name": "string"
    }
  ],
  "status": "available"
}

```

### Attribute

|Name|Type|Required|Restrictions|Title|Description|
|---|---|---|---|---|---|
|id|integer(int64)|true|none||Pet ID|
|category|[Category](#schemacategory)|true|none||group|
|name|string|true|none||name|
|photoUrls|[string]|true|none||image URL|
|tags|[[Tag](#schematag)]|true|none||tag|
|status|string|true|none||Pet Sales Status|

#### Enum

|Name|Value|
|---|---|
|status|available|
|status|pending|
|status|sold|

<h2 id="tocS_Category">Category</h2>

<a id="schemacategory"></a>
<a id="schema_Category"></a>
<a id="tocScategory"></a>
<a id="tocscategory"></a>

```json
{
  "id": 1,
  "name": "string"
}

```

### Attribute

|Name|Type|Required|Restrictions|Title|Description|
|---|---|---|---|---|---|
|id|integer(int64)|false|none||Category ID|
|name|string|false|none||Category Name|

<h2 id="tocS_Tag">Tag</h2>

<a id="schematag"></a>
<a id="schema_Tag"></a>
<a id="tocStag"></a>
<a id="tocstag"></a>

```json
{
  "id": 1,
  "name": "string"
}

```

### Attribute

|Name|Type|Required|Restrictions|Title|Description|
|---|---|---|---|---|---|
|id|integer(int64)|false|none||Tag ID|
|name|string|false|none||Tag Name|

