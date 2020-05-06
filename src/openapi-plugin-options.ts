export interface OpenApiPluginOptions{
  key?: string;
  body: any;
  description?: string;
  endpointType?: string;
  updateDeployment?: boolean;
  usePackageVersion?: boolean;
}