import { filterMethods } from "../common/method-utilities";
import { DEFAULT_API_GATEWAY_KEY } from "../openapi-plugin";
import { OpenApiPluginOptions } from "../openapi-plugin-options";
import { Resources } from "../services/integration-service";

export const TOPIC_REFERENCE = "x-aws-sns";

export class SnsComplement {

  public translateSnsIntegration(options: OpenApiPluginOptions): Resources {
    const topics = {};
    const body = options.body;
    const apiGatewayKey = options.key || DEFAULT_API_GATEWAY_KEY;

    for (const path in body.paths) {
      const methods = filterMethods(body.paths[path]);

      for (const method in methods) {
        const methodProps = methods[method];
        const topicResource = methodProps[TOPIC_REFERENCE];

        if (!topicResource) continue;
        
        methodProps["x-amazon-apigateway-integration"] = {
          type: "aws",
          httpMethod: "POST",
          uri: `arn:aws:apigateway:\${AWS::Region}:sns:path//`,
          passthroughBehavior: "NEVER",
          credentials: { "Fn::GetAtt": [`${apiGatewayKey}Role`, "Arn"] },
          requestParameters: {
            "integration.request.header.Content-Type": "'application/x-www-form-urlencoded'"
          },
          requestTemplates: {
            "application/json": {
              "Fn::Join": [
                "",
                [
                  "Action=Publish&",
                  "Subject=$context.httpMethod $context.resourcePath&",
                  "Message=$util.urlEncode(\"{",
                  "\"\"resourcePath\"\":\"\"$context.resourcePath\"\",",
                  "\"\"httpMethod\"\":\"\"$context.httpMethod\"\",",
                  "\"\"requestTime\"\":\"\"$context.requestTimeEpoch\"\",",
                  "\"\"user\"\":\"\"$context.identity.user\"\",",
                  "\"\"cognitoIdentityId\"\":\"\"$context.identity.cognitoIdentityId\"\",",
                  "\"\"body\"\":$input.body}\")&",
                  "TopicArn=$util.urlEncode('",
                  { "Fn::Sub": `\${${topicResource}}` },
                  "')"
                ]
              ]
            }
          },
          responses: {
            "2\\d{2}": {
              statusCode: 202,
              responseTemplates: {
                "application/json": "#set ($root=$input.path('$')) { \"requestID\": \"$root.PublishResponse.PublishResult.MessageId\"}"
              }
            },
            default: {
              statusCode: 500,
              responseTemplates: {
                "application/json": "{ \"message\": \"An unexpected error has occurred.\" }"
              }
            }
          }
        };

        if (!topics[topicResource]) {
          topics[topicResource] = [];
        }

        topics[topicResource].push( {
          method: method.toUpperCase(),
          path: path
        });
      }
    }
    return topics;
  }

}