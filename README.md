# What is this?

## Before

When you read translated web novels on aggregator sites, some novels are machine translated or scraped from other sites with no regard to formatting. Particularly, some chapters have absolutely no paragraphs or line breaks. This can sometimes span multiple chapters with no end in sight. Now of course you can just give up reading at this point, but we aren't quitters. The solution: machine learning. We use the distilGPT2 text generation model and force it to either generate from a given linefeed free text or insert a newline. Doing this for the whole text is too slow so we have split it into batches. There are some fiddley parameters that we have tuned to make this well enough. The text generation is exposed via a REST API with a janky cache so that generation is only performed once per chapter. This API then consumed by a GreaseMonkey script that runs on the aforementioned aggregator site which replaces the run-on chapter with the better flowing one. There is also an added button to toggle the original. Long pressing the button forces a generation which bypasses the cache. All in all this was a fun little side project which should in now way be taken seriously.

## After

When you read translated web novels on aggregator sites, some novels are machine translated or scraped from other sites with no regard to formatting.

Particularly, some chapters have absolutely no paragraphs or line breaks. This can sometimes span multiple chapters with no end in sight.

Now of course you can just give up reading at this point, but we aren't quitters. The solution:

machine learning.

We use the distilGPT2 text generation model and force it to either generate from a given linefeed free text or insert a newline.

Doing this for the whole text is too slow so we have split it into batches.

There are some fiddley parameters that we have tuned to make this well enough. The text generation is exposed via a REST API with a janky cache so that generation is only performed once per chapter.

This API then consumed by a GreaseMonkey script that runs on the aforementioned aggregator site which replaces the run-on chapter with the better flowing one.

There is also an added button to toggle the original.

Long pressing the button forces a generation which bypasses the cache.

All in all this was a fun little side project which should in no way be taken seriously.

## Evaluation on the above

The algorithm clearly doesn't do paragraphs here well. Topics are not well grouped and 'The solution:
machine learning.' is kind weird. However it performs well enough for its built purpose as web novels tend to be mostly dialog and one to three sentence paragraphs. Perhaps with more fine tuning and smarter people it can perform better in more general contexts.

# How to run?

## API
- Install python dependencies in `requirements.txt`
- Run with `uvicorn api:api`. It is hard-coded to cache results under `~/.cache/paragrai`.

## GreaseMonkey
- Install GreaseMonkey and the `userscript.js` script
- Go to a [boxnovel](https://boxnovel.com/) and test a degenerate chapter such as 
  [this one](novel/beast-taming-i-can-extract-pleasure-points/chapter-45/). It will only do generation if the chapter has no line breaks.

# Caveats

This is some of the ugliest code I written in a while and I have almost no experience with ML so be gentle.
Also, I encourage people to read from the original translations where possible. Don't be lazy like me.

# WHY?

Because when life gives you lemons, you spend a few days to build a lemonade factory.