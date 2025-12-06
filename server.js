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

async function dyorswap() {
  const url = "https://dyorswap.org/home/?chainId=143";
  const { page } = await openPageAndToUrl(url);
  while (true) {
    try {
      if (wsClients.length) {
        await page.reload({ waitUntil: "networkidle2" });
        console.log(`${url} 页面加载完成，开始抓取内容`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await page.waitForSelector(".ant-progress-bg.ant-progress-bg-outer");

        await new Promise((resolve) => setTimeout(resolve, 1000));
        const dyorswap = await page.$eval(".ant-progress-bg.ant-progress-bg-outer", (el) => el.style.width);
        console.log(dyorswap);
        wsClients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ dyorswap }));
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


async function fourMemePage() {
  const url = "https://four.meme/zh-TW/create-token?entry=fair-mode";
  const { page } = await openPageAndToUrl(url);
  while (true) {
    try {
      if (wsClients.length) {
        await page.reload({ waitUntil: "networkidle2" });
        console.log(`${url} 页面加载完成，开始抓取内容`);
        await page.waitForSelector('button[id*="headlessui-listbox-button"]');
        const menuText = await page.$eval("header nav", (el) => el.innerText);
        page.removeExposedFunction("onMutation").catch(() => { });
        // 暴露一个 Node 端函数，让页面内的 observer 能调用
        await page.exposeFunction("onMutation", (texts) => {
          const tokens = texts.join(', ').split('\n')
          const menus = menuText.split('\n')
          console.log('新增内容:', tokens);
          console.log('菜单:', menus);
          // 通过 ws 发送数据到所有客户端
          wsClients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ fourMeme: `Menus: ${menus.join(', ')}\nTokens: ${tokens.join(', ')}` }));
            }
          });
        });

        // 在页面上下文中注册 MutationObserver
        await page.evaluate(() => {
          const observer = new MutationObserver((mutations) => {
            const added = new Set();
            for (const m of mutations) {
              m.addedNodes.forEach((n) => {
                if (n.nodeType === 1) {
                  added.add(n.innerText);
                }
              });
            }
            // 将 Set 转换为数组再传递
            if (added.size) window.onMutation(Array.from(added));
          });
          observer.observe(document.body, { childList: true, subtree: true });
        });

        const handles = await page.$$(
          'button[id*="headlessui-listbox-button"]'
        );
        // 模拟鼠标移入
        await Promise.all([
          handles[0].hover(),
          handles[0].click(),
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);
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
    await Promise.all([fourMemePage()]);
  } catch { }
}

app.get("/", (req, res) => {
  res.send("Express + WS 服务已启动");
});

server.listen(3000, () => {
  console.log("Express 服务已启动，端口 3000");
  startScraping();
});
