# Get top-up package list

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ""
  description: ""
  version: 1.0.0
paths:
  /v2/sims/{iccid}/topups:
    get:
      summary: Get  top-up package list
      deprecated: false
      description: >-
        **Overview**

        Use this endpoint to retrieve the top-up packages that can be purchased
        for a specific eSIM. When you call the endpoint with an eSIM’s ICCID,
        the response returns the eligible top-up packages for that eSIM (based
        on the ICCID provided). The endpoint supports new type of packages:
        “Voice and Text”.

        This endpoint is designed for the top-up flow: it helps you present only
        the top-ups that are actually available for the eSIM’s
        operator/configuration, along with the package details you need to
        display and sell them (e.g., package ID, price, data amount, and
        duration).⁠


        **Note for unlimited packages** 

        - For unlimited packages the `remaining`, `total` and `amount` fields
        will default to `0` should be ignored, and not displayed to the end
        users.

        - When in [Sandbox
        mode](https://developers.partners.airalo.com/sandbox-mode-2114305m0),
        the `is_unlimited` field can be `false` for an unlimited package
        ordered, due to not having real eSIMs available, thus don't reflect real
        usage.


        **How to use this endpoint**


        - Make a request to this endpoint and provide the `iccid` of the eSIM
        for which you want to retrieve top-up packages for.

        - The API will respond with a JSON object containing an array of
        purchased top-up packages for the eSIM, each of which includes an ID,
        remaining data amount, activation and expiration dates, and other
        relevant information.



        For more information and best practices visit our [FAQ
        page](https://developers.partners.airalo.com/faq-752238m0).
      tags:
        - REST API/Endpoints/Top up eSIM
      parameters:
        - name: iccid
          in: path
          description: >
            eSIM ICCID, used to query a list of available top-up packages.

            Required. Can be obtained by execuring GET to the "eSIMs List"
            endpoint
          required: true
          example: "8910300000005271146"
          schema:
            type: string
        - name: Accept
          in: header
          description: ""
          required: true
          example: application/json
          schema:
            type: string
        - name: Authorization
          in: header
          description: ""
          required: true
          example: Bearer {{token}}
          schema:
            type: string
        - name: url
          in: header
          description: ""
          example: https://partners-api.airalo.com
          schema:
            type: string
            default: https://partners-api.airalo.com
      responses:
        "200":
          description: ""
          content:
            application/json:
              schema:
                type: object
                properties:
                  pricing:
                    type: object
                    properties:
                      model:
                        type: string
                      discount_percentage:
                        type: integer
                    required:
                      - model
                      - discount_percentage
                    x-apidog-orders:
                      - model
                      - discount_percentage
                  data:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                        type:
                          type: string
                        price:
                          type: integer
                        amount:
                          type: integer
                        day:
                          type: integer
                        is_unlimited:
                          type: boolean
                        title:
                          type: string
                        data:
                          type: string
                        short_info:
                          type: string
                        voice:
                          type: integer
                        text:
                          type: integer
                        net_price:
                          type: integer
                      required:
                        - id
                        - type
                        - price
                        - amount
                        - day
                        - is_unlimited
                        - title
                        - data
                        - short_info
                        - voice
                        - text
                        - net_price
                      x-apidog-orders:
                        - id
                        - type
                        - price
                        - amount
                        - day
                        - is_unlimited
                        - title
                        - data
                        - short_info
                        - voice
                        - text
                        - net_price
                required:
                  - pricing
                  - data
                x-apidog-orders:
                  - pricing
                  - data
              examples:
                "1":
                  summary: "eSIM: List available top-up packages: 200 OK"
                  value:
                    pricing:
                      model: net_pricing
                      discount_percentage: 0
                    data:
                      - id: bonbon-mobile-30days-3gb-topup
                        type: topup
                        price: 10
                        amount: 3072
                        day: 30
                        is_unlimited: false
                        title: 3 GB - 100 SMS - 100 Mins - 30 Days
                        data: 3 GB
                        short_info: This eSIM doesn't come with a phone number.
                        voice: 100
                        text: 100
                        net_price: 8
                      - id: bonbon-mobile-30days-5gb-topup
                        type: topup
                        price: 14
                        amount: 5120
                        day: 30
                        is_unlimited: false
                        title: 5 GB - 30 Days
                        data: 5 GB
                        short_info: This eSIM doesn't come with a phone number.
                        voice: 100
                        text: 100
                        net_price: 11.2
                      - id: bonbon-mobile-30days-10gb-topup
                        type: topup
                        price: 23
                        amount: 10240
                        day: 30
                        is_unlimited: false
                        title: 10 GB - 30 Days
                        data: 10 GB
                        short_info: This eSIM doesn't come with a phone number.
                        voice: 100
                        text: 100
                        net_price: 18.4
                "2":
                  summary: >-
                    eSIM: List available top-up packages: 200 (No top-up
                    packages available)
                  value:
                    data: []
                "3":
                  summary: "eSIM: List available top-up packages: 404 (Invalid ICCID)"
                  value:
                    data: []
                    meta:
                      message: messages.resource_not_found
                "4":
                  summary: Recycled Sim Response
                  value:
                    code: 73
                    reason: >-
                      The eSIM with iccid 8910300000005271146 has been recycled.
                      It can no longer be used or topped up.
                "5":
                  summary: Success
                  value:
                    pricing:
                      model: discount_pricing
                      discount_percentage: 10
                    data:
                      - id: bonbon-mobile-30days-3gb-topup
                        type: topup
                        price: 10
                        amount: 3072
                        day: 30
                        is_unlimited: false
                        title: 3 GB - 100 SMS - 100 Mins - 30 Days
                        data: 3 GB
                        short_info: This eSIM doesn't come with a phone number.
                        voice: 100
                        text: 100
                        net_price: null
                      - id: bonbon-mobile-30days-5gb-topup
                        type: topup
                        price: 14
                        amount: 5120
                        day: 30
                        is_unlimited: false
                        title: 5 GB - 30 Days
                        data: 5 GB
                        short_info: This eSIM doesn't come with a phone number.
                        voice: 100
                        text: 100
                        net_price: null
                      - id: bonbon-mobile-30days-10gb-topup
                        type: topup
                        price: 23
                        amount: 10240
                        day: 30
                        is_unlimited: false
                        title: 10 GB - 30 Days
                        data: 10 GB
                        short_info: This eSIM doesn't come with a phone number.
                        voice: 100
                        text: 100
                        net_price: null
          headers: {}
          x-apidog-name: "eSIM: List available top-up packages: 200 OK"
        "422":
          description: ""
          content:
            application/json:
              schema:
                type: object
                properties:
                  code:
                    type: integer
                  reason:
                    type: string
                required:
                  - code
                  - reason
                x-apidog-orders:
                  - code
                  - reason
          headers: {}
          x-apidog-name: "eSIM: List available top-up packages:  (Recycled Sim Response 422)"
        "x-200:eSIM: List available top-up packages: 200 (No top-up packages available)":
          description: ""
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      type: string
                required:
                  - data
                x-apidog-orders:
                  - data
          headers: {}
          x-apidog-name: >-
            eSIM: List available top-up packages: 200 (No top-up packages
            available)
        "x-200:eSIM: List available top-up packages: 404 (Invalid ICCID)":
          description: ""
          content:
            "*/*":
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      type: string
                  meta:
                    type: object
                    properties:
                      message:
                        type: string
                    required:
                      - message
                    x-apidog-orders:
                      - message
                required:
                  - data
                  - meta
                x-apidog-orders:
                  - data
                  - meta
          headers: {}
          x-apidog-name: "eSIM: List available top-up packages: 404 (Invalid ICCID)"
        "x-200:(Discount pricing) eSIM: List available top-up packages":
          description: ""
          content:
            application/json:
              schema:
                type: object
                properties:
                  pricing:
                    type: object
                    properties:
                      model:
                        type: string
                      discount_percentage:
                        type: integer
                    required:
                      - model
                      - discount_percentage
                    x-apidog-orders:
                      - model
                      - discount_percentage
                  data:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                        type:
                          type: string
                        price:
                          type: integer
                        amount:
                          type: integer
                        day:
                          type: integer
                        is_unlimited:
                          type: boolean
                        title:
                          type: string
                        data:
                          type: string
                        short_info:
                          type: string
                        voice:
                          type: integer
                        text:
                          type: integer
                        net_price:
                          type: "null"
                      required:
                        - id
                        - type
                        - price
                        - amount
                        - day
                        - is_unlimited
                        - title
                        - data
                        - short_info
                        - voice
                        - text
                        - net_price
                      x-apidog-orders:
                        - id
                        - type
                        - price
                        - amount
                        - day
                        - is_unlimited
                        - title
                        - data
                        - short_info
                        - voice
                        - text
                        - net_price
                required:
                  - pricing
                  - data
                x-apidog-orders:
                  - pricing
                  - data
          headers: {}
          x-apidog-name: "(Discount pricing) eSIM: List available top-up packages"
      security: []
      x-apidog-folder: REST API/Endpoints/Top up eSIM
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/742850/apis/api-11883031-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://partners-api.airalo.com
    description: Prod Env
security: []
```
