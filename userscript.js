// ==UserScript==
// @name     Paragrai
// @version  1
// @grant    GM.xmlHttpRequest
// @include https://boxnovel.com/novel/*/*
// ==/UserScript==

const getContent = () => Array.prototype.map.call(document.querySelectorAll(".cha-content .dib.pr"), x => x.textContent).join("").trim();
const hasNewLine = str => str.match("\n") != null;
const api = 'http://localhost:8000'
const requestGeneration = (content) => new Promise((resolve, reject) => {
  const reqEx = req => {
    const ex = new Error(`Failed request (${req.status}): ${req.statusText}`);
    ex.request = req;
    return ex;
  };
  const jsonText = JSON.stringify({content: content});
//   console.log("Sending json", jsonText);
  GM.xmlHttpRequest({
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    data: jsonText,
    url: `${api}/generate`,
    onload: req => {
      if(req.status == 200) {
        resolve(JSON.parse(req.responseText).content);
      } else {
        reject(reqEx(req));
      }
    },
    onerror: req => reject(reqEx(req))
  });
});

const updateContent = (content) => {
  const paragraphs = content.split(/\n+/)
  const contentDiv = document.querySelector(".cha-words");
  for(let child of contentDiv.children) {
    child.remove();
  }
//  contentDiv.textContent = content;
  for(let paragraph of paragraphs) {
    let p = document.createElement('p')
    p.textContent = paragraph
    contentDiv.appendChild(p);
  }
  
}

const main = async () => {
  const content = getContent();
  if(!hasNewLine(content)) {
    try {
      console.log("Chapter is one big line. Requesting paragrai.");
      const result = await requestGeneration(content);
      console.log("Updating content.");
      updateContent(result);
    } catch(e) {
      console.log("Failure occured");
    }
  } else {
    console.log("Chapter already has newlines")
  }
}

main()