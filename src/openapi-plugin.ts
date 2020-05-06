import Serverless from "serverless";
import Plugin from "serverless/classes/Plugin";
import { OpenApiPluginOptions } from "./openapi-plugin-options";
import { DeploymentService } from "./services/deployment-service";
import { IntegrationService } from "./services/integration-service";

export const DEFAULT_API_GATEWAY_KEY = "ApiGatewayOpenApi";

export class OpenApiPlugin implements Plugin {
  readonly name: string;
  readonly hooks: { [key: string]: any };
  
  readonly deploymentService: DeploymentService;
  readonly integrationService: IntegrationService;
  readonly options: OpenApiPluginOptions;
  
  constructor(serverless: Serverless, _options: any) {

    this.name = "serverless-openapi";
    this.deploymentService = new DeploymentService(serverless);
    this.integrationService = new IntegrationService(serverless);
    this.options = serverless.service.custom.openapi || {};
    

    this.hooks = {
      "before:package:finalize": this.integrationService.updateApiDefinition(this.options),
      "after:deploy": () => this.deploymentService.deployApi(this.options)
    };
  }
}