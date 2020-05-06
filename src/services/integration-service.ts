import Serverless from "serverless";
import { cutParamCaseString } from "../common/string-utilities";
import { CorsComplement } from "../complements/cors-complement";
import { LambdaComplement } from "../complements/lambda-complement";
import { SnsComplement } from "../complements/sns-complement";
import { DEFAULT_API_GATEWAY_KEY } from "../openapi-plugin";
import { OpenApiPluginOptions } from "../openapi-plugin-options";

export type Resources = {
  [key: string]: EndPoint[];
}

export type EndPoint = {
  method: string;
  path: string;
}

export class IntegrationService {

  private readonly corsComplement: CorsComplement;
  private readonly lambdaComplement: LambdaComplement;
  private readonly snsComplement: SnsComplement;

  constructor(private readonly serverless: Serverless) {
    this.corsComplement = new CorsComplement()
    this.lambdaComplement = new LambdaComplement(serverless);
    this.snsComplement = new SnsComplement();
  }
    
  public updateApiDefinition(options: OpenApiPluginOptions) {
    return (() => {
      if(!options.body) return;
      this.processRestApiBody(options);
    }).bind(this);
  }


  private processRestApiBody(options: OpenApiPluginOptions) {
    const topics = this.snsComplement.translateSnsIntegration(options);
    const functions = this.lambdaComplement.translateLambdaIntegration(options);
    this.corsComplement.translateCorsIntegration(options);
    this.decorateApiGatewayRestApi(options, topics, functions);
  }

  private decorateApiGatewayRestApi(options: OpenApiPluginOptions, topicsResources: Resources, functionsResources: Resources) {

    const topics = Object.keys(topicsResources);
    const functions = Object.keys(functionsResources);
    const resources = this.serverless.service.provider.compiledCloudFormationTemplate.Resources;
    const service = this.serverless.service.getServiceName();
    const stage = this.serverless.service.provider.stage;
    const body = options.body;

    const policies = [];
    if (topics.length > 0) policies.push(this.buildTopicsPolicy(service, stage, topics));
    if (functions.length > 0) policies.push(this.buildFunctionsPolicy(service, stage, functions));

    const apiGatewayKey = options.key || DEFAULT_API_GATEWAY_KEY;
    resources[`${apiGatewayKey}Role`] = {
      Type: "AWS::IAM::Role",
      Properties: {
        RoleName: cutParamCaseString(`${service}-open-api`, `role-${stage}`),
        AssumeRolePolicyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: {Service: "apigateway.amazonaws.com"},
              Action: ["sts:AssumeRole"]
            }
          ]
        },
        Policies: policies,
        ManagedPolicyArns: ["arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"]
      }
    }

    if(!resources[`${apiGatewayKey}`]) {
      resources[`${apiGatewayKey}`] = {
        Type: "AWS::ApiGateway::RestApi",
        Properties: {
          Body: body,
          EndpointConfiguration: {
            Types: [options.endpointType || "regional"]
          }
        }
      };
    } else {
      resources[`${apiGatewayKey}`].Properties.Body = body;
    }

    resources[`${apiGatewayKey}Deployment`] = {
      Type: "AWS::ApiGateway::Deployment",
      DependsOn: [`${apiGatewayKey}`],
      Properties: {
        RestApiId: { Ref: `${apiGatewayKey}`},
        StageName: stage
      }
    };

    for(const fn in functionsResources) {
      functionsResources[fn].forEach(endpoint => {
        const resourceName = `${fn}Permission`
        resources[resourceName] = this.buildFunctionPermission(`${apiGatewayKey}`, fn, endpoint.method, endpoint.path);
      });
    }
  }

  private buildTopicsPolicy(service: string, stage: string, topics: string[]) {

    return {
      PolicyName: cutParamCaseString(`${service}-open-api`,`topics-policy-${stage}`),
      PolicyDocument: {
        Version: "2012-10-17",
        Statement: topics.map(topicName => {
          return {
            Effect: "Allow",
            Action: "sns:Publish",
            Resource: { "Fn::Sub": `\${${topicName}}` }
          }
        })
      }
    };
  }

  private buildFunctionsPolicy(service: string, stage: string, functions: string[]) {

    return {
      PolicyName: cutParamCaseString(`${service}-open-api`,`functions-policy-${stage}`),
      PolicyDocument: {
        Version: "2012-10-17",
        Statement: functions.map(fn => {
          return {
            Effect: "Allow",
            Action: "lambda:InvokeFunction",
            Resource: { "Fn::Sub": `\${${fn}.Arn}` },
          }
        })
      }
    };
  }

  private buildFunctionPermission(apiGatewayKey: string, fn: string, method:string, path: string) {
    
    const finalPath = path.endsWith("/")? path.slice(0, -1): path;
    const fullPath = `\${${apiGatewayKey}}/*/${method}${finalPath}`;
    
    return {
      Type: "AWS::Lambda::Permission",
      Properties: {
        FunctionName: { "Fn::Sub": `\${${fn}.Arn}` },
        Action: "lambda:InvokeFunction",
        Principal: { "Fn::Sub": "apigateway.${AWS::URLSuffix}" },
        SourceArn: {
          "Fn::Sub": `arn:aws:execute-api:\${AWS::Region}:\${AWS::AccountId}:${fullPath}`
        }
      }
    };
  }
}