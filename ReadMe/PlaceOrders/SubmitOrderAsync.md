# Submit order async

> Local implementation note: this file mirrors Airalo's upstream contract, where
> `quantity` can be up to 50. Simplify intentionally caps checkout/order
> quantity at 10; see `docs/operations/airalo-submit-order.md`.

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ""
  description: ""
  version: 1.0.0
paths:
  /v2/orders-async:
    post:
      summary: Submit order async
      deprecated: false
      description: >-
        This endpoint allows you to submit an asynchronous order to the Airalo
        Partners API. This ensures greater performance and reduces the wait time
        for your desired flow. Each async order will generate unique `nanoid`
        stored in reponse's `request_id` - Make sure you store this id in your
        system, as it is a reference for the order which is pending processing.
        You should check map it for every successfully received order response
        on your webhook url.


        Provide the required information, such as quantity and package ID, and
        include optional description if needed.


        The access token, obtained from the "Request Access Token" endpoint,
        should be included in the request.


        For more information and best practices visit our [FAQ
        page](https://developers.partners.airalo.com/faq-752238m0)



        **direct_apple_installation_url:**


        Partner API now supports direct installation on iOS devices. With the
        introduction of Universal Links by Apple, users with iOS 17.4 or higher
        can directly install eSIMs using a special URL, which can be provided to
        your end clients if they are using iOS version 17.4 or above.
      tags:
        - REST API/Endpoints/Place order
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
                quantity:
                  description: Required. The quantity of items in the order. Maximum of 50.
                  example: "1"
                  type: string
                package_id:
                  description: >-
                    Required. The package ID associated with the order. You can
                    obtain this from the "Packages / Get Packages" endpoint.
                  example: kallur-digital-7days-1gb
                  type: string
                type:
                  description: >-
                    Optional. The only possible value for this endpoint is
                    "sim". If left empty, default "sim" value will be used.
                  example: sim
                  type: string
                description:
                  description: >-
                    Optional. A custom description for the order, which can help
                    you identify it later.
                  example: 1 sim kallur-digital-7days-1gb
                  type: string
                webhook_url:
                  description: >-
                    Optional. A custom, valid url to which you will receive the
                    order details data asynchronously. Note that you can optin
                    or provide in request. `The webhook_url if provided in
                    payload will overwrite the one which is opted in.`
                  example: https://your-webhook.com
                  type: string
                brand_settings_name:
                  description: >-
                    Nullable. The definition under what brand the eSIM should be
                    shared. Null for unbranded.
                  example: our perfect brand
                  type: string
                to_email:
                  description: >-
                    Optional. If specified, email with esim sharing will be
                    sent. sharing_option should be specified as well.
                  example: valid_email@address.com
                  type: string
                sharing_option[]:
                  description: >-
                    Optional. Array. Required when to_email is set. Available
                    options: link, pdf
                  example: link
                  type: string
                copy_address[]:
                  description: Optional. Array. It uses when to_email is set.
                  example: valid_email@address.com
                  type: string
              required:
                - quantity
                - package_id
            examples: {}
      responses:
        "200":
          description: ""
          content:
            "*/*":
              schema:
                type: object
                properties: {}
                x-apidog-orders: []
          headers: {}
          x-apidog-name: Webhook push example
        "202":
          description: ""
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      request_id:
                        type: string
                      accepted_at:
                        type: string
                    required:
                      - request_id
                      - accepted_at
                    x-apidog-orders:
                      - request_id
                      - accepted_at
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
                  summary: Submit Order Async (202)
                  value:
                    data:
                      request_id: 3NhR3gKmqCWK7IWppurpDX3Cg
                      accepted_at: "2024-07-11 15:26:02"
                    meta:
                      message: success
                "2":
                  summary: Submit Order Async (422)
                  value:
                    data:
                      package_id: The selected package is invalid.
                      quantity: The quantity may not be greater than 50.
                    meta:
                      message: the parameter is invalid
                "3":
                  summary: Submit Order Async (422) SIM quantity is not available
                  value:
                    data:
                      quantity: "SIM quantity is not available. Available quantity: 9."
                    meta:
                      message: the parameter is invalid
                "4":
                  summary: >-
                    Submit Order Async (422) Not opted in and no webhook_url
                    provided
                  value:
                    reason: User is not opted in and no webhook URL provided.
          headers: {}
          x-apidog-name: Submit Order Async (202)
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
                      quantity:
                        type: string
                    required:
                      - package_id
                      - quantity
                    x-apidog-orders:
                      - package_id
                      - quantity
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
          x-apidog-name: Submit Order Async (422)
        x-422:Submit Order Async (422) SIM quantity is not available:
          description: ""
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      quantity:
                        type: string
                    required:
                      - quantity
                    x-apidog-orders:
                      - quantity
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
          x-apidog-name: Submit Order Async (422) SIM quantity is not available
        x-422:Submit Order Async (422) Not opted in and no webhook_url provided:
          description: ""
          content:
            application/json:
              schema:
                type: object
                properties:
                  reason:
                    type: string
                required:
                  - reason
                x-apidog-orders:
                  - reason
          headers: {}
          x-apidog-name: Submit Order Async (422) Not opted in and no webhook_url provided
      security: []
      x-apidog-folder: REST API/Endpoints/Place order
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/742850/apis/api-11883025-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://partners-api.airalo.com
    description: Prod Env
security: []
```
