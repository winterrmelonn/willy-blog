import { LambdaClient, PutFunctionConcurrencyCommand, paginateListFunctions } from "@aws-sdk/client-lambda";
import { CloudFrontClient, GetDistributionConfigCommand, UpdateDistributionCommand } from "@aws-sdk/client-cloudfront";

// Runs when this month's AWS bill passes the budget in sst.config.ts. It takes the site offline so the bill
// stops growing: every site function is throttled to 0 and CloudFront is disabled. To bring the site back,
// see "Spending kill switch" in README.md.
export async function handler() {
    const results = await Promise.allSettled([throttleFunctions(), disableCdn()]);
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length) throw new AggregateError(failed.map((r) => r.reason), "kill switch partly failed"); // SNS retries
}

async function throttleFunctions() {
    const lambda = new LambdaClient({});
    for await (const page of paginateListFunctions({ client: lambda }, {}))
        for (const fn of page.Functions ?? [])
            if (fn.FunctionName?.startsWith(process.env.FUNCTION_PREFIX!))
                await lambda.send(new PutFunctionConcurrencyCommand({ FunctionName: fn.FunctionName, ReservedConcurrentExecutions: 0 }));
}

async function disableCdn() {
    const cf = new CloudFrontClient({});
    const Id = process.env.DISTRIBUTION_ID!;
    const { DistributionConfig, ETag } = await cf.send(new GetDistributionConfigCommand({ Id }));
    await cf.send(new UpdateDistributionCommand({ Id, IfMatch: ETag, DistributionConfig: { ...DistributionConfig!, Enabled: false } }));
}
