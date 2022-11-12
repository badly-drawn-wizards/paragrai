from fastapi import FastAPI, Depends
from pydantic import BaseModel
from paragrai import Paragrai, ParagraiConfig, CacheConfig
from os import mkdir, path
from pathlib import Path

def init_cache_config():
  cache_dir = Path('~/.cache/paragrai').expanduser()
  try:
    mkdir(cache_dir)
  except FileExistsError:
    pass
  return CacheConfig(cache_dir)

def init_paragrai():
  return Paragrai(ParagraiConfig(), init_cache_config())

paragrai = init_paragrai()
api = FastAPI()

class GenerateReq(BaseModel):
  text: str
  cached: bool = True

class GenerateRes(BaseModel):
  result: str

@api.post("/generate", response_model=GenerateRes)
async def generate(req: GenerateReq):
  return GenerateRes(result=paragrai.generate(req.text, req.cached))