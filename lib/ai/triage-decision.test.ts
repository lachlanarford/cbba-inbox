import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { decideTriageWrite, readTriageScores, scoresNeedAttention } from './triage-decision'

const clear = {
  department: 'Comps',
  departmentConfidence: 0.9,
  priority: 'high',
  priorityConfidence: 0.8,
  safety: 0.1,
  complaint: 0.1,
  payment: 0.1,
  soon: 0.1,
}

describe('decideTriageWrite', () => {
  it('writes both labels when neither source is set', () => {
    assert.deepEqual(
      decideTriageWrite({ departmentSource: null, prioritySource: null }, clear),
      {
        department: 'Comps',
        department_source: 'ai',
        priority: 'high',
        priority_source: 'ai',
      },
    )
  })

  it('leaves staff and channel labels alone', () => {
    assert.deepEqual(
      decideTriageWrite({ departmentSource: 'staff', prioritySource: 'channel' }, clear),
      {},
    )
  })

  it('fills only the open field', () => {
    assert.deepEqual(
      decideTriageWrite({ departmentSource: 'channel', prioritySource: null }, clear),
      { priority: 'high', priority_source: 'ai' },
    )
  })

  it('flags review instead of writing a low-confidence open label', () => {
    const write = decideTriageWrite(
      { departmentSource: null, prioritySource: 'legacy' },
      { ...clear, departmentConfidence: 0.49 },
    )
    assert.equal(write.department, undefined)
    assert.equal(write.needs_review, true)
  })

  it('flags safety even when labels are locked', () => {
    const write = decideTriageWrite(
      { departmentSource: 'staff', prioritySource: 'staff' },
      { ...clear, safety: 0.4 },
    )
    assert.deepEqual(write, { needs_review: true })
  })

  it('does not flag a weak safety signal on a locked conversation', () => {
    assert.deepEqual(
      decideTriageWrite(
        { departmentSource: 'legacy', prioritySource: 'legacy' },
        { ...clear, safety: 0.39, complaint: 0.59 },
      ),
      {},
    )
  })

  it('rejects a department outside the set', () => {
    const write = decideTriageWrite(
      { departmentSource: null, prioritySource: 'ai' },
      { ...clear, department: 'Finance' },
    )
    assert.equal(write.department, undefined)
    assert.equal(write.needs_review, true)
  })
})

const stored = {
  safety: 0.1,
  complaint: 0.1,
  payment: 0.1,
  soon: 0.1,
  refund: 0.1,
  missing_details: 0.1,
  frustration: 0.4,
  frustration_confidence: 0.9,
}

describe('triage scores', () => {
  it('reads a stored score blob and ignores a partial one', () => {
    assert.deepEqual(readTriageScores(stored), stored)
    assert.equal(readTriageScores({ safety: 0.2 }), null)
  })

  it('flags attention from raw scores without treating the gates as permanent', () => {
    assert.equal(scoresNeedAttention(stored), false)
    assert.equal(scoresNeedAttention({ ...stored, refund: 0.6 }), true)
    assert.equal(scoresNeedAttention({ ...stored, frustration: 1.5, frustration_confidence: 0.49 }), false)
    assert.equal(scoresNeedAttention({ ...stored, frustration: 1.5, frustration_confidence: 0.5 }), true)
  })
})
