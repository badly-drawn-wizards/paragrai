// ==UserScript==
// @name Paragrai
// @version 1
// @grant GM.xmlHttpRequest 
// @grant GM.getValue 
// @grant GM.setValue
// @require https://raw.githubusercontent.com/john-doherty/long-press-event/master/dist/long-press-event.min.js
// @include https://boxnovel.com/novel/*/*
// ==/UserScript==

const iconStates = {
  loading: "ion-md-refresh",
  error: "ion-md-alert",
  generated: "ion-md-return-left",
  original: "ion-md-reorder"
}

const addStyle = (css) => {
    const head = document.querySelector("head");
    const style = document.createElement("style");
    style.textContent = css; // Maybe change to innerHTML
    head.appendChild(style);
}
const style = [
  ".paragrai-mode-original .text-left:not(.paragrai-original) { display: none }",
  ".paragrai-mode-generated .text-left:not(.paragrai-generated) { display: none }",
  "@keyframes loading { 0 { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }",
  `.paragrai-icon.${iconStates['loading']}::before { animation: loading 1s infinite; }`
].join("\n");
  

const hasNewLine = str => str.match("\n") != null;
const api = 'http://localhost:8000'
const requestGeneration = (text, cached) => new Promise((resolve, reject) => {
  const reqEx = req => {
    const ex = new Error(`Failed request (${req.status}): ${req.statusText}`);
    ex.request = req;
    return ex;
  };
  const jsonText = JSON.stringify({text: text, cached: cached});
  GM.xmlHttpRequest({
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    data: jsonText,
    url: `${api}/generate`,
    onload: req => {
      if(req.status == 200) {
        resolve(JSON.parse(req.responseText).result);
      } else {
        reject(reqEx(req));
      }
    },
    onerror: req => reject(reqEx(req))
  });
});

const idemCreate = (parentSelector, childSelector, create) => {
  const parent = document.querySelector(parentSelector);
  let child = parent.querySelector(childSelector) || create(parent);
  return child;
}

const selectContent = () => document.querySelector('.reading-content');
const selectOriginal = () => selectContent().querySelector('.text-left:not(.paragrai-generated)');

const getTexts = node => node.nodeName == '#text' ? node.textContent : [...node.childNodes].flatMap(n => getTexts(n));
const getOriginalTexts = () => getTexts(selectOriginal()).map(t => t.trim()).filter(t => t !== "");

const selectGenerated = () => idemCreate('.reading-content', '.text-left.paragrai-generated', parent => {
  const el = document.createElement('div');
  parent.appendChild(el);
  el.classList.add('text-left', 'paragrai-generated');
  return el;
});
const selectIcon = () => idemCreate('.action_list_icon', '.paragrai-icon', parent => {
  const i = document.createElement('i');
  const a = document.createElement('a');
  const el = document.createElement('li');
  a.appendChild(i);
  el.appendChild(a);
  parent.appendChild(el);
  a.classList.add("wp-manga-action-button");
  a.title = "Paragrai";
  a.href = "#";
  i.classList.add("icon", "paragrai-icon");
  return i;
})
const updateIcon = (state) => {
  const icon = selectIcon();
  icon.classList.remove(...Object.values(iconStates));
  icon.classList.add(iconStates[state]);
}

const para = (text) => {
    let p = document.createElement('p')
    p.textContent = text;
    return p;
};
const setChildNodes = (el, nodes) => {
  while(el.lastChild) el.lastChild.remove();
  for(let node of nodes) {
    el.appendChild(node);
  }
}
const updateGenerated = nodes => {
  const generated = selectGenerated();
  setChildNodes(generated, nodes);
}

const updateOriginal = () => {
  const original = selectOriginal();
  original.classList.add('paragrai-original');
}

const updateMode = mode => {
  const content = selectContent();
  if(mode == 'original') {
    content.classList.add('paragrai-mode-original');
    content.classList.remove('paragrai-mode-generated');
  } else {
    content.classList.remove('paragrai-mode-original');
    content.classList.add('paragrai-mode-generated');
  }
}

const getMode = async () => (await GM.getValue("mode")) ? "generated" : "original";
const toggleMode = async () => await GM.setValue("mode", !(await GM.getValue("mode")));
const setGeneratedMode = () => GM.setValue("mode", true);

const maxBy = (xs, f) => {
  const by = xs.map(f);
  return xs[by.indexOf(Math.max(...by))]
}

const heuristicBulkContent = (texts, threshold) => {
  const length = texts.map(t => t.length).reduce((x,y) => x+y, 0);
  const text = maxBy(texts, t => t.length);
  const proportion = text.length / length;
  if (proportion >= threshold) { 
    return text
  } else {
    return null;
  }
}

const update = async (cached) => {
  const texts = getOriginalTexts();
  const threshold = 0.8;
  const mode = await getMode();

  updateOriginal();
  updateIcon(mode);

  
  const original = selectOriginal();
  var nodes = () => [...original.childNodes].map(node => node.cloneNode(true));
  try {
    const mainText = heuristicBulkContent(texts, threshold);
    if (mainText != null && mode === 'generated') {
      updateIcon("loading")
      const result = await requestGeneration(mainText, cached);
      const texts = result.split("\n");
      nodes = () => texts.map(text => para(text));
    }
    updateIcon(mode);
  
  } catch(e) {
    updateIcon("error")
    throw e;
  } finally {
    updateGenerated(nodes());
    updateMode(mode);
  }
}
const main = () => {
  addStyle(style);
  var task = null;
  const icon = selectIcon();
  const upd = cached => {
    if(task == null) {
      task = update(cached).finally(() => task = null);
    }
  };
  upd(true);
  icon.parentElement.onclick = e => {
    e.preventDefault();
    toggleMode().finally(() => upd(true));
  }
  icon.parentElement.addEventListener('long-press', e => {
    e.preventDefault();
    setGeneratedMode().finally(() => upd(false));
  });
}

main();