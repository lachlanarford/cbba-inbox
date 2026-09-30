import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyExcerptJudgments, excerptIsUseful } from './rerank'

const items = [
  { title: 'fees', bm25: 3 },
  { title: 'padded', bm25: 0 },
  { title: 'draw', bm25: 1 },
]

describe('excerpt rerank', () => {
  it('keeps an excerpt at the starting score and confidence gates', () => {
    assert.equal(excerptIsUseful({ score: 1.5, confidence: 0.5 }), true)
    assert.equal(excerptIsUseful({ score: 1.49, confidence: 0.9 }), false)
    assert.equal(excerptIsUseful({ score: 2, confidence: 0.49 }), false)
  })

  it('drops zero-score padding when there is no judgment', () => {
    assert.deepEqual(
      applyExcerptJudgments(items, null).map((item) => item.title),
      ['fees', 'draw'],
    )
  })

  it('keeps only excerpts the relevance judgment accepts', () => {
    assert.deepEqual(
      applyExcerptJudgments(items, [
        { score: 1.2, confidence: 0.9 },
        { score: 2, confidence: 0.9 },
        { score: 1.8, confidence: 0.8 },
      ]).map((item) => item.title),
      ['draw'],
    )
  })
})
