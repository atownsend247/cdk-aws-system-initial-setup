#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkAwsSystemInitialSetupStack } from '../lib/cdk-aws-system-initial-setup-stack';

const app = new cdk.App();
new CdkAwsSystemInitialSetupStack(app, 'CdkAwsSystemInitialSetupStack', {
    env: {
        region: "eu-west-2"
    },
    tags: {
        "ews:owner": "atownsend",
        "ews:provsionedBy": "cdk"
    }
});
