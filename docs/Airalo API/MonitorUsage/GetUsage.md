# Get usage (data, text & voice)

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ""
  description: ""
  version: 1.0.0
paths:
  /v2/sims/{sim_iccid}/usage:
    get:
      summary: Get usage (data, text & voice)
      deprecated: false
      description: >
        :::highlight blue 💡

        This endpoint comes with a rate limit: 

        - 10 requests per minute (per unique iccid) 

        - 5 requests per second (per unique company)


        A built-in cache of 20 minutes is also set on this endpoint's response.

        :::


        This endpoint enables you to retrieve the total data, voice & text usage
        for a specific eSIM identified by its ICCID.


        The access token, obtained from the "Request Access Token" endpoint,
        should be included in the request.


        **Note for unlimited packages** 

        - For unlimited packages the `remaining`, `total` and `amount` fields
        will default to `0` should be ignored, and not displayed to the end
        users.

        - When in [Sandbox
        mode](https://developers.partners.airalo.com/sandbox-mode-2114305m0),
        the `is_unlimited` field can be `false` for an unlimited package
        ordered, due to not having real eSIMs available, thus don't reflect real
        usage.


        **Response atttributes units explained:**

        - `total` : Response value is total megabytes on package

        - `remaining` :  Response value is in total megabytes **remaining**


        - `total_text` :  Response value is the initial total text messages on
        package

        - `remaining_text` :  Response value is in total number of text messages
        **remaining**


        - `total_voice` :  Response value is the initial total voice minutes on
        package

        - `remaining_voice` :  Response value is in total minutes **remaining**
      tags:
        - REST API/Endpoints/Monitor usage
      parameters:
        - name: sim_iccid
          in: path
          description: >-
            The ICCID of the eSIM for which you want to retrieve the data usage
            details.
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
                      remaining:
                        type: integer
                      total:
                        type: integer
                      expired_at:
                        type: string
                      is_unlimited:
                        type: boolean
                      status:
                        description: >-
                          All Cases: [ NOT_ACTIVE, ACTIVE, FINISHED, UNKNOWN,
                          EXPIRED ]
                        type: string
                      remaining_voice:
                        type: integer
                      remaining_text:
                        type: integer
                      total_voice:
                        type: integer
                      total_text:
                        type: integer
                    required:
                      - remaining
                      - total
                      - expired_at
                      - is_unlimited
                      - status
                      - remaining_voice
                      - remaining_text
                      - total_voice
                      - total_text
                    x-apidog-orders:
                      - remaining
                      - total
                      - expired_at
                      - is_unlimited
                      - status
                      - remaining_voice
                      - remaining_text
                      - total_voice
                      - total_text
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
                  summary: "Get Usage: 200"
                  value: |-
                    {
                        "data": {
                            "remaining": 767,
                            "total": 2048,
                            "expired_at": "2022-01-01 00:00:00",
                            "is_unlimited": true,
                            "status": "ACTIVE", // All Cases: [ NOT_ACTIVE, ACTIVE, FINISHED, UNKNOWN, EXPIRED ]
                            "remaining_voice": 0,
                            "remaining_text": 0,
                            "total_voice": 0,
                            "total_text": 0
                        },
                        "meta": {
                            "message": "api.succes"
                        }
                    }
                "2":
                  summary: "Get Usage: 404 (Invalid ICCID)"
                  value:
                    data: []
                    meta:
                      message: messages.resource_not_found
                "3":
                  summary: "Get Usage: 429 (Rate Limit)"
                  value:
                    message: Too Many Attempts.
                "4":
                  summary: Success
                  value:
                    data:
                      remaining: 0
                      total: 0
                      expired_at: null
                      is_unlimited: null
                      status: RECYCLED
                      remaining_voice: 0
                      remaining_text: 0
                      total_voice: 0
                      total_text: 0
                    meta:
                      message: api.succes
          headers: {}
          x-apidog-name: "Get Usage: 200"
        "404":
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
          x-apidog-name: "Get Usage: 404 (Invalid ICCID)"
        "429":
          description: ""
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                required:
                  - message
                x-apidog-orders:
                  - message
          headers:
            X-RateLimit-Limit:
              example: ""
              required: false
              description: >-
                Maximum number of requests a client can make within a specific
                time window.
              schema:
                type: integer
            X-RateLimit-Remaining:
              example: ""
              required: false
              description: >-
                Indicates how many requests a client can still make within the
                current time window before hitting a rate limit.
              schema:
                type: integer
            X-RateLimit-Reset:
              example: ""
              required: false
              description: >-
                Indicating when an API's rate limit quota will reset and
                replenish, allowing clients to resume requests.
              schema:
                type: string
            Retry-After:
              example: ""
              required: false
              description: How long to wait before making a follow-up request.
              schema:
                type: integer
          x-apidog-name: "Get Usage: 429 (Rate Limit)"
        "x-200:Get Usage (Recycled sim): 200":
          description: ""
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      remaining:
                        type: integer
                      total:
                        type: integer
                      expired_at:
                        type: "null"
                      is_unlimited:
                        type: "null"
                      status:
                        type: string
                      remaining_voice:
                        type: integer
                      remaining_text:
                        type: integer
                      total_voice:
                        type: integer
                      total_text:
                        type: integer
                    required:
                      - remaining
                      - total
                      - expired_at
                      - is_unlimited
                      - status
                      - remaining_voice
                      - remaining_text
                      - total_voice
                      - total_text
                    x-apidog-orders:
                      - remaining
                      - total
                      - expired_at
                      - is_unlimited
                      - status
                      - remaining_voice
                      - remaining_text
                      - total_voice
                      - total_text
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
          x-apidog-name: "Get Usage (Recycled sim): 200"
      security: []
      x-apidog-folder: REST API/Endpoints/Monitor usage
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/742850/apis/api-11883030-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://partners-api.airalo.com
    description: Prod Env
security: []
```
