# Get eSIM

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ""
  description: ""
  version: 1.0.0
paths:
  /v2/sims/{sim_iccid}:
    get:
      summary: Get eSIM
      deprecated: false
      description: >-
        This endpoint allows you to retrieve the details of a specific eSIM from
        the Airalo Partners API using the eSIM's ICCID. Note that only eSIM
        orders made via the API are retrievable via this endpoint. You can
        include related data in the response by specifying optional parameters.


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
        - REST API/Endpoints/Install eSIM
      parameters:
        - name: sim_iccid
          in: path
          description: The ICCID of the eSIM for which you want to retrieve the details.
          required: true
          example: ""
          schema:
            type: string
        - name: include
          in: query
          description: >-
            Optional. A comma-separated string to include related data in the
            response. Possible values are "order", "order.status", "order.user"
            and "share".
          required: false
          example: order,order.status,order.user,share
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
                  data:
                    type: object
                    properties:
                      id:
                        type: integer
                      created_at:
                        type: string
                      iccid:
                        type: string
                      lpa:
                        type: string
                      imsis:
                        type: "null"
                      matching_id:
                        type: string
                      qrcode:
                        type: string
                      qrcode_url:
                        type: string
                      direct_apple_installation_url:
                        type: string
                      voucher_code:
                        type: "null"
                      airalo_code:
                        type: "null"
                      apn_type:
                        type: string
                      apn_value:
                        type: "null"
                      is_roaming:
                        type: boolean
                      confirmation_code:
                        type: string
                      order:
                        type: "null"
                      brand_settings_name:
                        type: string
                      simable:
                        type: object
                        properties:
                          id:
                            type: integer
                          created_at:
                            type: string
                          code:
                            type: string
                          description:
                            type: "null"
                          type:
                            type: string
                          package_id:
                            type: string
                          quantity:
                            type: integer
                          package:
                            type: string
                          esim_type:
                            type: string
                          validity:
                            type: string
                          price:
                            type: string
                          data:
                            type: string
                          currency:
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
                          status:
                            type: object
                            properties:
                              name:
                                type: string
                              slug:
                                type: string
                            required:
                              - name
                              - slug
                            x-apidog-orders:
                              - name
                              - slug
                          user:
                            type: object
                            properties:
                              id:
                                type: integer
                              created_at:
                                type: string
                              name:
                                type: string
                              email:
                                type: string
                              mobile:
                                type: "null"
                              address:
                                type: "null"
                              state:
                                type: "null"
                              city:
                                type: "null"
                              postal_code:
                                type: "null"
                              country_id:
                                type: "null"
                              company:
                                type: string
                            required:
                              - id
                              - created_at
                              - name
                              - email
                              - mobile
                              - address
                              - state
                              - city
                              - postal_code
                              - country_id
                              - company
                            x-apidog-orders:
                              - id
                              - created_at
                              - name
                              - email
                              - mobile
                              - address
                              - state
                              - city
                              - postal_code
                              - country_id
                              - company
                          sharing:
                            type: object
                            properties:
                              link:
                                type: string
                              access_code:
                                type: string
                            required:
                              - link
                              - access_code
                            x-apidog-orders:
                              - link
                              - access_code
                        required:
                          - id
                          - created_at
                          - code
                          - description
                          - type
                          - package_id
                          - quantity
                          - package
                          - esim_type
                          - validity
                          - price
                          - data
                          - currency
                          - manual_installation
                          - qrcode_installation
                          - installation_guides
                          - status
                          - user
                          - sharing
                        x-apidog-orders:
                          - id
                          - created_at
                          - code
                          - description
                          - type
                          - package_id
                          - quantity
                          - package
                          - esim_type
                          - validity
                          - price
                          - data
                          - currency
                          - manual_installation
                          - qrcode_installation
                          - installation_guides
                          - status
                          - user
                          - sharing
                      recycled:
                        type: boolean
                        description: true - if sim is recycled. - false - otherwise
                      recycled_at:
                        type: string
                        format: date-time
                        description: >-
                          Timestamp of when the sim was recycled in format Y-m-d
                          H:i:s
                        nullable: true
                    required:
                      - id
                      - created_at
                      - iccid
                      - lpa
                      - imsis
                      - matching_id
                      - qrcode
                      - qrcode_url
                      - direct_apple_installation_url
                      - voucher_code
                      - airalo_code
                      - apn_type
                      - apn_value
                      - is_roaming
                      - confirmation_code
                      - order
                      - brand_settings_name
                      - simable
                      - recycled
                      - recycled_at
                    x-apidog-orders:
                      - id
                      - created_at
                      - iccid
                      - lpa
                      - imsis
                      - matching_id
                      - qrcode
                      - qrcode_url
                      - direct_apple_installation_url
                      - voucher_code
                      - airalo_code
                      - apn_type
                      - apn_value
                      - is_roaming
                      - confirmation_code
                      - order
                      - brand_settings_name
                      - recycled
                      - recycled_at
                      - simable
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
                  id: 11028
                  created_at: "2023-02-27 08:30:14"
                  iccid: "8944465400000267221"
                  lpa: lpa.airalo.com
                  imsis: null
                  matching_id: TEST
                  qrcode: LPA:1$lpa.airalo.com$TEST
                  qrcode_url: >-
                    https://sandbox.airalo.com/qr?expires=1763800214&id=13282&signature=93bc1599eaaea3175eb32a9f23b3961273e97f04c50ba1b57b68ac99bc6677df
                  direct_apple_installation_url: >-
                    https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$wbg.prod.ondemandconnectivity.com$Y7MRQ886FCDJD4RH
                  voucher_code: null
                  airalo_code: null
                  apn_type: automatic
                  apn_value: null
                  is_roaming: true
                  confirmation_code: "5751"
                  order: null
                  brand_settings_name: our perfect brand
                  recycled: true
                  recycled_at: "2025-05-05 10:52:39"
                  simable:
                    id: 9647
                    created_at: "2023-02-27 08:30:14"
                    code: 20230227-009647
                    description: null
                    type: sim
                    package_id: kallur-digital-7days-1gb
                    quantity: 1
                    package: Kallur Digital-1 GB - 7 Days
                    esim_type: Prepaid
                    validity: "7"
                    price: "9.50"
                    data: 1 GB
                    currency: USD
                    manual_installation: >-
                      <p><b>eSIM name: </b>Kallur Digital</p><p><b>Coverage:</b>
                      Faroe Islands</p><p><b>To manually activate the eSIM on
                      your eSIM capable device:</b></p><p>1. Settings>
                      Cellular/Mobile> Add Cellular/Mobile Plan.</p><p>2.
                      Manually enter the SM-DP+ Address and activation
                      code.</p><p>3. Confirm the eSIM plan details</p><p>4.
                      Label the eSIM.</p><p><b>To access Data:</b></p><p>1.
                      Enable data roaming.</p><p><b>To
                      top-up:</b></p><p></p><p>Visit airalo.com/my-esims or "My
                      eSIMs" tab in your Airaloo app.</p><p><br></p>
                    qrcode_installation: >-
                      <p><b>eSIM name:</b> Kallur Digital</p><p><b>Coverage:
                      </b>Faroe Islands</p><p><b>To activate the eSIM by
                      scanning the QR code on your eSIM capable device you need
                      to print or display this QR code on other
                      device:</b></p><p>1. Settings> Cellular/Mobile> Add
                      Cellular/Mobile Plan.</p><p>2. Scan QR code</p><p>3.
                      Confirm the eSIM plan details</p><p>4. Label the
                      eSIM</p><p><b>To access Data:</b></p><p>1. Enable data
                      roaming</p>
                    installation_guides:
                      en: https://sandbox.airalo.com/installation-guide
                    status:
                      name: Completed
                      slug: completed
                    user:
                      id: 120
                      created_at: "2023-02-20 08:41:57"
                      name: User Name
                      email: email@domain.com
                      mobile: null
                      address: null
                      state: null
                      city: null
                      postal_code: null
                      country_id: null
                      company: Company Name
                    sharing:
                      link: https://esims.cloud/our-perfect-brand/a4g5ht-58sdf1a
                      access_code: "4812"
                meta:
                  message: succes
          headers: {}
          x-apidog-name: Get eSIM (200)
      security: []
      x-apidog-folder: REST API/Endpoints/Install eSIM
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/742850/apis/api-11883028-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://partners-api.airalo.com
    description: Prod Env
security: []
```
