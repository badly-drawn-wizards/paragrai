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
  ".paragrai-mode-original .cha-words:not(.paragrai-original) { display: none }",
  ".paragrai-mode-generated .cha-words:not(.paragrai-generated) { display: none }",
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

const selectContent = () => document.querySelector('.cha-content');
const selectOriginal = () => selectContent().querySelector('.cha-words:not(.paragrai-generated)');
const getOriginalText = () => [...selectOriginal().querySelectorAll(".dib.pr")].map(x => x.textContent).join("").trim();
const selectGenerated = () => idemCreate('.cha-content', '.cha-words.paragrai-generated', parent => {
  const el = document.createElement('div');
  parent.appendChild(el);
  el.classList.add('cha-words', 'paragrai-generated');
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

const updateParagraphs = (el, text) => {
  const paragraphs = text.split(/\n+/)

  while(el.lastChild) el.lastChild.remove();
  for(let paragraph of paragraphs) {
    let p = document.createElement('p')
    p.textContent = paragraph
    el.appendChild(p);
  }
}
const updateGeneratedText = text => {
  const original = selectOriginal();
  const generated = selectGenerated();
  updateParagraphs(generated, text);
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

const update = async (cached) => {
  const text = getOriginalText();
  const mode = await getMode();

  updateOriginal();
  updateIcon(mode);

  
  try {
    if(!hasNewLine(text) && mode === 'generated') {
      updateIcon("loading")
      const result = await requestGeneration(text, cached);
      updateGeneratedText(result);
      updateIcon(mode);
    } else {
      updateGeneratedText(text);
    }
  } catch(e) {
    updateIcon("error")
    throw e;
  } finally {
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

main()