# Submit top-up order

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ""
  description: ""
  version: 1.0.0
paths:
  /v2/orders/topups:
    post:
      summary: Submit top-up order
      deprecated: false
      description: >
        **To submit a top-up order:**


        This endpoint allows you purchase a top-up package for a specific eSIM
        providing the below parameters to your request: 


        1) `package_id`: The ID of the top-up package you want to purchase.


        2) `iccid`: The ICCID of the eSIM for which you want to purchase the
        top-up package.


        You can also include an optional `description` field to provide
        additional information about the order.


        The API will respond with a JSON object containing the details of the
        order, including the package ID, quantity, price, and other relevant
        information.


        **The complete workflow for buying a top-up package:**


        1) Call the [GET eSIMS list](/get-esims-list-11883027e0) to see the list
        of previously purchased eSIMs  

        2) Call the [Get top-up package
        list](/get-top-up-package-list-11883031e0) to see the list of available
        top-ups for the eSIM providing its `iccid` you retrieved from point 1.

        3) Submit an order on [Submit top-up
        order](/submit-top-up-order-11883026e0) endpoint
         with the `iccid` you wish to buy the top-up package for, and provide also `package_id`of the top-up package to purchase.
        4) Call the [Get eSIM package
        history](/get-esim-package-history-11883032e0) endpoint
         to see the list of all packages bought for that eSIM.

        For more information and best practices visit our [FAQ
        page](https://developers.partners.airalo.com/faq-752238m0)
      tags:
        - REST API/Endpoints/Top up eSIM
      parameters:
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
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                package_id:
                  description: >-
                    Required. A Topup Package ID, can be obtainer by executing a
                    GET request to the "eSIM: List available top-up packages"
                    endpoint
                  example: change-7days-1gb-topup
                  type: string
                iccid:
                  description: >
                    Required. eSIM ICCID, that identifies the eSIM for the
                    top-up package.

                    Can be obtained by execuring GET to the "eSIMs List"
                    endpoint
                  example: "873000000000042542"
                  type: string
                description:
                  description: Optional. Order description to identify the order.
                  example: Example description to identify the order
                  type: string
              required:
                - package_id
                - iccid
                - description
            examples: {}
      responses:
        "200":
          description: ""
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      id:
                        type: integer
                      code:
                        type: string
                      package_id:
                        type: string
                      currency:
                        type: string
                      quantity:
                        type: integer
                      type:
                        type: string
                      description:
                        type: string
                      esim_type:
                        type: string
                      validity:
                        type: integer
                      package:
                        type: string
                      data:
                        type: string
                      price:
                        type: number
                      pricing_model:
                        type: string
                      text:
                        type: "null"
                      voice:
                        type: "null"
                      net_price:
                        type: number
                      created_at:
                        type: string
                      manual_installation:
                        type: string
                      qrcode_installation:
                        type: string
                      installation_guides:
                        type: object
                        properties:
                          en:
                            type: string
                        required:
                          - en
                        x-apidog-orders:
                          - en
                    required:
                      - id
                      - code
                      - package_id
                      - currency
                      - quantity
                      - type
                      - description
                      - esim_type
                      - validity
                      - package
                      - data
                      - price
                      - pricing_model
                      - text
                      - voice
                      - net_price
                      - created_at
                      - manual_installation
                      - qrcode_installation
                      - installation_guides
                    x-apidog-orders:
                      - id
                      - code
                      - package_id
                      - currency
                      - quantity
                      - type
                      - description
                      - esim_type
                      - validity
                      - package
                      - data
                      - price
                      - pricing_model
                      - text
                      - voice
                      - net_price
                      - created_at
                      - manual_installation
                      - qrcode_installation
                      - installation_guides
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
              examples:
                "1":
                  summary: "Submit Top-up Order: 200 OK"
                  value:
                    data:
                      id: 111
                      code: 20251118-000111
                      package_id: change-7days-1gb-topup
                      currency: USD
                      quantity: 1
                      type: topup
                      description: Topup (873000000000042542)
                      esim_type: local
                      validity: 7
                      package: Change-1 GB - 7 Days
                      data: 1 GB
                      price: 4.5
                      pricing_model: net_pricing
                      text: null
                      voice: null
                      net_price: 3.6
                      created_at: "2025-11-18 13:37:07"
                      manual_installation: "<p><b>eSIM name:</b>\_Change</p><p><b>Coverage:\_</b>United States</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol>"
                      qrcode_installation: "<p><b>eSIM name:</b>\_Change</p><p><b>Coverage:\_</b>United States</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol>"
                      installation_guides:
                        en: >-
                          https://www.airalo.com/help/getting-started-with-airalo
                    meta:
                      message: success
                "2":
                  summary: "Submit Top-up Order: 422 (Purchase limit exceeded)"
                  value:
                    data:
                      package_id: validation.order_exceed_limit
                    meta:
                      message: the parameter is invalid
                "3":
                  summary: "Submit Top-up Order: 422 (Required fields are missing)"
                  value:
                    data:
                      iccid: The iccid field is required.
                      package_id: The package id field is required.
                    meta:
                      message: the parameter is invalid
                "4":
                  summary: "Submit Top-up Order: 422 (Invalid package id)"
                  value:
                    data:
                      package_id: invalid topup package
                    meta:
                      message: the parameter is invalid
                "5":
                  summary: Example 1
                  value:
                    code: 73
                    reason: >-
                      The eSIM with iccid 89340000000000872 has been recycled.
                      It can no longer be used or topped up.
          headers: {}
          x-apidog-name: "Submit Top-up Order: 200 OK"
        "422":
          description: ""
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      package_id:
                        type: string
                    required:
                      - package_id
                    x-apidog-orders:
                      - package_id
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
          x-apidog-name: "Submit Top-up Order: 422 (Purchase limit exceeded)"
        "x-422:Submit Top-up Order: 422 (Required fields are missing)":
          description: ""
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      iccid:
                        type: string
                      package_id:
                        type: string
                    required:
                      - iccid
                      - package_id
                    x-apidog-orders:
                      - iccid
                      - package_id
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
          x-apidog-name: "Submit Top-up Order: 422 (Required fields are missing)"
        "x-422:Submit Top-up Order: 422 (Invalid package id)":
          description: ""
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      package_id:
                        type: string
                    required:
                      - package_id
                    x-apidog-orders:
                      - package_id
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
          x-apidog-name: "Submit Top-up Order: 422 (Invalid package id)"
        "x-422:Submit Top-up Order: 422 (Recycled sim)":
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
          x-apidog-name: "Submit Top-up Order: 422 (Recycled sim)"
        x-200:(Discount pricing) Submit Top-up Order:
          description: ""
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      id:
                        type: integer
                      code:
                        type: string
                      package_id:
                        type: string
                      currency:
                        type: string
                      quantity:
                        type: integer
                      type:
                        type: string
                      description:
                        type: string
                      esim_type:
                        type: string
                      validity:
                        type: integer
                      package:
                        type: string
                      data:
                        type: string
                      price:
                        type: number
                      pricing_model:
                        type: string
                      discount_percentage:
                        type: integer
                      discount_amount:
                        type: number
                      unit_paid_price:
                        type: number
                      total_amount_paid:
                        type: number
                      text:
                        type: "null"
                      voice:
                        type: "null"
                      net_price:
                        type: "null"
                      created_at:
                        type: string
                      manual_installation:
                        type: string
                      qrcode_installation:
                        type: string
                      installation_guides:
                        type: object
                        properties:
                          en:
                            type: string
                        required:
                          - en
                        x-apidog-orders:
                          - en
                    required:
                      - id
                      - code
                      - package_id
                      - currency
                      - quantity
                      - type
                      - description
                      - esim_type
                      - validity
                      - package
                      - data
                      - price
                      - pricing_model
                      - discount_percentage
                      - discount_amount
                      - unit_paid_price
                      - total_amount_paid
                      - text
                      - voice
                      - net_price
                      - created_at
                      - manual_installation
                      - qrcode_installation
                      - installation_guides
                    x-apidog-orders:
                      - id
                      - code
                      - package_id
                      - currency
                      - quantity
                      - type
                      - description
                      - esim_type
                      - validity
                      - package
                      - data
                      - price
                      - pricing_model
                      - discount_percentage
                      - discount_amount
                      - unit_paid_price
                      - total_amount_paid
                      - text
                      - voice
                      - net_price
                      - created_at
                      - manual_installation
                      - qrcode_installation
                      - installation_guides
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
              example:
                data:
                  id: 619
                  code: 20251118-000619
                  package_id: change-7days-1gb-topup
                  currency: USD
                  quantity: 1
                  type: topup
                  description: Topup (873000000000042534)
                  esim_type: Prepaid
                  validity: 7
                  package: Change-1 GB - 7 Days
                  data: 1 GB
                  price: 4.5
                  pricing_model: discount_pricing
                  discount_percentage: 10
                  discount_amount: 0.45
                  unit_paid_price: 4.05
                  total_amount_paid: 4.05
                  text: null
                  voice: null
                  net_price: null
                  created_at: "2025-11-18 13:40:21"
                  manual_installation: "<p><b>eSIM name:</b>\_Change</p><p><b>Coverage:\_</b>United States</p><p><b>To manually activate the eSIM on your eSIM capable device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Manually enter the SM-DP+ Address and activation code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol>"
                  qrcode_installation: "<p><b>eSIM name:</b>\_Change</p><p><b>Coverage:\_</b>United States</p><p><b>To activate the eSIM by scanning the QR code on your eSIM capable device you need to print or display this QR code on other device:</b></p><ol><li>Settings > Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan QR code.</li><li>Confirm eSIM plan details.</li><li>Label the eSIM.</li></ol><p><b>To access Data:</b></p><ol><li>Enable data roaming.</li></ol>"
                  installation_guides:
                    en: https://www.airalo.com/help/getting-started-with-airalo
                meta:
                  message: success
          headers: {}
          x-apidog-name: (Discount pricing) Submit Top-up Order
      security: []
      x-apidog-folder: REST API/Endpoints/Top up eSIM
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/742850/apis/api-11883026-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://partners-api.airalo.com
    description: Prod Env
security: []
```
