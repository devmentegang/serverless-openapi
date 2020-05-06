import { filterMethods } from "../common/method-utilities";
import { OpenApiPluginOptions } from "../openapi-plugin-options";

export const CORS_REFERENCE = "x-aws-cors";

export class CorsComplement {

  public translateCorsIntegration(options: OpenApiPluginOptions): void {
    const body = options.body;

    for (const path in body.paths) {
      const methods = filterMethods(body.paths[path]);
      const pathData = body.paths[path];

      const pathCors = pathData[CORS_REFERENCE];
      if (pathCors && !pathData["options"]) {

        let headers = [];

        for (const method in methods) {
          const methodProps = methods[method];

          methodProps.parameters
            ?.filter(x => x.in.toLowerCase() === "header")
            ?.map(x => x.name)
            ?.forEach(header => headers.push(header));
        }

        headers = headers.reduce((current: Array<string>, next: string) => {
          if (!current.find(x => x.toLowerCase() === next.toLowerCase())) {
            current.push(next);
          }
          return current;
        }, []);

        const origin = `'${pathCors.origin || "*"}'`;
        const allowedMethods = `'${(pathCors.methods || Object.keys(methods))
          .join(",")
          .toUpperCase()}'`;

        const allowedHeaders = `'${(pathCors.headers || headers).join(",")}'`;

        pathData.options = {
          responses: {
            200: {
              description: "Default CORS response",
              content: {},
              headers: {
                "Access-Control-Allow-Origin": { schema: { type: "string" } },
                "Access-Control-Allow-Methods": { schema: { type: "string" } },
                "Access-Control-Allow-Headers": { schema: { type: "string" } }
              }
            }
          },
          "x-amazon-apigateway-integration": {
            responses: {
              default: {
                statusCode: 200,
                responseParameters: {
                  "method.response.header.Access-Control-Allow-Origin": origin,
                  "method.response.header.Access-Control-Allow-Methods": allowedMethods,
                  "method.response.header.Access-Control-Allow-Headers": allowedHeaders
                }
              }
            },
            passthroughBehavior: "never",
            requestTemplates: {
              "application/json": JSON.stringify({ statusCode: 200 })
            },
            type: "mock"
          }
        };

        delete pathData["x-aws-cors"];
      }
    }
  }
}