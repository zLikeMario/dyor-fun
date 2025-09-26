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

async function startScraping() {
  console.log("启动浏览器");
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

  console.log("准备打开页面");
  const page = await browser.newPage();
  await page.setUserAgent({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  });

  const url = "https://dyorswap.org/home";

  console.log("等待页面加载完成...");
  await page.goto(url, { waitUntil: "networkidle2" });
  while (true) {
    try {
      await page.reload({ waitUntil: "networkidle2" });
      await page.waitForSelector('div[data-popper-placement="bottom"]');
      console.log("获取元素");
      const chainNames = await page.$$eval(
        'div[data-popper-placement="bottom"] button div[color="text"], div[data-popper-placement="bottom"] button div[color="secondary"]',
        (els) => els.map((el) => el.innerHTML.trim()).filter(Boolean)
      );
      console.log("抓取到的数据:", chainNames);
      // 通过 ws 发送数据到所有客户端
      wsClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ chainNames }));
        }
      });
    } catch (err) {
      console.error("抓取失败:", err);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  // browser.close(); // 永远不会到达这里，因为无限循环
}

app.get("/", (req, res) => {
  res.send("Express + WS 服务已启动");
});

server.listen(3000, () => {
  console.log("Express 服务已启动，端口 3000");
  startScraping();
});
