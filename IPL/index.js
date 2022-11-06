//node index.js --root="World Cup 2019" --excel="alx.csv" --dest="data.html" --url="https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results"
let minimist = require("minimist");
let axios = require("axios");
let args = minimist(process.argv);
let path = require("path");
let jsdom = require("jsdom");
let fs = require("fs");
let excel = require("excel4node");
let pdf = require("pdf-lib");
const { verify } = require("crypto");
const { setgid } = require("process");

//download from web
//here we use axios node  module
let downloadKaPromise = axios.get(args.url);
downloadKaPromise.then(function (response) {
  let html = response.data;
  fs.writeFileSync(args.dest, html, "utf-8");
  // ab bnayenge HTML file DOM using jsdom node module
  let dom = new jsdom.JSDOM(fs.readFileSync(args.dest, "utf-8"));
  let document = dom.window.document;
  let matchDivs = document.querySelectorAll("div.match-score-block");
  let matchDivsDetails = [];
  for (let i = 0; i < matchDivs.length; i++) {
    let match = {};
    //getting team names
    let teamParas = matchDivs[i].querySelectorAll("p.name");
    match.t1 = teamParas[0].textContent;
    match.t2 = teamParas[1].textContent;

    //getting team scores
    let teamScores = matchDivs[i].querySelectorAll("span.score");
    if (teamScores.length == 2) {
      match.t1s = teamScores[0].textContent;
      match.t2s = teamScores[1].textContent;
    } else {
      if (teamScores.length == 1) {
        match.t1s = teamScores[0].textContent;
        match.t2s = "";
      } else {
        match.t1s = "";
        match.t2s = "";
      }
    }
    //getting result
    let resultSpan = matchDivs[i].querySelector("div.status-text > span");
    match.result = resultSpan.textContent;

    matchDivsDetails.push(match);
  }
  //getting team objects
  let teams = [];
  for (let i = 0; i < matchDivsDetails.length; i++) {
    gettingTeamObjects(matchDivsDetails[i], teams);
  }

  for (let i = 0; i < matchDivsDetails.length; i++) {
    puttingMatchAtAppropriatePosition(matchDivsDetails[i], teams);
  }
  //   fs.writeFileSync("TeamJSON.json", JSON.stringify(teams), "utf-8");
  createExcelFile(teams);
  createPDFs(teams);
});

function gettingTeamObjects(match, teams) {
  let t1 = match.t1;
  let t2 = match.t2;

  let isFound1 = false;
  for (let i = 0; i < teams.length; i++) {
    if (teams[i].name == t1) {
      isFound1 = true;
      break;
    }
  }
  if (isFound1 == false) {
    teams.push({
      name: t1,
      matches: [],
    });
  }

  let isFound2 = false;
  for (let i = 0; i < teams.length; i++) {
    if (teams[i].name == t2) {
      isFound2 = true;
      break;
    }
  }
  if (isFound2 == false) {
    teams.push({
      name: t2,
      matches: [],
    });
  }
}
function puttingMatchAtAppropriatePosition(match, teams) {
  let t1 = match.t1;
  let t2 = match.t2;

  let t1s = match.t1s;
  let t2s = match.t2s;
  let res = match.result;

  let t1idx = -1;
  for (let i = 0; i < teams.length; i++) {
    if (teams[i].name == t1) {
      t1idx = i;
      break;
    }
  }

  teams[t1idx].matches.push({
    vs: t2,
    selfScore: t1s,
    oppScore: t2s,
    result: res,
  });

  let t2idx = -1;
  for (let i = 0; i < teams.length; i++) {
    if (teams[i].name == t2) {
      t2idx = i;
      break;
    }
  }

  teams[t2idx].matches.push({
    vs: t1,
    selfScore: t2s,
    oppScore: t1s,
    result: res,
  });
}
function createExcelFile(teams) {
  let wb = new excel.Workbook();
  for (let i = 0; i < teams.length; i++) {
    let sheet = wb.addWorksheet(teams[i].name);
    sheet.cell(1, 1).string("Team");
    sheet.cell(1, 2).string("Opponent Team");

    sheet.cell(1, 4).string("Self Score");
    sheet.cell(1, 5).string("Opponent Score");

    sheet.cell(1, 8).string("Result");
    for (let j = 0; j < teams[i].matches.length; j++) {
      sheet.cell(2 + j, 2).string(teams[i].matches[j].vs);

      sheet.cell(2 + j, 4).string(teams[i].matches[j].selfScore);
      sheet.cell(2 + j, 5).string(teams[i].matches[j].oppScore);

      sheet.cell(2 + j, 8).string(teams[i].matches[j].result);
    }
  }
  wb.write(args.excel);
}
function createPDFs(teams) {
  if (fs.existsSync(args.root) == false) {
    fs.mkdirSync(args.root);
  }
  for (let i = 0; i < teams.length; i++) {
    let teamFolderName = path.join(args.root, teams[i].name);
    fs.mkdirSync(teamFolderName);
    for (let j = 0; j < teams[i].matches.length; j++) {
      let pdfPath = path.join(teamFolderName, teams[i].matches[j].vs + ".pdf");
      if (fs.existsSync(pdfPath) == true) {
        pdfPath = path.join(teamFolderName, teams[i].matches[j].vs + "1.pdf");
      }
      createScoreCard(teams[i].name, teams[i].matches[j], pdfPath);
    }
  }
}
function createScoreCard(teamName, match, pdfPath) {
  let t1 = teamName;
  let t2 = match.vs;
  let t1s = match.selfScore;
  let t2s = match.oppScore;

  let result = match.result;
  //getting the bytes of the template file
  let templateBytes = fs.readFileSync("update2.pdf");

  //load the template bytes
  let loadKaPromise = pdf.PDFDocument.load(templateBytes);

  loadKaPromise.then(function (pdfdoc) {
    let firstPage = pdfdoc.getPage(0);
    //writing team1 name
    firstPage.drawText(t1, {
      x: 10,
      y: 626,
      size: 18,
    });
    //writing team2 name
    firstPage.drawText(t2, {
      x: 135,
      y: 626,
      size: 18,
    });

    //writing t1 score
    firstPage.drawText(t1s, {
      x: 300,
      y: 626,
      size: 18,
    });

    //writing t2 score
    firstPage.drawText(t2s, {
      x: 460,
      y: 626,
      size: 18,
    });

    //result
    //writing result name
    firstPage.drawText(result, {
      x: 160,
      y: 530,
      size: 17,
    });
    //match-info
    let saveKaPromise = pdfdoc.save();
    saveKaPromise.then(function (changedBytes) {
      fs.writeFileSync(pdfPath + ".pdf", changedBytes);
    });
  });
}
