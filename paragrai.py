#!/usr/bin/env python3

from transformers import pipeline, PreTrainedTokenizer, \
  LogitsProcessor, LogitsWarper
import numpy as np
import torch as pt
import logging as log
from collections import defaultdict
from dataclasses import dataclass, replace
from typing import *
from math import ceil
from itertools import chain
from sys import argv
from os.path import join
from hashlib import sha256

def get_word_mask(tokens, decode):
  return np.array([decode(token).startswith(' ') for token in tokens])

@dataclass
class ParagraphLogitsProcessor(LogitsProcessor):
  tokens: pt.IntTensor
  batch_size: int
  word_mask: pt.BoolTensor
  eos_token_id: int
  linebreaks: List[int]
  min_space: Dict[str, Any]
  lb_weight: float

  def num_batches(self):
      return ceil(len(self.tokens)/self.batch_size)

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

    can_lb = pt.argwhere((self.min_space < n - last_lbs)
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

@dataclass
class ParagraiConfig:
  model: str = 'distilgpt2'
  min_space: int = 1
  batch_size: int = 256
  lb_weight: float = 3.6

@dataclass
class CacheConfig:
  cache_dir: str

class Cache:
  def __init__(self, func, meta, config):
    self.func = func
    self.meta = meta
    self.config = config

  def lookup(self, content, cached):
    cache_dir = self.config.cache_dir
    digest = sha256(self.meta + content.encode()).hexdigest()
    try:
      if cached:
        with open(join(cache_dir, digest), 'r') as f:
          return f.read()
    except FileNotFoundError:
      pass
    result = self.func(content)
    try:
      with open(join(cache_dir, digest), 'w') as f:
        f.write(result)
    except:
      log.exception("Error when writing to cache")
    return result

class ParagraiGenerator:
  def __init__(self, config: ParagraiConfig):
    self.config = config
    self.generator = pipeline('text-generation', self.config.model)

  def generate(self, sample):
    tokenizer = self.generator.tokenizer
    tokens = pt.squeeze(tokenizer(sample, return_tensors='pt')['input_ids'], dim=0)

    linebreaks = np.squeeze(tokenizer(["\n", "\n\n"])['input_ids'], axis=1)
    
    word_mask = get_word_mask(tokens, tokenizer.decode)

    para_logits_processor = ParagraphLogitsProcessor(
        tokens, self.config.batch_size, word_mask, tokenizer.eos_token_id,
        linebreaks, self.config.min_space, self.config.lb_weight)

    results = self.generator(
        "",
        logits_processor=[para_logits_processor],
        return_tensors=True,
        handle_long_generation="hole",
        max_new_tokens=self.config.batch_size,
        num_return_sequences=para_logits_processor.num_batches(),
        do_sample=True,
        num_beams=2)

    out_tokens = list(chain(*[result['generated_token_ids'] for result in results]))
    return tokenizer.decode(out_tokens, skip_special_tokens=True)

class Paragrai:
  def __init__(self, paragrai_config: ParagraiConfig, cache_config: CacheConfig):
    self.paragrai_config = paragrai_config
    self.cache_config = cache_config

    self.generator = ParagraiGenerator(paragrai_config)
    self.cache = Cache(self.generator.generate, str(paragrai_config).encode(), cache_config)

  def generate(self, sample, cached):
    return self.cache.lookup(sample, cached)