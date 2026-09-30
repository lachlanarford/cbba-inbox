import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { acceptFeedbackTheme } from './feedback-theme'
import { acceptSuggestedPriority } from './bug-priority'
import { keepSearchHit, shouldUseSemanticSearch } from '../inbox/semantic-search'

describe('later judgments', () => {
  it('stores a feedback theme only when confidence clears the gate', () => {
    assert.equal(acceptFeedbackTheme('unresolved', 0.8), 'unresolved')
    assert.equal(acceptFeedbackTheme('unresolved', 0.49), null)
    assert.equal(acceptFeedbackTheme('billing', 0.9), null)
  })

  it('stores a suggested bug priority without replacing an unknown label', () => {
    assert.equal(acceptSuggestedPriority('high', 0.7), 'high')
    assert.equal(acceptSuggestedPriority('urgent', 0.9), null)
    assert.equal(acceptSuggestedPriority('low', 0.4), null)
  })

  it('uses semantic search for a question and keyword search for an email', () => {
    assert.equal(shouldUseSemanticSearch('aussie hoops refund'), true)
    assert.equal(shouldUseSemanticSearch('ab'), false)
    assert.equal(shouldUseSemanticSearch('parent@example.com'), false)
    assert.equal(keepSearchHit(1.5, 0.5), true)
    assert.equal(keepSearchHit(1.4, 0.9), false)
  })
})
