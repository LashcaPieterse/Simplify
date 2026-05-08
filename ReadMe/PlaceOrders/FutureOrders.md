# Future orders

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ""
  description: ""
  version: 1.0.0
paths:
  /v2/future-orders:
    post:
      summary: Future orders
      deprecated: false
      description: >-
        This endpoint allows you to submit an order to the Airalo Partner API,
        which will be created on the specified due date.


        To proceed, provide the required information:

        - Due date

        - Quantity

        - Package ID

        - Description (optional)


        Please note:

        - On success, the endpoint response will include a unique 25-character
        request_id.

        - You must store this value in your system to cancel the order later if
        needed and to know for which order you got a response on your webhook
        URL.

        - An access token from the "Request Access Token" endpoint is required
        in the request.



        **Delivery modes**

        **What is a webhook URL?**

        Webhook URL is a URL that is configured on your domain and your won
        webserver.

        That URL should be able to receive HTTP POST requests with your order
        data that will be sent from our servers .

        NOTE: We check the liveness of your webhook URL with an HTTP HEAD
        request to which we expect 200 OK response.


        **What happens when the due date arrives?**

        When the due date arrives your order is processed and the order details
        are sent as a POST HTTP request to

        either your opted in "async_orders" notification type url (more info
        [here](https://partner-api-airalo.apidog.io/async-orders-11883038e0) )

        or on the "webhhok_url" optional parameter of this endpoint which
        overrides the above opted in URL.

        NOTE that you must have one of the above (either opted in URL or
        webhhok_url) provided in order to make a future order.


        if you provide the optional parameter "sharing_option", which goes
        together with the "to_email" parameter

        then an email with the eSim details will also be sent to the email
        provided in the "to_email" parameter as well.

        Depending from the selected sharing option which can be one of link or
        pdf or both you will get the eSim data

        either in a PDF format attached to the email or as a link.


        **What is the format of the message that is sent to the webhook URL?**

        The format of the message that is sent to the webhook URL is the same as
        the response of the [regular
        order](https://partner-api-airalo.apidog.io/submit-order-11883024e0).

        It only has one additional parameter named "request_id" which is the
        same request_id that you got in the response

        when you made the future order at the time of making the order,

        so that you know for which future order you got details on your webhook
        URL.



        **SANBOX MODE**


        NOTE that this endpoint has a slightly different behaviour in sandbox
        mode.

        Here are the differences.

        1. In sandbox mode the future orders will not be processed on the actual
        due date but they will be processed immediatelly upon submission.

        2. Because the future orders are not processed on the due date, their
        status is always processed so in order to simulate future orders with
        other statuses there are 3 special packages for that. Here are the
        pacakges with the explanations:
            - `test-create-pending-future-order-7days-1gb` - special package for creating a future order with pending status
            - `test-create-failed-future-order-7days-1gb` - special package for creating a future order with failed status
            - `test-create-retry-future-order-7days-1gb` - special package for creating a future order with retry status

        By using the packages above future orders with the above statuses can be
        created and the `request_id` from those orders can be used to test the
        [cancel future order
        API](https://app.apidog.com/link/project/742850/apis/api-14459873) to
        cancel the future order.


        By using the above packages you can also test the [GET future orders API
        Endpoint](https://app.apidog.com/link/project/742850/apis/api-21307288?branchId=1052533)
        to test the filters as well.
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
          application/json:
            schema:
              type: object
              properties:
                quantity:
                  type: integer
                  description: The quantity of items in the order. Maximum of 50.
                  x-apidog-mock: "{{$string.numeric}}"
                  minimum: 1
                  maximum: 50
                package_id:
                  type: string
                  description: >-
                    Required. The package ID associated with the order. You can
                    obtain this from the "Packages / Get Packages" endpoint.
                  examples:
                    - kallur-digital-7days-1gb
                due_date:
                  type: string
                  examples:
                    - 2025-03-28 10:00
                  format: date-time
                  description: >-
                    Required. Date and time string field in the format
                    YYYY-MM-DD HH:MM. This date must be minimum two days in the
                    future from current time and maximum 1 year in the future.
                    The order processing starts at the moment the due date
                    arrives.
                to_email:
                  type: string
                  description: >+
                    If specified, email with esim sharing will be sent.
                    sharing_option should be specified as well.

                  examples:
                    - valid_email@address.com
                sharing_option:
                  type: array
                  items:
                    type: string
                    enum:
                      - link
                      - pdf
                    x-apidog-enum:
                      - value: link
                        name: ""
                        description: ""
                      - value: pdf
                        name: ""
                        description: ""
                  description: >-
                    Array. Required when to_email is set. Available options:
                    link, pdf
                copy_address:
                  type: string
                  description: Array. It is used when to_email is set.
                  examples:
                    - '["valid_email@address.com"]'
                webhook_url:
                  type: string
                  description: >-
                    Optional. A custom, valid url to which you will receive the
                    order details data asynchronously. Note that you can optin
                    or provide in request. The webhook_url if provided in
                    payload will overwrite the one which is opted in.
                description:
                  type: string
                  description: >-
                    Optional. A custom description for the order, which can help
                    you identify it later.
                brand_settings_name:
                  type: string
                  description: >-
                    Nullable. The definition under what brand the eSIM should be
                    shared. Null for unbranded.
                  examples:
                    - our perfect brand
                  nullable: true
              x-apidog-orders:
                - quantity
                - package_id
                - due_date
                - to_email
                - sharing_option
                - copy_address
                - webhook_url
                - description
                - brand_settings_name
              required:
                - package_id
                - quantity
                - due_date
            examples:
              "1":
                value:
                  quantity: 1
                  package_id: change-7days-1gb
                  due_date: 2025-04-09 10:00
                  description: Just a future order ..
                  webhook_url: >-
                    http://somePartnerDomain.com/webhook-url-path-to-wait-for-the
                    order-details
                summary: Request with "webhook_url"
                description: >-
                  Request with "webhook_url"

                  With this request a future order will be created that will be
                  processed on date 2025-04-09 10:00 and when the ordfer is
                  complete the order details will be delivered to the URL
                  provided in the "webhook_url" parameter.

                  NOTE that this URL is a URL that is hosted by your webserver.
              "2":
                value:
                  quantity: 1
                  package_id: kallur-digital-7days-1gb
                  due_date: 2025-03-28 10:00
                  to_email: valid_email@address.com
                  sharing_option: '["link", "pdf"]'
                  copy_address: '["valid_email@address.com"]'
                  webhook_url: string
                  description: string
                  brand_settings_name: our perfect brand
                summary: Request with all parameters
                description: Example request with all available options
              "3":
                value:
                  quantity: 1
                  package_id: change-30days-5gb
                  due_date: 2025-07-19 10:00
                  to_email: someEmail@example.com
                  description: Future order with sharing option
                  sharing_option:
                    - link
                    - pdf
                summary: Request with "sharing_option"
                description: >-
                  Request with "sharing_option"

                  This request includes the "sharing_option" parameter which
                  goes together with the "to_email" parameter.

                  In the "to_email" parameter an email to which the eSim data
                  will be delivered is provided,

                  NOTE that "webhook_url" parameter here is not provided and its
                  assumed that its alredy opted in via our opt in endpoint. If
                  you dont  already have that done you will need to add a
                  "webhook_url" parameter as well.
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
                      request_id:
                        type: string
                        description: >-
                          A unique string from 25 charachers for your submitted
                          order that you can use it later to make other
                          operations on the order. For example to cancel it if
                          needed.
                      due_date:
                        type: string
                        description: The submitted due date with the order
                      latest_cancellation_date:
                        type: string
                        description: Latest cancelation date
                    required:
                      - request_id
                      - due_date
                      - latest_cancellation_date
                    x-apidog-orders:
                      - request_id
                      - due_date
                      - latest_cancellation_date
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
                  summary: Submit Future Order (200)
                  value:
                    data:
                      request_id: 9HrK4-KGgz8n71eGgdNS5cV7Y
                      due_date: 2025-03-28 10:00
                      latest_cancellation_date: 2025-03-27 10:00
                    meta:
                      message: success
                "2":
                  summary: Validation error
                  value:
                    data:
                      quantity: The quantity must be at least 1.
                    meta:
                      message: the parameter is invalid
                "3":
                  summary: Invalid package error
                  value:
                    code: 34
                    reason: >-
                      The requested eSIM package is invalid or it is currently
                      out of stock. Please try again later.
                "4":
                  summary: Invalid due date
                  value:
                    data:
                      due_date: >-
                        Minimum due date must be at least the day after tomorrow
                        in UTC timezone.
                    meta:
                      message: the parameter is invalid
                "5":
                  summary: Invalid sharing option
                  value:
                    data:
                      sharing_option(1): >-
                        Sharing option on position 1 is invalid. Available
                        options are: 'link' and 'pdf'.
                    meta:
                      message: the parameter is invalid
          headers: {}
          x-apidog-name: "Submit Future Order "
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
          x-apidog-name: Quantity validation error
        x-422:Invalid package validation error:
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
          x-apidog-name: Invalid package validation error
        x-422:Invalid due date validation error:
          description: ""
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      due_date:
                        type: string
                    required:
                      - due_date
                    x-apidog-orders:
                      - due_date
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
          x-apidog-name: Invalid due date validation error
        x-422:Invalid sharing option:
          description: ""
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      sharing_option(1):
                        type: string
                    required:
                      - sharing_option(1)
                    x-apidog-orders:
                      - sharing_option(1)
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
          x-apidog-name: Invalid sharing option
      security: []
      x-apidog-folder: REST API/Endpoints/Place order
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/742850/apis/api-14455445-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://partners-api.airalo.com
    description: Prod Env
security: []
```
