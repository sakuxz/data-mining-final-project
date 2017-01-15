var nodejieba = require("nodejieba");
var request = require('superagent');
var fs = require('fs');


// 設定繁體中文字典
nodejieba.load({
  userDict: './dict.txt.big',
});

// 設定最多爬的文章數量門檻
const needPostNum = 500;
let getPostCount = 0;
let posts = [];

function getSexPostDetail(id) {
  return new Promise(function(resolve, reject) {
    request
    .get(`https://www.dcard.tw/_api/posts/${id}`)
    .end(function(err, res){
      if (err) resolve({
        title: '',
        content: '',
      });
      resolve(JSON.parse(res.text));
    });
  });
}

// 爬 Dcard 寵物板文章
function getSexPost(before, callback) {
  request
  .get('https://www.dcard.tw/_api/forums/pet/posts')
  .query({ popular: true, before: before })
  .end(function(err, res){
    let t = JSON.parse(res.text);
    if (t.length === 0) {
      callback();
      return;
    }
    // posts = posts.concat(t);
    // getPostCount += t.length;
    let results = t.map((item) => {
      return getSexPostDetail(item.id);
    });
    Promise.all(results).then((items) => {
      posts = posts.concat(items);
      getPostCount += items.length;
      if (getPostCount < needPostNum) getSexPost(t[t.length-1].id, callback);
    });
  });
}


// const ignoreTag = ['x','r','c','f','d','zg','ul','p','ug'];
const ignoreWord = ['著','是', '會', '有', '要', '到', '看', '去', '想', '沒有'];
let processedNData = [];
let processedVData = [];
let processedAData = [];

function getFraquentWord(data, minFraquent) {
  let t = {};
  let result = [];
  data.forEach((e) => {
    e.forEach((ee) => {
      if(!t[ee]) t[ee] = 1
      else t[ee]++
    })
  });
  for (let key in t) {
    if (t[key] >= minFraquent) {
      result.push(key);
    }
  }
  return result;
}

function getFraquentWordPlus(data, minFraquent) {
  let t = {};
  let result = [];
  data.forEach((e) => {
    e.forEach((ee) => {
      if(!t[ee]) t[ee] = 1
      else t[ee]++
    })
  });
  for (let key in t) {
    if (t[key] >= minFraquent) {
      result.push({
        word: key,
        count: t[key],
      });
    }
  }
  return result;
}

function storeInArff(fileName, fields, data) {
  fs.writeFileSync(fileName, `@relation dcard_pet\n`);
  fields.forEach((item) => {
    fs.appendFileSync(fileName, `@attribute '${item}' { t}\n`);
  });
  fs.appendFileSync(fileName, `@data\n`);
  data.forEach((item) => {
    let t = '';
    fields.forEach((e) => {
      if(item.indexOf(e) > -1) {
        t += 't';
      } else {
        t += '?';
      }
    });
    t = t.split('').join(',');
    fs.appendFileSync(fileName, `${t}\n`);
  });
}


// 開始爬資料
getSexPost(undefined, function () {
  posts.forEach(function (e, i){
    let result = nodejieba.tag(e.content + ' ' + e.title);
    let v = [];
    let n = [];
    let a = [];
    result.forEach((item) => {
      // if (ignoreTag.indexOf(item.tag) === -1) {
      //   n.push(item.word);
      // }
      if (item.tag.indexOf('n') > -1 && item.tag.indexOf('eng') === -1 && ignoreWord.indexOf(item.word) === -1) {
        n.push(item.word);
      } else if (item.tag.indexOf('v') > -1 && ignoreWord.indexOf(item.word) === -1) {
        v.push(item.word);
      } else if (item.tag.indexOf('a') > -1 && ignoreWord.indexOf(item.word) === -1) {
        a.push(item.word);
      }
    });
    processedVData.push(v);
    processedNData.push(n);
    processedAData.push(a);
  });
  const vFraquentWord = getFraquentWord(processedVData, 4);
  const nFraquentWord = getFraquentWord(processedNData, 4);

  // 將資料存進 js 以供 html 顯示
  fs.writeFileSync('n.js', `var n = ${JSON.stringify(getFraquentWordPlus(processedNData, 3))};`);
  fs.writeFileSync('v.js', `var v = ${JSON.stringify(getFraquentWordPlus(processedVData, 3))};`);
  fs.writeFileSync('a.js', `var a = ${JSON.stringify(getFraquentWordPlus(processedAData, 2))};`);

  processedNData = processedNData.map((e) => {
    return e.filter((item) => {
      if (nFraquentWord.indexOf(item) > -1) return true;
      else return false;
    })
  });
  processedNData = processedNData.filter((e) => {
    if (e.length > 0) return true;
    else return false;
  });
  storeInArff('pet.arff', nFraquentWord, processedNData)
});
