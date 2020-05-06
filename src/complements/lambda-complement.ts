import Serverless from "serverless";
import { filterMethods } from "../common/method-utilities";
import { OpenApiPluginOptions } from "../openapi-plugin-options";
import { Resources } from "../services/integration-service";

export const FUNCTION_REFERENCE = "x-aws-lambda";

export class LambdaComplement {

  constructor(private readonly serverless: Serverless) { }

  public translateLambdaIntegration(options: OpenApiPluginOptions): Resources {
    const functions = {};
    const body = options.body;

    for (const path in body.paths) {
      const methods = filterMethods(body.paths[path]);

      for (const method in methods) {
        const methodProps = methods[method];
        const functionReference = methodProps[FUNCTION_REFERENCE];

        if (!functionReference) continue;

        const defaultFunctionResource = 
        `${functionReference.charAt(0).toUpperCase()}${functionReference.slice(1)}LambdaFunction`;

        const functionResource = this.serverless.service.getFunction(functionReference)
          ? defaultFunctionResource: functionReference;
        
        methodProps["x-amazon-apigateway-integration"] = {
          uri: {
            "Fn::Sub": `arn:aws:apigateway:\${AWS::Region}:lambda:path/2015-03-31/functions/\${${functionResource}.Arn}/invocations`
          },
          passthroughBehavior: "when_no_match",
          httpMethod: "POST",
          type: "aws_proxy",
          responses: {}
        };

        if (!functions[functionResource]) {
          functions[functionResource] = [];
        }

        functions[functionResource].push( {
          method: method.toUpperCase(),
          path: path
        });
      }
    }
    return functions;
  }
}