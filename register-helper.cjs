const path = require("node:path");
const { chromium } = require("playwright-core");

const CONFIG = {
  url: process.env.DUT_URL || "https://dangkytinchi.dut.udn.vn/course-sections",
  courseCode: process.env.COURSE_CODE || "1023220",
  sectionCode: process.env.SECTION_CODE || "1023220.2610.24.10",
  userDataDir: process.env.USER_DATA_DIR || path.join(__dirname, ".dut-register-profile"),
  browserChannel: process.env.BROWSER_CHANNEL || undefined,
  executablePath: process.env.BROWSER_PATH || undefined,
  retryDelayMs: Number(process.env.RETRY_DELAY_MS || 1000),
  actionDelayMs: Number(process.env.ACTION_DELAY_MS || 300),
  maxAttempts: Number(process.env.MAX_ATTEMPTS || 0),
};

function findChromiumExecutable() {
  if (CONFIG.executablePath) {
    return CONFIG.executablePath;
  }

  const env = process.env;
  const candidates = [
    path.join(env.LOCALAPPDATA || "", "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    path.join(env.PROGRAMFILES || "", "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    path.join(env["PROGRAMFILES(X86)"] || "", "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    path.join(env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(env["PROGRAMFILES(X86)"] || "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(env.LOCALAPPDATA || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(env.PROGRAMFILES || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(env["PROGRAMFILES(X86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  ];

  const fs = require("node:fs");
  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function now() {
  return new Date().toLocaleString("vi-VN", { hour12: false });
}

function log(message) {
  console.log(`[${now()}] ${message}`);
}

async function waitForManualLoginIfNeeded(page) {
  const loggedInMarker = page.locator(".user-info").or(page.getByText("Đăng xuất")).first();
  try {
    await loggedInMarker.waitFor({ timeout: 5000 });
    return;
  } catch {
    log("Chưa thấy phiên đăng nhập. Hãy đăng nhập thủ công trong cửa sổ browser đang mở.");
    await loggedInMarker.waitFor({ timeout: 0 });
    log("Đã phát hiện phiên đăng nhập, bắt đầu thao tác.");
  }
}

async function waitUntilCoursePageReady(page) {
  await page.goto(CONFIG.url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await waitForManualLoginIfNeeded(page);
  await page.locator("body").waitFor({ timeout: 30000 });
}

function firstNonEmptyRegisteredRow(page) {
  return page.locator("section.registered-courses tbody tr").filter({
    has: page.locator("td:nth-child(2):not(:empty)"),
  }).first();
}

async function getRegisteredStatus(page) {
  const row = firstNonEmptyRegisteredRow(page);
  if ((await row.count()) === 0) {
    return "";
  }

  const cells = row.locator("td");
  const cellCount = await cells.count();
  if (cellCount < 15) {
    return "";
  }

  return (await cells.nth(14).innerText()).trim();
}

async function isAlreadyRegistered(page) {
  const status = await getRegisteredStatus(page);
  return status.includes("Đã đăng ký");
}

async function clickCourseDetail(page) {
  const row = page
    .locator("section")
    .filter({ hasText: "Lớp chọn riêng" })
    .locator("tbody tr")
    .filter({
      has: page.locator("td:nth-child(2)", { hasText: new RegExp(`^\\s*${CONFIG.courseCode}\\s*$`) }),
    })
    .first();

  if ((await row.count()) === 0) {
    return false;
  }

  const detailButton = row.getByRole("button", { name: /^Chi tiết$/ });
  await detailButton.scrollIntoViewIfNeeded();
  await detailButton.click();
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await sleep(CONFIG.actionDelayMs);
  return true;
}

async function clickSectionRegister(page) {
  const row = page
    .locator("section")
    .filter({ hasText: "Lớp chọn riêng" })
    .locator("tbody tr")
    .filter({
      has: page.locator("td:nth-child(2)", { hasText: new RegExp(`^\\s*${CONFIG.sectionCode}\\s*$`) }),
    })
    .first();

  await row.waitFor({ timeout: 15000 });
  const registerButton = row.getByRole("button", { name: /^Đăng ký$/ });
  if ((await registerButton.count()) === 0) {
    return false;
  }

  if (!(await registerButton.isVisible())) {
    return false;
  }

  await registerButton.scrollIntoViewIfNeeded();
  await registerButton.click();
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await sleep(CONFIG.actionDelayMs);
  return true;
}

async function oneAttempt(page, attempt) {
  log(`Lần thử ${attempt}: mở trang đăng ký.`);
  await waitUntilCoursePageReady(page);

  if (await isAlreadyRegistered(page)) {
    log("Bảng đăng ký đã có trạng thái 'Đã đăng ký'. Dừng.");
    return "success";
  }

  const detailFound = await clickCourseDetail(page);
  if (!detailFound) {
    log(`Không thấy học phần ${CONFIG.courseCode} ở bảng chọn riêng. Theo workflow, coi như đã đăng ký thành công. Dừng.`);
    return "success";
  }

  log(`Đã bấm Chi tiết cho học phần ${CONFIG.courseCode}.`);
  const registerClicked = await clickSectionRegister(page);
  if (!registerClicked) {
    log(`Không thấy nút Đăng ký cho lớp ${CONFIG.sectionCode} (có thể lớp đã full). Sẽ thử lại ở lần kế tiếp.`);
    return "retry";
  }

  log(`Đã bấm Đăng ký cho lớp ${CONFIG.sectionCode}.`);

  await page.waitForTimeout(CONFIG.actionDelayMs);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

  const status = await getRegisteredStatus(page);
  log(`Trạng thái hiện tại: ${status || "(chưa có dòng đăng ký)"}`);
  return status.includes("Đã đăng ký") ? "success" : "retry";
}

async function main() {
  const launchOptions = {
    headless: false,
    viewport: { width: 1600, height: 900 },
  };

  const executablePath = findChromiumExecutable();
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  } else {
    launchOptions.channel = CONFIG.browserChannel;
  }

  const context = await chromium.launchPersistentContext(CONFIG.userDataDir, launchOptions);
  const page = context.pages()[0] || (await context.newPage());
  page.setDefaultTimeout(30000);
  page.on("dialog", async (dialog) => {
    log(`Trình duyệt hiện hộp thoại: ${dialog.message()}`);
    await dialog.accept();
  });

  log(`Target học phần: ${CONFIG.courseCode}`);
  log(`Target lớp học phần: ${CONFIG.sectionCode}`);
  log(`Delay giữa các lần thử: ${CONFIG.retryDelayMs} ms`);

  let attempt = 1;
  while (CONFIG.maxAttempts === 0 || attempt <= CONFIG.maxAttempts) {
    try {
      const result = await oneAttempt(page, attempt);
      if (result === "success") {
        await context.close();
        process.exit(0);
      }
    } catch (error) {
      log(`Lỗi ở lần thử ${attempt}: ${error.message}`);
    }

    attempt += 1;
    log(`Chờ ${CONFIG.retryDelayMs} ms rồi thử lại. Nhấn Ctrl+C để dừng thủ công.`);
    await sleep(CONFIG.retryDelayMs);
  }

  log(`Đã đạt MAX_ATTEMPTS=${CONFIG.maxAttempts}, dừng.`);
  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
