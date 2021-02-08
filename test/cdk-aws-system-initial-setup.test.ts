import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as CdkAwsSystemInitialSetup from '../lib/cdk-aws-system-initial-setup-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new CdkAwsSystemInitialSetup.CdkAwsSystemInitialSetupStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate(
      {},
    MatchStyle.EXACT))
});
