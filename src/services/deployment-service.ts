import * as AWS from "aws-sdk";
import * as path from "path";
import Serverless from "serverless";
import { DEFAULT_API_GATEWAY_KEY } from "../openapi-plugin";
import { OpenApiPluginOptions } from "../openapi-plugin-options";

export class DeploymentService {

  constructor(private readonly serverless: Serverless) {}

  public async deployApi(options: OpenApiPluginOptions) {
    const aws = this.serverless.getProvider("aws");
    const region = aws.getRegion();
    const apiGatewayKey = options.key || DEFAULT_API_GATEWAY_KEY;
    const stackName = this.serverless.service.provider["stackName"]|| [
      this.serverless.service.getServiceName(),
      this.serverless.getProvider("aws").getStage()
    ].join("-");

    if (options.updateDeployment === false) {
      return;
    }

    const cloudFormation = new AWS.CloudFormation({
      region, apiVersion: "2010-05-15"});

    const apigateway = new AWS.APIGateway({
      region, apiVersion: "2015-07-09"});

    const stack = await cloudFormation
      .describeStackResources({ StackName: stackName })
      .promise();

    if (options.usePackageVersion) {
      const packageLocation = path.resolve("./package.json");
      this.serverless.cli.log(`Loading version from ${packageLocation}`);
      const { version } = require(packageLocation);
      options.body.info.version = version;
    }
    
    const stageName = this.serverless.service.provider.stage;
    
    const apiResource = stack.StackResources.find(
      x => x.LogicalResourceId === `${apiGatewayKey}`
    );

    const restApiId = apiResource.PhysicalResourceId;

    this.serverless.cli.log(
      `Creating new deployment for ${restApiId} api stage ${stageName}...`
    );
    
    await apigateway
      .createDeployment({
        restApiId,
        stageName
      })
      .promise();
  }
}