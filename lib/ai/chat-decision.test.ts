import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { blockGeneratedReply, decideChatRoute } from './chat-decision'

const answer = {
  handler: 'answer',
  handlerConfidence: 0.9,
  wantsHuman: 0.1,
  complaint: 0.1,
  needsFacts: 0.1,
  excerptsAnswer: 0.1,
  hasExcerpts: false,
  injection: 0.05,
  sensitive: 0.05,
}

describe('decideChatRoute', () => {
  it('generates a greeting that does not need a program fact', () => {
    assert.deepEqual(decideChatRoute(answer), { action: 'generate', needsReview: false })
  })

  it('generates when the excerpts answer a factual question', () => {
    assert.deepEqual(
      decideChatRoute({ ...answer, needsFacts: 0.8, excerptsAnswer: 0.7, hasExcerpts: true }),
      { action: 'generate', needsReview: false },
    )
  })

  it('declines a factual question the excerpts do not answer', () => {
    assert.deepEqual(
      decideChatRoute({ ...answer, needsFacts: 0.8, excerptsAnswer: 0.2, hasExcerpts: true }),
      { action: 'decline', needsReview: false },
    )
  })

  it('holds an uncertain excerpt match for review', () => {
    assert.deepEqual(
      decideChatRoute({ ...answer, needsFacts: 0.8, excerptsAnswer: 0.5, hasExcerpts: true }),
      { action: 'decline', needsReview: true },
    )
  })

  it('hands off when the visitor asks for a person', () => {
    assert.deepEqual(
      decideChatRoute({ ...answer, wantsHuman: 0.6, handler: 'answer' }),
      { action: 'handoff', needsReview: true },
    )
  })

  it('hands off a complaint even if the handler says answer', () => {
    assert.deepEqual(
      decideChatRoute({ ...answer, complaint: 0.6 }),
      { action: 'handoff', needsReview: true },
    )
  })

  it('does not guess when handler confidence is low', () => {
    assert.deepEqual(
      decideChatRoute({ ...answer, handlerConfidence: 0.49 }),
      { action: 'decline', needsReview: true },
    )
  })

  it('does not generate a factual answer from an empty shortlist', () => {
    assert.deepEqual(
      decideChatRoute({ ...answer, needsFacts: 0.9, excerptsAnswer: 0.9, hasExcerpts: false }),
      { action: 'decline', needsReview: false },
    )
  })

  it('declines a prompt injection before generating', () => {
    assert.deepEqual(
      decideChatRoute({ ...answer, injection: 0.5, needsFacts: 0.1 }),
      { action: 'decline', needsReview: true },
    )
  })

  it('hands off a request for private staff information', () => {
    assert.deepEqual(
      decideChatRoute({ ...answer, sensitive: 0.6 }),
      { action: 'handoff', needsReview: true },
    )
  })

  it('blocks a generated reply that invents a detail or contradicts the excerpts', () => {
    assert.equal(blockGeneratedReply(0.6, 0.1), true)
    assert.equal(blockGeneratedReply(0.1, 0.6), true)
    assert.equal(blockGeneratedReply(0.59, 0.59), false)
  })
})
