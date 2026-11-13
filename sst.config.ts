/// <reference path="./.sst/platform/config.d.ts" />
// Deploys willy.work to AWS: the Next.js server runs on Lambda behind CloudFront (both always free at
// this site's traffic). Secrets live in SSM, set once with `npx sst secret set <Name> <value> --stage production`.
// DNS stays on Cloudflare (free); see "Deploying on AWS" in README.md.
export default $config({
  app(input) {
    return {
      name: "willy-blog",
      home: "aws",
      removal: input?.stage === "production" ? "retain" : "remove",
      // The AWS project only allows Regional resources (Lambda, S3, ...) in its Region, us-east-2.
      providers: {
        aws: { region: "us-east-2", profile: "willy-sst" },
        cloudflare: { package: "@pulumi/cloudflare", version: "6.24.0" },
      },
    };
  },
  async run() {
    const { satGate, satToken } = await import("./lib/satToken");
    const mongoUri = new sst.Secret("MongoUri");
    const authUrl = new sst.Secret("BetterAuthUrl");
    const authSecret = new sst.Secret("BetterAuthSecret");
    const todoist = new sst.Secret("TodoistApiToken", "");
    const site = new sst.aws.Nextjs("Site", {
      openNextVersion: "4.1.15", // SST's default (3.x) predates Next 16; 4.1.x needs next >= 16.4.5
      // SST makes the free AWS certificate (us-east-1, allowed for projects) and the Cloudflare records
      // (DNS only, grey cloud). Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_DEFAULT_ACCOUNT_ID when deploying.
      domain: { name: "willy.work", redirects: ["www.willy.work"], dns: sst.cloudflare.dns() },
      environment: {
        MONGO_URI: mongoUri.value,
        BETTER_AUTH_URL: authUrl.value,
        BETTER_AUTH_SECRET: authSecret.value,
        TODOIST_API_TOKEN: todoist.value,
      },
      // public/sat-bank only goes to admins (they get the cookie from /sat; see lib/satToken.ts)
      edge: { viewerRequest: { injection: authSecret.value.apply((s) => satGate(satToken(s))) } },
    });

    // Spending kill switch. AWS can't cap a bill, so once this month's real charges (after credits) pass $10, a
    // function takes the site offline (infra/kill-switch.ts; "Spending kill switch" in README.md to undo).
    const account = aws.getCallerIdentityOutput().accountId;
    const spend = new sst.aws.SnsTopic("Spend");
    const spendPolicy = new aws.sns.TopicPolicy("SpendPolicy", {
      arn: spend.arn,
      policy: $jsonStringify({
        Version: "2012-10-17",
        Statement: [{
          Effect: "Allow", Principal: { Service: "budgets.amazonaws.com" }, Action: "SNS:Publish", Resource: spend.arn,
          Condition: { StringEquals: { "aws:SourceAccount": account }, ArnLike: { "aws:SourceArn": $interpolate`arn:aws:budgets::${account}:*` } },
        }],
      }),
    });
    const sitePrefix = `${$app.name}-${$app.stage}-Site`; // the server and image functions, e.g. willy-blog-production-SiteServer...
    const distribution = site.nodes.cdn!.nodes.distribution;
    spend.subscribe("KillSwitch", {
      handler: "infra/kill-switch.handler",
      environment: { FUNCTION_PREFIX: sitePrefix, DISTRIBUTION_ID: distribution.id },
      permissions: [
        { actions: ["lambda:ListFunctions"], resources: ["*"] },
        { actions: ["lambda:PutFunctionConcurrency"], resources: [$interpolate`arn:aws:lambda:us-east-2:${account}:function:${sitePrefix}*`] },
        { actions: ["cloudfront:GetDistributionConfig", "cloudfront:UpdateDistribution"], resources: [distribution.arn] },
      ],
    });
    new aws.budgets.Budget("Spend", {
      budgetType: "COST", limitAmount: "10", limitUnit: "USD", timeUnit: "MONTHLY",
      notifications: [{
        comparisonOperator: "GREATER_THAN", threshold: 100, thresholdType: "PERCENTAGE", notificationType: "ACTUAL",
        subscriberSnsTopicArns: [spend.arn],
      }],
    }, { dependsOn: [spendPolicy] });

    return { url: site.url };
  },
});
