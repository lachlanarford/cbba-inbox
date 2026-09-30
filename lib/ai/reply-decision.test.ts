import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { draftNeedsFactCheck, pickCannedResponse } from './reply-decision'

describe('reply decisions', () => {
  it('picks a template only when it is one of the candidates and confidence clears the gate', () => {
    assert.equal(pickCannedResponse({ choice: 'fees', confidence: 0.8, ids: ['fees'] }), 'fees')
    assert.equal(pickCannedResponse({ choice: 'none', confidence: 0.9, ids: ['fees'] }), null)
    assert.equal(pickCannedResponse({ choice: 'fees', confidence: 0.49, ids: ['fees'] }), null)
    assert.equal(pickCannedResponse({ choice: 'missing', confidence: 0.9, ids: ['fees'] }), null)
  })

  it('asks staff to check a draft once unsupported facts are likely', () => {
    assert.equal(draftNeedsFactCheck(0.6), true)
    assert.equal(draftNeedsFactCheck(0.59), false)
  })
})
