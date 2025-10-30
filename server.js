const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const puppeteer = require("puppeteer");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let wsClients = [];
wss.on("connection", (ws) => {
  wsClients.push(ws);
  ws.on("close", () => {
    wsClients = wsClients.filter((client) => client !== ws);
  });
});

async function openPageAndToUrl(url) {
  try {
    console.log(`准备打开 ${url}`);
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920,1080",
      ],
    });
    const page = await browser.newPage();
    await page.setUserAgent({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    });
    await page.goto(url, { waitUntil: "networkidle2" });
    return { browser, page };
  } catch {
    console.log(`创建页面失败，重新创建 ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return await openPageAndToUrl(url);
  }
}

async function b402scanAi() {
  const url = "https://www.b402scan.ai/";
  const { page } = await openPageAndToUrl(url);
  while (true) {
    try {
      if (wsClients.length) {
        await page.reload({ waitUntil: "networkidle2" });
        console.log(`${url} 页面加载完成，开始抓取内容`);
        await page.waitForSelector("header");

        const b402scanAi = await page.$eval("div.fixed", (el) => el.innerText);
        console.log(b402scanAi);
        wsClients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ b402scanAi }));
          }
        });
      }
    } catch (err) {
      console.error("抓取失败:", url, err);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  // browser.close(); // 永远不会到达这里，因为无限循环
}

async function startScraping() {
  try {
    await Promise.all([b402scanAi()]);
  } catch { }
}

app.get("/", (req, res) => {
  res.send("Express + WS 服务已启动");
});

server.listen(3000, () => {
  console.log("Express 服务已启动，端口 3000");
  startScraping();
});
