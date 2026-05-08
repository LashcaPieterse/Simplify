# Submit order

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
  /v2/orders:
    post:
      summary: Submit order
      deprecated: false
      description: >
        This endpoint allows you to submit an order to the Airalo Partner API by
        providing the required parameters, such as `package_id` and `quantity`.
        You may also include an optional `description` field to track your
        internal order ID or add any relevant notes related to the order.



        For more information and best practices visit our [FAQ
        page](https://developers.partners.airalo.com/faq-752238m0)


        When submitting the order, the response includes the field
        `direct_apple_installation_url` with installation instructions that now
        provide Apple’s universal link, enabling direct installation on devices
        running iOS 17.4 or later for a smoother user experience.



        You can also provide your user’s email address using the `to_email`
        parameter, which will send an email to your user asynchronously. The
        email uses a white-label template powered by our eSIM cloud feature. It
        provides your users with a link to access and install the eSIM, includes
        installation instructions, and supports multiple languages.


        <img
        src="https://lh3.googleusercontent.com/pw/AP1GczN6x9C8NVgjy_sptiiYf262zSJWxwWu1lgCss0YNHnw8s1FJeqECe2kCCXxy9BwJkaKM8v-ADXnILoeREKxQxYjUU55qapXoGsHIUtajxf_ARivNHVWSpzw0oQoyVmEpTNPq_AdIXGBMQmU5eS2cq1F=w504-h600-s-no-gm"
        style="border: 1px solid lightgrey;"/>
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
                      created_at:
                        type: string
                      id:
                        type: integer
                      code:
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
                      brand_settings_name:
                        type: string
                      sims:
                        type: array
                        items:
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
                            airalo_code:
                              type: "null"
                            apn_type:
                              type: string
                            apn_value:
                              type: "null"
                            is_roaming:
                              type: boolean
                            confirmation_code:
                              type: "null"
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
                            - airalo_code
                            - apn_type
                            - apn_value
                            - is_roaming
                            - confirmation_code
                    required:
                      - package_id
                      - quantity
                      - type
                      - description
                      - esim_type
                      - validity
                      - package
                      - data
                      - price
                      - pricing_model
                      - created_at
                      - id
                      - code
                      - currency
                      - manual_installation
                      - qrcode_installation
                      - installation_guides
                      - brand_settings_name
                      - sims
                    x-apidog-orders:
                      - package_id
                      - quantity
                      - type
                      - description
                      - esim_type
                      - validity
                      - package
                      - data
                      - price
                      - pricing_model
                      - created_at
                      - id
                      - code
                      - currency
                      - manual_installation
                      - qrcode_installation
                      - installation_guides
                      - brand_settings_name
                      - sims
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
                  summary: Submit Order (200)
                  value:
                    data:
                      package_id: kallur-digital-7days-1gb
                      quantity: "1"
                      type: sim
                      description: Example description to identify the order
                      esim_type: Prepaid
                      validity: 7
                      package: Kallur Digital-1 GB - 7 Days
                      data: 1 GB
                      price: 9.5
                      pricing_model: net_pricing
                      created_at: "2023-02-27 14:09:55"
                      id: 9666
                      code: 20230227-009666
                      currency: USD
                      manual_installation: >-
                        <p><b>eSIM name: </b>Kallur
                        Digital</p><p><b>Coverage:</b> Faroe Islands</p><p><b>To
                        manually activate the eSIM on your eSIM capable
                        device:</b></p><p>1. Settings> Cellular/Mobile> Add
                        Cellular/Mobile Plan.</p><p>2. Manually enter the SM-DP+
                        Address and activation code.</p><p>3. Confirm the eSIM
                        plan details</p><p>4. Label the eSIM.</p><p><b>To access
                        Data:</b></p><p>1. Enable data roaming.</p><p><b>To
                        top-up:</b></p><p></p><p>Visit airalo.com/my-esims or
                        "My eSIMs" tab in your Airaloo app.</p><p><br></p>
                      qrcode_installation: >-
                        <p><b>eSIM name:</b> Kallur Digital</p><p><b>Coverage:
                        </b>Faroe Islands</p><p><b>To activate the eSIM by
                        scanning the QR code on your eSIM capable device you
                        need to print or display this QR code on other
                        device:</b></p><p>1. Settings> Cellular/Mobile> Add
                        Cellular/Mobile Plan.</p><p>2. Scan QR code</p><p>3.
                        Confirm the eSIM plan details</p><p>4. Label the
                        eSIM</p><p><b>To access Data:</b></p><p>1. Enable data
                        roaming</p>
                      installation_guides:
                        en: https://sandbox.airalo.com/installation-guide
                      brand_settings_name: our perfect brand
                      sims:
                        - id: 11047
                          created_at: "2023-02-27 14:09:55"
                          iccid: "891000000000009125"
                          lpa: lpa.airalo.com
                          imsis: null
                          matching_id: TEST
                          qrcode: LPA:1$lpa.airalo.com$TEST
                          qrcode_url: >-
                            https://sandbox.airalo.com/qr?expires=1763820595&id=13301&signature=1f0d45226a3857bd0645bf77225b7aee7e250f926763ee1d1a6e4be7fefde71e
                          direct_apple_installation_url: >-
                            https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$wbg.prod.ondemandconnectivity.com$Y7MRQ886FCDJD4RH
                          airalo_code: null
                          apn_type: automatic
                          apn_value: null
                          is_roaming: true
                          confirmation_code: null
                    meta:
                      message: success
                "2":
                  summary: Success
                  value:
                    data:
                      id: 583747
                      code: 20250415-583747
                      currency: USD
                      package_id: uki-mobile-15days-2gb
                      quantity: 1
                      type: sim
                      description: Example description to identify the order
                      esim_type: Prepaid
                      validity: 15
                      package: Uki Mobile-2 GB - 15 Days
                      data: 2 GB
                      price: 7.5
                      created_at: "2025-04-15 14:02:38"
                      manual_installation: >-
                        <p><br></p><p><b>eSIM name:</b> Uki
                        Mobile<br></p><p><br></p><p><b>Coverage: </b>United
                        Kingdom</p><p><br></p><p><b>To manually activate the
                        eSIM on your eSIM capable
                        device:</b></p><p><br></p><ol><li>Settings >
                        Cellular/Mobile > Add Cellular/Mobile
                        Plan.</li><li>Manually enter the SM-DP+ Address and
                        activation code.</li><li>Confirm eSIM plan
                        details.</li><li>Label the
                        eSIM.</li></ol><p><br></p><p><b>To access
                        Data:</b></p><p><br></p><ol><li>Enable data
                        roaming.</li></ol><p><br></p>
                      qrcode_installation: >-
                        <p><br></p><p><b>eSIM name:</b> Uki
                        Mobile<br></p><p><br></p><p><b>Coverage: </b>United
                        Kingdom<br></p><p><br></p><p><b>To activate the eSIM by
                        scanning the QR code on your eSIM capable device you
                        need to print or display this QR code on other
                        device:</b></p><p><br></p><ol><li>Settings >
                        Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan
                        QR code.</li><li>Confirm eSIM plan
                        details.</li><li>Label the
                        eSIM.</li></ol><p><br></p><p><b>To access
                        Data:</b></p><p><br></p><ol><li>Enable data
                        roaming.</li></ol><p><br></p>
                      installation_guides:
                        en: >-
                          https://www.airalo.com/help/getting-started-with-airalo
                      text: null
                      voice: null
                      net_price: 1.6
                      brand_settings_name: Brand Test Production
                      sims:
                        - id: 709006
                          created_at: "2025-04-15 14:02:38"
                          iccid: "8944465400003573253"
                          lpa: RSP-3088.IDEMIA.IO
                          imsis: null
                          matching_id: YVTGM-5LZC6-PIC56-KFEZJ
                          qrcode: LPA:1$RSP-3088.IDEMIA.IO$YVTGM-5LZC6-PIC56-KFEZJ
                          qrcode_url: >-
                            https://www.airalo.com/qr?expires=1831039358&id=43113221&signature=dedf8d95a5d931e521527cf687aba8bd37da50fe9d63ba913188c31634792fb4
                          airalo_code: null
                          apn_type: manual
                          apn_value: globaldata
                          is_roaming: true
                          confirmation_code: null
                          apn:
                            ios:
                              apn_type: automatic
                              apn_value: globaldata
                            android:
                              apn_type: manual
                              apn_value: globaldata
                          msisdn: "883190601604295"
                          direct_apple_installation_url: >-
                            https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$RSP-3088.IDEMIA.IO$YVTGM-5LZC6-PIC56-KFEZJ
                    meta:
                      message: success
                "3":
                  summary: Submit Order (422)
                  value:
                    data:
                      package_id: The selected package is invalid.
                      quantity: The quantity may not be greater than 50.
                    meta:
                      message: the parameter is invalid
                "4":
                  summary: Success
                  value:
                    data:
                      id: 583747
                      code: 20250415-583747
                      currency: USD
                      package_id: uki-mobile-15days-2gb
                      quantity: 1
                      type: sim
                      description: Example description to identify the order
                      esim_type: Prepaid
                      validity: 15
                      package: Uki Mobile-2 GB - 15 Days
                      data: 2 GB
                      price: 7.5
                      pricing_model: net_pricing
                      created_at: "2025-04-15 14:02:38"
                      manual_installation: >-
                        <p><br></p><p><b>eSIM name:</b> Uki
                        Mobile<br></p><p><br></p><p><b>Coverage: </b>United
                        Kingdom</p><p><br></p><p><b>To manually activate the
                        eSIM on your eSIM capable
                        device:</b></p><p><br></p><ol><li>Settings >
                        Cellular/Mobile > Add Cellular/Mobile
                        Plan.</li><li>Manually enter the SM-DP+ Address and
                        activation code.</li><li>Confirm eSIM plan
                        details.</li><li>Label the
                        eSIM.</li></ol><p><br></p><p><b>To access
                        Data:</b></p><p><br></p><ol><li>Enable data
                        roaming.</li></ol><p><br></p>
                      qrcode_installation: >-
                        <p><br></p><p><b>eSIM name:</b> Uki
                        Mobile<br></p><p><br></p><p><b>Coverage: </b>United
                        Kingdom<br></p><p><br></p><p><b>To activate the eSIM by
                        scanning the QR code on your eSIM capable device you
                        need to print or display this QR code on other
                        device:</b></p><p><br></p><ol><li>Settings >
                        Cellular/Mobile > Add Cellular/Mobile Plan.</li><li>Scan
                        QR code.</li><li>Confirm eSIM plan
                        details.</li><li>Label the
                        eSIM.</li></ol><p><br></p><p><b>To access
                        Data:</b></p><p><br></p><ol><li>Enable data
                        roaming.</li></ol><p><br></p>
                      installation_guides:
                        en: >-
                          https://www.airalo.com/help/getting-started-with-airalo
                      text: null
                      voice: null
                      net_price: 1.6
                      brand_settings_name: Brand Test Production
                      sims:
                        - id: 709006
                          created_at: "2025-04-15 14:02:38"
                          iccid: "8944465400003573253"
                          lpa: RSP-3088.IDEMIA.IO
                          imsis: null
                          matching_id: YVTGM-5LZC6-PIC56-KFEZJ
                          qrcode: LPA:1$RSP-3088.IDEMIA.IO$YVTGM-5LZC6-PIC56-KFEZJ
                          qrcode_url: >-
                            https://www.airalo.com/qr?expires=1831039358&id=43113221&signature=dedf8d95a5d931e521527cf687aba8bd37da50fe9d63ba913188c31634792fb4
                          airalo_code: null
                          apn_type: manual
                          apn_value: globaldata
                          is_roaming: true
                          confirmation_code: null
                          apn:
                            ios:
                              apn_type: automatic
                              apn_value: globaldata
                            android:
                              apn_type: manual
                              apn_value: globaldata
                          msisdn: "883190601604295"
                          direct_apple_installation_url: >-
                            https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$RSP-3088.IDEMIA.IO$YVTGM-5LZC6-PIC56-KFEZJ
                    meta:
                      message: success
                "5":
                  summary: Submit Order (422) SIM quantity is not available
                  value:
                    data:
                      quantity: "SIM quantity is not available. Available quantity: 9."
                    meta:
                      message: the parameter is invalid
                "6":
                  summary: Submit Order (422) Brand doesn't exist
                  value:
                    data:
                      brand_settings_name: Brand settings name doesn't exist.
                    meta:
                      message: the parameter is invalid
                "7":
                  summary: Submit Order (200) with email share
                  value:
                    data:
                      package_id: kallur-digital-7days-1gb
                      quantity: "1"
                      type: sim
                      description: Example description to identify the order
                      esim_type: Prepaid
                      validity: 7
                      package: Kallur Digital-1 GB - 7 Days
                      data: 1 GB
                      price: 9.5
                      pricing_model: net_pricing
                      created_at: "2023-02-27 14:09:55"
                      id: 9666
                      code: 20230227-009666
                      currency: USD
                      manual_installation: >-
                        <p><b>eSIM name: </b>Kallur
                        Digital</p><p><b>Coverage:</b> Faroe Islands</p><p><b>To
                        manually activate the eSIM on your eSIM capable
                        device:</b></p><p>1. Settings> Cellular/Mobile> Add
                        Cellular/Mobile Plan.</p><p>2. Manually enter the SM-DP+
                        Address and activation code.</p><p>3. Confirm the eSIM
                        plan details</p><p>4. Label the eSIM.</p><p><b>To access
                        Data:</b></p><p>1. Enable data roaming.</p><p><b>To
                        top-up:</b></p><p></p><p>Visit airalo.com/my-esims or
                        "My eSIMs" tab in your Airaloo app.</p><p><br></p>
                      qrcode_installation: >-
                        <p><b>eSIM name:</b> Kallur Digital</p><p><b>Coverage:
                        </b>Faroe Islands</p><p><b>To activate the eSIM by
                        scanning the QR code on your eSIM capable device you
                        need to print or display this QR code on other
                        device:</b></p><p>1. Settings> Cellular/Mobile> Add
                        Cellular/Mobile Plan.</p><p>2. Scan QR code</p><p>3.
                        Confirm the eSIM plan details</p><p>4. Label the
                        eSIM</p><p><b>To access Data:</b></p><p>1. Enable data
                        roaming</p>
                      installation_guides:
                        en: https://sandbox.airalo.com/installation-guide
                      brand_settings_name: our perfect brand
                      sims:
                        - id: 11047
                          created_at: "2023-02-27 14:09:55"
                          iccid: "891000000000009125"
                          lpa: lpa.airalo.com
                          imsis: null
                          matching_id: TEST
                          qrcode: LPA:1$lpa.airalo.com$TEST
                          qrcode_url: >-
                            https://sandbox.airalo.com/qr?expires=1763820595&id=13301&signature=1f0d45226a3857bd0645bf77225b7aee7e250f926763ee1d1a6e4be7fefde71e
                          direct_apple_installation_url: >-
                            https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$wbg.prod.ondemandconnectivity.com$Y7MRQ886FCDJD4RH
                          airalo_code: null
                          apn_type: automatic
                          apn_value: null
                          is_roaming: true
                          confirmation_code: null
                    meta:
                      message: success
                "8":
                  summary: Success
                  value:
                    data:
                      package_id: kallur-digital-7days-1gb
                      quantity: "1"
                      type: sim
                      description: Example description to identify the order
                      esim_type: Prepaid
                      validity: 7
                      package: Kallur Digital-1 GB - 7 Days
                      data: 1 GB
                      price: 9.5
                      pricing_model: discount_pricing
                      discount_percentage: 10
                      discount_amount: 0.95
                      unit_paid_price: 8.55
                      total_amount_paid: 8.55
                      created_at: "2023-02-27 14:09:55"
                      id: 9667
                      code: 20230227-009667
                      currency: USD
                      manual_installation: >-
                        <p><b>eSIM name: </b>Kallur
                        Digital</p><p><b>Coverage:</b> Faroe Islands</p><p><b>To
                        manually activate the eSIM on your eSIM capable
                        device:</b></p><p>1. Settings> Cellular/Mobile> Add
                        Cellular/Mobile Plan.</p><p>2. Manually enter the SM-DP+
                        Address and activation code.</p><p>3. Confirm the eSIM
                        plan details</p><p>4. Label the eSIM.</p><p><b>To access
                        Data:</b></p><p>1. Enable data roaming.</p><p><b>To
                        top-up:</b></p><p></p><p>Visit airalo.com/my-esims or
                        "My eSIMs" tab in your Airaloo app.</p><p><br></p>
                      qrcode_installation: >-
                        <p><b>eSIM name:</b> Kallur Digital</p><p><b>Coverage:
                        </b>Faroe Islands</p><p><b>To activate the eSIM by
                        scanning the QR code on your eSIM capable device you
                        need to print or display this QR code on other
                        device:</b></p><p>1. Settings> Cellular/Mobile> Add
                        Cellular/Mobile Plan.</p><p>2. Scan QR code</p><p>3.
                        Confirm the eSIM plan details</p><p>4. Label the
                        eSIM</p><p><b>To access Data:</b></p><p>1. Enable data
                        roaming</p>
                      installation_guides:
                        en: https://sandbox.airalo.com/installation-guide
                      brand_settings_name: our perfect brand
                      sims:
                        - id: 11048
                          created_at: "2023-02-27 14:09:55"
                          iccid: "891000000000009126"
                          lpa: lpa.airalo.com
                          imsis: null
                          matching_id: TEST
                          qrcode: LPA:1$lpa.airalo.com$TEST
                          qrcode_url: >-
                            https://sandbox.airalo.com/qr?expires=1763820595&id=13301&signature=1f0d45226a3857bd0645bf77225b7aee7e250f926763ee1d1a6e4be7fefde71e
                          direct_apple_installation_url: >-
                            https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$wbg.prod.ondemandconnectivity.com$Y7MRQ886FCDJD4RH
                          airalo_code: null
                          apn_type: automatic
                          apn_value: null
                          is_roaming: true
                          confirmation_code: null
                    meta:
                      message: success
          headers: {}
          x-apidog-name: Submit Order (200)
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
          x-apidog-name: Submit Order (422)
        x-200:Submit Order with Voice&Data package (200):
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
                      currency:
                        type: string
                      package_id:
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
                      text:
                        type: "null"
                      voice:
                        type: "null"
                      net_price:
                        type: number
                      brand_settings_name:
                        type: string
                      sims:
                        type: array
                        items:
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
                            airalo_code:
                              type: "null"
                            apn_type:
                              type: string
                            apn_value:
                              type: string
                            is_roaming:
                              type: boolean
                            confirmation_code:
                              type: "null"
                            apn:
                              type: object
                              properties:
                                ios:
                                  type: object
                                  properties:
                                    apn_type:
                                      type: string
                                    apn_value:
                                      type: string
                                  required:
                                    - apn_type
                                    - apn_value
                                  x-apidog-orders:
                                    - apn_type
                                    - apn_value
                                android:
                                  type: object
                                  properties:
                                    apn_type:
                                      type: string
                                    apn_value:
                                      type: string
                                  required:
                                    - apn_type
                                    - apn_value
                                  x-apidog-orders:
                                    - apn_type
                                    - apn_value
                              required:
                                - ios
                                - android
                              x-apidog-orders:
                                - ios
                                - android
                            msisdn:
                              type: string
                            direct_apple_installation_url:
                              type: string
                          x-apidog-orders:
                            - id
                            - created_at
                            - iccid
                            - lpa
                            - imsis
                            - matching_id
                            - qrcode
                            - qrcode_url
                            - airalo_code
                            - apn_type
                            - apn_value
                            - is_roaming
                            - confirmation_code
                            - apn
                            - msisdn
                            - direct_apple_installation_url
                    required:
                      - id
                      - code
                      - currency
                      - package_id
                      - quantity
                      - type
                      - description
                      - esim_type
                      - validity
                      - package
                      - data
                      - price
                      - pricing_model
                      - created_at
                      - manual_installation
                      - qrcode_installation
                      - installation_guides
                      - text
                      - voice
                      - net_price
                      - brand_settings_name
                      - sims
                    x-apidog-orders:
                      - id
                      - code
                      - currency
                      - package_id
                      - quantity
                      - type
                      - description
                      - esim_type
                      - validity
                      - package
                      - data
                      - price
                      - pricing_model
                      - created_at
                      - manual_installation
                      - qrcode_installation
                      - installation_guides
                      - text
                      - voice
                      - net_price
                      - brand_settings_name
                      - sims
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
          x-apidog-name: Submit Order with Voice&Data package (200)
        x-422:Submit Order (422) SIM quantity is not available:
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
          x-apidog-name: Submit Order (422) SIM quantity is not available
        x-422:Submit Order (422) Brand doesn't exist:
          description: ""
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      brand_settings_name:
                        type: string
                    required:
                      - brand_settings_name
                    x-apidog-orders:
                      - brand_settings_name
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
          x-apidog-name: Submit Order (422) Brand doesn't exist
        x-200:Submit Order (200) with email share:
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
                      created_at:
                        type: string
                      id:
                        type: integer
                      code:
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
                      brand_settings_name:
                        type: string
                      sims:
                        type: array
                        items:
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
                            airalo_code:
                              type: "null"
                            apn_type:
                              type: string
                            apn_value:
                              type: "null"
                            is_roaming:
                              type: boolean
                            confirmation_code:
                              type: "null"
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
                            - airalo_code
                            - apn_type
                            - apn_value
                            - is_roaming
                            - confirmation_code
                    required:
                      - package_id
                      - quantity
                      - type
                      - description
                      - esim_type
                      - validity
                      - package
                      - data
                      - price
                      - pricing_model
                      - created_at
                      - id
                      - code
                      - currency
                      - manual_installation
                      - qrcode_installation
                      - installation_guides
                      - brand_settings_name
                      - sims
                    x-apidog-orders:
                      - package_id
                      - quantity
                      - type
                      - description
                      - esim_type
                      - validity
                      - package
                      - data
                      - price
                      - pricing_model
                      - created_at
                      - id
                      - code
                      - currency
                      - manual_installation
                      - qrcode_installation
                      - installation_guides
                      - brand_settings_name
                      - sims
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
          x-apidog-name: Submit Order (200) with email share
        x-200:(Discount pricing) Submit Order:
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
                      created_at:
                        type: string
                      id:
                        type: integer
                      code:
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
                      brand_settings_name:
                        type: string
                      sims:
                        type: array
                        items:
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
                            airalo_code:
                              type: "null"
                            apn_type:
                              type: string
                            apn_value:
                              type: "null"
                            is_roaming:
                              type: boolean
                            confirmation_code:
                              type: "null"
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
                            - airalo_code
                            - apn_type
                            - apn_value
                            - is_roaming
                            - confirmation_code
                    required:
                      - package_id
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
                      - created_at
                      - id
                      - code
                      - currency
                      - manual_installation
                      - qrcode_installation
                      - installation_guides
                      - brand_settings_name
                      - sims
                    x-apidog-orders:
                      - package_id
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
                      - created_at
                      - id
                      - code
                      - currency
                      - manual_installation
                      - qrcode_installation
                      - installation_guides
                      - brand_settings_name
                      - sims
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
          x-apidog-name: (Discount pricing) Submit Order
      security: []
      x-apidog-folder: REST API/Endpoints/Place order
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/742850/apis/api-11883024-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://partners-api.airalo.com
    description: Prod Env
security: []
```
