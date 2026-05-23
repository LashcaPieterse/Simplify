# Get installation instructions

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ""
  description: ""
  version: 1.0.0
paths:
  /v2/sims/{sim_iccid}/instructions:
    get:
      summary: Get installation instructions
      deprecated: false
      description: >-
        This endpoint allows you to retrieve the language specific installation
        instructions of a specific eSIM from the Airalo Partners API using the
        eSIM's ICCID.


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
        - name: Accept-Language
          in: header
          description: ""
          required: true
          example: en
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
                      instructions:
                        type: object
                        properties:
                          language:
                            type: string
                          ios:
                            type: array
                            items:
                              type: object
                              properties:
                                model:
                                  type: "null"
                                version:
                                  type: string
                                installation_via_qr_code:
                                  type: object
                                  properties:
                                    steps:
                                      type: object
                                      properties:
                                        "1":
                                          type: string
                                        "2":
                                          type: string
                                        "3":
                                          type: string
                                        "4":
                                          type: string
                                        "5":
                                          type: string
                                        "6":
                                          type: string
                                        "7":
                                          type: string
                                        "8":
                                          type: string
                                      required:
                                        - "1"
                                        - "2"
                                        - "3"
                                        - "4"
                                        - "5"
                                        - "6"
                                        - "7"
                                        - "8"
                                      x-apidog-orders:
                                        - "1"
                                        - "2"
                                        - "3"
                                        - "4"
                                        - "5"
                                        - "6"
                                        - "7"
                                        - "8"
                                    qr_code_data:
                                      type: string
                                    qr_code_url:
                                      type: string
                                    direct_apple_installation_url:
                                      type: string
                                  required:
                                    - steps
                                    - qr_code_data
                                    - qr_code_url
                                    - direct_apple_installation_url
                                  x-apidog-orders:
                                    - steps
                                    - qr_code_data
                                    - qr_code_url
                                    - direct_apple_installation_url
                                installation_manual:
                                  type: object
                                  properties:
                                    steps:
                                      type: object
                                      properties:
                                        "1":
                                          type: string
                                        "2":
                                          type: string
                                        "3":
                                          type: string
                                        "4":
                                          type: string
                                        "5":
                                          type: string
                                        "6":
                                          type: string
                                        "7":
                                          type: string
                                        "8":
                                          type: string
                                        "9":
                                          type: string
                                      required:
                                        - "1"
                                        - "2"
                                        - "3"
                                        - "4"
                                        - "5"
                                        - "6"
                                        - "7"
                                        - "8"
                                        - "9"
                                      x-apidog-orders:
                                        - "1"
                                        - "2"
                                        - "3"
                                        - "4"
                                        - "5"
                                        - "6"
                                        - "7"
                                        - "8"
                                        - "9"
                                    smdp_address_and_activation_code:
                                      type: string
                                  required:
                                    - steps
                                    - smdp_address_and_activation_code
                                  x-apidog-orders:
                                    - steps
                                    - smdp_address_and_activation_code
                                network_setup:
                                  type: object
                                  properties:
                                    steps:
                                      type: object
                                      properties:
                                        "1":
                                          type: string
                                        "2":
                                          type: string
                                        "3":
                                          type: string
                                        "4":
                                          type: string
                                        "5":
                                          type: string
                                      required:
                                        - "1"
                                        - "2"
                                        - "3"
                                        - "4"
                                        - "5"
                                      x-apidog-orders:
                                        - "1"
                                        - "2"
                                        - "3"
                                        - "4"
                                        - "5"
                                    apn_type:
                                      type: string
                                    apn_value:
                                      type: string
                                    is_roaming:
                                      type: boolean
                                  required:
                                    - steps
                                    - apn_type
                                    - apn_value
                                    - is_roaming
                                  x-apidog-orders:
                                    - steps
                                    - apn_type
                                    - apn_value
                                    - is_roaming
                              x-apidog-orders:
                                - model
                                - version
                                - installation_via_qr_code
                                - installation_manual
                                - network_setup
                          android:
                            type: array
                            items:
                              type: object
                              properties:
                                model:
                                  type: "null"
                                version:
                                  type: "null"
                                installation_via_qr_code:
                                  type: object
                                  properties:
                                    steps:
                                      type: object
                                      properties:
                                        "1":
                                          type: string
                                        "2":
                                          type: string
                                        "3":
                                          type: string
                                        "4":
                                          type: string
                                        "5":
                                          type: string
                                      required:
                                        - "1"
                                        - "2"
                                        - "3"
                                        - "4"
                                        - "5"
                                      x-apidog-orders:
                                        - "1"
                                        - "2"
                                        - "3"
                                        - "4"
                                        - "5"
                                    qr_code_data:
                                      type: string
                                    qr_code_url:
                                      type: string
                                  required:
                                    - steps
                                    - qr_code_data
                                    - qr_code_url
                                  x-apidog-orders:
                                    - steps
                                    - qr_code_data
                                    - qr_code_url
                                installation_manual:
                                  type: object
                                  properties:
                                    steps:
                                      type: object
                                      properties:
                                        "1":
                                          type: string
                                        "2":
                                          type: string
                                        "3":
                                          type: string
                                        "4":
                                          type: string
                                        "5":
                                          type: string
                                        "6":
                                          type: string
                                      required:
                                        - "1"
                                        - "2"
                                        - "3"
                                        - "4"
                                        - "5"
                                        - "6"
                                      x-apidog-orders:
                                        - "1"
                                        - "2"
                                        - "3"
                                        - "4"
                                        - "5"
                                        - "6"
                                    smdp_address_and_activation_code:
                                      type: string
                                  required:
                                    - steps
                                    - smdp_address_and_activation_code
                                  x-apidog-orders:
                                    - steps
                                    - smdp_address_and_activation_code
                                network_setup:
                                  type: object
                                  properties:
                                    steps:
                                      type: object
                                      properties:
                                        "1":
                                          type: string
                                        "2":
                                          type: string
                                        "3":
                                          type: string
                                        "4":
                                          type: string
                                        "5":
                                          type: string
                                        "6":
                                          type: string
                                        "7":
                                          type: string
                                      required:
                                        - "1"
                                        - "2"
                                        - "3"
                                        - "4"
                                        - "5"
                                        - "6"
                                        - "7"
                                      x-apidog-orders:
                                        - "1"
                                        - "2"
                                        - "3"
                                        - "4"
                                        - "5"
                                        - "6"
                                        - "7"
                                    apn_type:
                                      type: string
                                    apn_value:
                                      type: string
                                    is_roaming:
                                      type: boolean
                                  required:
                                    - steps
                                    - apn_type
                                    - apn_value
                                    - is_roaming
                                  x-apidog-orders:
                                    - steps
                                    - apn_type
                                    - apn_value
                                    - is_roaming
                              x-apidog-orders:
                                - model
                                - version
                                - installation_via_qr_code
                                - installation_manual
                                - network_setup
                        required:
                          - language
                          - ios
                          - android
                        x-apidog-orders:
                          - language
                          - ios
                          - android
                    required:
                      - instructions
                    x-apidog-orders:
                      - instructions
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
                  instructions:
                    language: EN
                    ios:
                      - model: null
                        version: 14,15,13
                        installation_via_qr_code:
                          steps:
                            "1": >-
                              Go to Settings > Cellular/Mobile > Add
                              Cellular/Mobile Plan.
                            "2": Scan the QR Code.
                            "3": Tap on 'Add Cellular Plan'.
                            "4": Label the eSIM.
                            "5": >-
                              Choose preferred default line to call or send
                              messages.
                            "6": >-
                              Choose the preferred line to use with iMessage,
                              FaceTime, and Apple ID.
                            "7": >-
                              Choose the eSIM plan as your default line for
                              Cellular Data and do not turn on 'Allow Cellular
                              Data Switching' to prevent charges on your other
                              line.
                            "8": >-
                              Your eSIM has been installed successfully, please
                              scroll down to see the settings for accessing
                              data.
                          qr_code_data: LPA:1$lpa.airalo.com$TEST
                          qr_code_url: >-
                            https://sandbox.airalo.com/qr?expires=1797582688&id=115516&signature=3ee338b2d3405e913f1961993947236cc5c6b6c6c1d22d5e7da6e1281b6cefe6
                          direct_apple_installation_url: >-
                            https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$wbg.prod.ondemandconnectivity.com$Y7MRQ886FCDJD4RH
                        installation_manual:
                          steps:
                            "1": >-
                              Go to Settings > Cellular/Mobile > Add
                              Cellular/Mobile Plan.
                            "2": Tap on 'Enter Details Manually'.
                            "3": Enter your SM-DP+ Address and Activation Code.
                            "4": Tap on 'Add Cellular Plan'.
                            "5": Label the eSIM.
                            "6": >-
                              Choose preferred default line to call or send
                              messages.
                            "7": >-
                              Choose the preferred line to use with iMessage,
                              FaceTime, and Apple ID.
                            "8": >-
                              Choose the eSIM plan as your default line for
                              Cellular Data and do not turn on 'Allow Cellular
                              Data Switching' to prevent charges on your other
                              line.
                            "9": >-
                              Your eSIM has been installed successfully, please
                              scroll down to see the settings for accessing
                              data.
                          smdp_address_and_activation_code: lpa.airalo.com
                        network_setup:
                          steps:
                            "1": Select your  eSIM under 'Cellular Plans'.
                            "2": Ensure that 'Turn On This Line' is toggled on.
                            "3": >-
                              Go to 'Network Selection' and select the supported
                              network.
                            "4": Turn on the Data Roaming.
                            "5": Need help? Chat with us.
                          apn_type: manual
                          apn_value: singleall
                          is_roaming: true
                    android:
                      - model: null
                        version: null
                        installation_via_qr_code:
                          steps:
                            "1": Go to Settings > Connections > SIM Card Manager.
                            "2": Tap on 'Add Mobile Plan'.
                            "3": Tap on 'Scan Carrier QR Code' and tap on 'Add'.
                            "4": >-
                              When the plan has been registered, tap 'Ok' to
                              turn on a new mobile plan.
                            "5": >-
                              Your eSIM has been installed successfully, please
                              scroll down to see the settings for accessing
                              data.
                          qr_code_data: LPA:1$lpa.airalo.com$TEST
                          qr_code_url: >-
                            https://sandbox.airalo.com/qr?expires=1797582688&id=115516&signature=3ee338b2d3405e913f1961993947236cc5c6b6c6c1d22d5e7da6e1281b6cefe6
                        installation_manual:
                          steps:
                            "1": Go to Settings > Connections > SIM Card Manager.
                            "2": Tap on 'Add Mobile Plan'.
                            "3": >-
                              Tap on 'Scan Carrier QR Code' and tap on 'Enter
                              code instead'.
                            "4": >-
                              Enter the Activation Code (SM-DP+ Address &
                              Activation Code).
                            "5": >-
                              When the plan has been registered, tap 'Ok' to
                              turn on a new mobile plan.
                            "6": >-
                              Your eSIM has been installed successfully, please
                              scroll down to see the settings for accessing
                              data.
                          smdp_address_and_activation_code: lpa.airalo.com
                        network_setup:
                          steps:
                            "1": In the 'SIM Card Manager' select your  eSIM.
                            "2": >-
                              Ensure that your eSIM is turned on under 'Mobile
                              Networks'.
                            "3": Enable the Mobile Data.
                            "4": Turn on the Data Roaming.
                            "5": >-
                              Go to Settings > Connections > Mobile networks >
                              Network Operators.
                            "6": Ensure that the supported network is selected.
                            "7": Need help? Chat with us.
                          apn_type: manual
                          apn_value: singleall
                          is_roaming: true
                meta:
                  message: success
          headers: {}
          x-apidog-name: Get Installation instructions (200)
      security: []
      x-apidog-folder: REST API/Endpoints/Install eSIM
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/742850/apis/api-11883029-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://partners-api.airalo.com
    description: Prod Env
security: []
```
