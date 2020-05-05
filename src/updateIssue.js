const { graphql: _graphql } = require('@octokit/graphql')
const debug = require('debug')('cloudformation-zenhub-github-label')
const qs = require('qs')
const graphql = _graphql.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.bane-preview+json' // Enable the labels preview.
  }
})

const PIPELINES = (process.env.PIPELINES || '').split(',').map(pipeline => pipeline.trim())
const PIPELINE_PREFIX = 'zh:'
const PIPELINE_COLOR = '7057ff'

const getPipelineLabels = async (owner, repo) => {
  const pipelines = await graphql(`
    query pipelines($owner: String!, $name: String!) {
      repository(name: $name, owner: $owner) {
        id
        labels(first: 100) {
          edges {
            node {
              id
              name
              description
              color
            }
          }
        }
      }
    }
  `, {
    owner,
    name: repo
  })
  const labels = pipelines.repository.labels.edges.map(edge => edge.node)
    .filter(node => node.name.startsWith(PIPELINE_PREFIX))
    .map(node => ({
      ...node,
      pipeline: node.name.replace(PIPELINE_PREFIX, '')
    }))
  const repositoryId = pipelines.repository.id
  return {
    labels,
    repositoryId
  }
}
const createPipelineLabel = async (repositoryId, pipeline) => {
  const { createLabel } = await graphql(`
    mutation createLabel($input: CreateLabelInput!) {
      createLabel(input: $input) {
        label {
          id
          name
          description
          color
        }
      }
    }
  `, {
    input: {
      color: PIPELINE_COLOR,
      name: `${PIPELINE_PREFIX}${pipeline}`,
      description: `Issues in the ZenHub pipeline '${pipeline}'`,
      repositoryId
    }
  })
  return {
    ...createLabel.label,
    pipeline
  }
}
const getIssueLabelIds = async (owner, repo, issueNumber) => {
  const { repository } = await graphql(`
    query issueLabels($owner: String!, $repo: String!, $issueNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $issueNumber) {
          id
          labels(first: 100) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
    }
  `, {
    owner,
    repo,
    issueNumber
  })
  return {
    issueId: repository.issue.id,
    labels: repository.issue.labels.edges.map(edge => edge.node.id)
  }
}
const updateIssueLabels = async (issueId, labelIds) => {
  await graphql(`
    mutation updateIssueLabels($input: UpdateIssueInput!) {
      updateIssue(input: $input) {
        issue {
          id
        }
      }
    }
  `, {
    input: {
      id: issueId,
      labelIds
    }
  })
}

exports.handler = async event => {
  debug('received message', event)
  const body = qs.parse(event.body)
  if (body.type !== 'issue_transfer') {
    debug('body is invalid type %s', body.type)
    return {
      statusCode: 200,
      body: 'Success!'
    }
  }
  const {
    from_pipeline_name: fromPipeline,
    to_pipeline_name: toPipeline,
    organization,
    repo,
    issue_number: _issueNumber
  } = body
  const issueNumber = parseInt(_issueNumber, 10)
  debug('pipeline %s -> %s', fromPipeline, toPipeline)
  if (PIPELINES.includes(toPipeline) || PIPELINES.includes(fromPipeline)) {
    const shouldAddNew = PIPELINES.includes(toPipeline)
    debug('pipeline %s is valid, updating pipeline label', toPipeline)
    debug('refreshing pipeline labels...')
    const { repositoryId, labels: pipelineLabels } = await getPipelineLabels(organization, repo)
    let label = pipelineLabels.find(pipelineLabel => pipelineLabel.pipeline === toPipeline)
    const oldPipelineLabel = pipelineLabels.find(pipelineLabel => pipelineLabel.pipeline === fromPipeline)
    debug('old pipeline label is', oldPipelineLabel)
    if (!label && shouldAddNew) {
      debug('pipeline label does not exist, creating...')
      label = await createPipelineLabel(repositoryId, toPipeline)
      debug('new pipeline label is', label)
    }
    debug('getting existing issue labels...')
    const existingIssue = await getIssueLabelIds(organization, repo, issueNumber)
    const existingIssueLabelIds = existingIssue.labels
    const existingIssueId = existingIssue.issueId
    let newIssueLabelIds = existingIssueLabelIds
    if (shouldAddNew) {
      debug('new pipeline is enabled, adding new label id')
      newIssueLabelIds = [...existingIssueLabelIds, label.id]
    }
    if (oldPipelineLabel) {
      debug('removing old pipeline label %s', oldPipelineLabel.name, oldPipelineLabel.id)
      newIssueLabelIds = newIssueLabelIds.filter(id => id !== oldPipelineLabel.id)
    }

    debug('updating issue with new label IDs', newIssueLabelIds)
    await updateIssueLabels(existingIssueId, newIssueLabelIds)

    debug('complete!')
  } else {
    debug('neither pipeline is enabled. skipping')
  }

  return {
    statusCode: 200,
    body: 'success!'
  }
}
