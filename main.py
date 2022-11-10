#!/usr/bin/env python3

from transformers import pipeline, PreTrainedTokenizer, \
  LogitsProcessor, LogitsWarper
import numpy as np
import torch as pt
from collections import defaultdict
from dataclasses import dataclass, replace
from typing import *
from math import ceil
from itertools import chain

generator = pipeline('text-generation', model='distilgpt2')
tokenizer = generator.tokenizer

def get_word_mask(tokens, decode):
  return np.array([decode(token).startswith(' ') for token in tokens])

@dataclass
class ParagraphLogitsProcessor(LogitsProcessor):
  tokens: pt.IntTensor
  batch_size: int
  word_mask: pt.BoolTensor
  eos_token_id: int
  linebreaks: List[int]
  para_config: Dict[str, Any]
  lb_weight: float

  def num_batches(self):
      return ceil(len(self.tokens)/self.batch_size)

  def min_space(self):
    return self.para_config['min_space']

  def __call__(self, input_ids: pt.LongTensor,
               scores: pt.FloatTensor) -> pt.FloatTensor:
    # input_ids = input_ids.expand((1,-1))
    # scores = scores.expand((1, -1))
    b, n = input_ids.shape
    bs = self.num_batches()
    assert b % bs == 0, f"num_batches ({bs}) must divide input_ids.shape[0] ({b})"
    beams = b // bs

    bid = pt.arange(b) // beams
    b_offset = bid * self.batch_size
    batch_sizes = pt.minimum((bid+1) * self.batch_size, pt.tensor(len(self.tokens))) - (bid * self.batch_size)

    eos = self.eos_token_id
    stoks = [eos, *self.linebreaks]
    lbs = pt.isin(input_ids, pt.tensor(stoks))
    batch_ixs = n - pt.sum(lbs, dim=1)
    token_ixs = batch_ixs + b_offset
    trunc_ixs = pt.minimum(token_ixs, pt.tensor(len(self.tokens)-1))
    last_lbs, _ = pt.max(lbs * pt.arange(n).T, dim=1)

    can_lb = pt.argwhere((self.min_space() < n - last_lbs)
      & self.word_mask[trunc_ixs])

    complete = pt.argwhere(batch_ixs == batch_sizes)

    b_ixs = pt.arange(b)
    token_ids = self.tokens[trunc_ixs]

    token_scores = scores[b_ixs, token_ids]
    eos_score, *lb_scores = scores[:, stoks].T

    scores[:, :] = -float('inf')
    scores[b_ixs, token_ids] = token_scores

    for lb_id, lb_score in zip(self.linebreaks, lb_scores):
      scores[can_lb, lb_id] = lb_score[can_lb] * self.lb_weight
    scores[complete, eos] = 0

    return scores

def main():
    with open('sample.txt') as f:
        sample = f.read()

    batch_size=256
    tokens = pt.squeeze(tokenizer(sample, return_tensors='pt')['input_ids'], dim=0)
    # padding = (batch_size - len(tokens)%batch_size) % batch_size
    # pad_tokens = pt.hstack([tokens, pt.tensor(tokenizer.eos_token_id).repeat(padding)])

    word_mask = get_word_mask(tokens, tokenizer.decode)
    linebreaks = np.squeeze(tokenizer(["\n", "\n\n"])['input_ids'], axis=1)
    para_config = {
        'min_space': 1
    }
    lb_weight = 3.6
    para_logits_processor = ParagraphLogitsProcessor(
        tokens, batch_size, word_mask, tokenizer.eos_token_id,
        linebreaks, para_config, lb_weight)

    results = generator(
        "",
        logits_processor=[para_logits_processor],
        return_tensors=True,
        handle_long_generation="hole",
        max_new_tokens=batch_size,
        num_return_sequences=para_logits_processor.num_batches(),
        do_sample=True,
        num_beams=2)

    out_tokens = list(chain(*[result['generated_token_ids'] for result in results]))
    out = tokenizer.decode(out_tokens, skip_special_tokens=True)

    with open("out.txt", 'w') as f:
        f.write(out)

if __name__ == "__main__":
    main()
