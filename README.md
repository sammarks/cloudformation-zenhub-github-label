![][header-image]

[![CircleCI](https://img.shields.io/circleci/build/github/sammarks/cloudformation-zenhub-github-label/master)](https://circleci.com/gh/sammarks/cloudformation-zenhub-github-label)
[![Coveralls](https://img.shields.io/coveralls/sammarks/cloudformation-zenhub-github-label.svg)](https://coveralls.io/github/sammarks/cloudformation-zenhub-github-label)
[![Dev Dependencies](https://david-dm.org/sammarks/cloudformation-zenhub-github-label/dev-status.svg)](https://david-dm.org/sammarks/cloudformation-zenhub-github-label?type=dev)
[![Donate](https://img.shields.io/badge/donate-paypal-blue.svg)](https://paypal.me/sammarks15)

`cloudformation-zenhub-github-label` is an AWS SAM + CloudFormation template designed to
automatically update Github issues with their current ZenHub pipeline.

## Get Started

It's simple! Click this fancy button:

[![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/new?stackName=zenhub-github-label&templateURL=https://sammarks-cf-templates.s3.amazonaws.com/zenhub-github-label/template.yaml)

Then give the stack a name, and configure it:

### Parameters

| Parameter | Required | Default Value | Description |
| --- | --- | --- | --- |
| GithubToken | **Yes** | | Your Github authentication token. Requires the `repo` scope. |
| Pipelines | **Yes** | | A comma-separated list of ZenHub pipelines to track in Github. |
| DebugLevel | No | `<empty string>` | The `DEBUG` environment variable for the Lambda. Set to `cloudformation-zenhub-github-label` to enable debug messages. |

### Outputs

| Output | Description |
| --- | --- |
| APIEndpoint | The API Gateway endpoint to add to ZenHub |

### Usage in Another Stack or Serverless

Add something like this underneath resources:

```yaml
videoThumbnailStack:
  Type: AWS::CloudFormation::Stack
  Properties:
    TemplateURL: https://sammarks-cf-templates.s3.amazonaws.com/zenhub-github-label/VERSION/template.yaml
    Parameters:
      GithubToken: 'abcde'
      Pipelines: 'Done, Todo'
      DebugLevel: ''
```

**Note:** This stack will require the `CAPABILITY_AUTO_EXPAND` capability when deploying
the parent stack with CloudFormation. If you are using the Serverless framework, you can
"trick" it into adding the required capabilities by adding this to your `serverless.yaml`:

```yaml
resources:
  Transform: 'AWS::Serverless-2016-10-31' # Trigger Serverless to add CAPABILITY_AUTO_EXPAND
  Resources:
    otherResource: # ... all of your original resources
```

### Regions

**A quick note on regions:** If you are deploying this stack in a region other than `us-east-1`,
you need to reference the proper region S3 bucket as we're deploying Lambda functions. Just
add the region suffix to the template URL, so this:

```
https://sammarks-cf-templates.s3.amazonaws.com/zenhub-github-label/VERSION/template.yaml
```

becomes this:

```
https://sammarks-cf-templates-us-east-2.s3.amazonaws.com/zenhub-github-label/VERSION/template.yaml
```

### What's deployed?

- An API Gateway service
- A Lambda function for ingesting Webhook notifications from ZenHub.

### How does it work?

The Lambda goes through the following steps:

- It first checks Github to get information about the labels enabled in the repository and the
  labels currently present on the issue.
- It creates the pipeline label if it does not already exist (prefixed with `zh:`)
- It updates the issue, adding the new pipeline label, removing the old one, and preserving any
  already-existing labels.

### Accessing Previous Versions & Upgrading

Each time a release is made in this repository, the corresponding template is available at:

```
https://sammarks-cf-templates.s3.amazonaws.com/zenhub-github-label/VERSION/template.yaml
```

**On upgrading:** I actually _recommend_ you lock the template you use to a specific version. Then, if you want to update to a new version, all you have to change in your CloudFormation template is the version and AWS will automatically delete the old stack and re-create the new one for you.

## Features

- Automatically update Github issues with their current ZenHub Pipeline for tracking.
- Automatically creates labels representing the ZenHub pipelines if they do not yet exist.
- Deploy with other CloudFormation-compatible frameworks (like the Serverless framework).
- All functionality is self-contained within one CloudFormation template. Delete the template, and all of our created resources are removed.

## Why use this?

Let's say you're using something like [cloudformation-github-sheets-sync](https://github.com/sammarks/cloudformation-github-sheets-sync)
and you want to keep track of the ZenHub pipeline inside your spreadsheet so you can do some
reporting on it. Before, you would have to make an API request to ZenHub from Google Sheets, which
[is possible,](https://sammarks.me/posts/adding-zenhub-estimates-to-google-sheets/) but you run
into problems with API limits.

Since ZenHub also supports webhooks, this Lambda function just updates the labels on Github
which have first-party support from the cloudformation-github-sheets-sync script.

[header-image]: https://raw.githubusercontent.com/sammarks/art/master/cloudformation-zenhub-github-label/header.jpg
