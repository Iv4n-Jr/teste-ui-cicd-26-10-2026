const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const SITE_URL = 'http://localhost:8000';
const ARTIFACTS_DIR = path.join(__dirname, 'artifacts');

function ensureArtifactsDir() {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

function appendLog(testName, status, detail) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(
    path.join(ARTIFACTS_DIR, 'testes.log'),
    `${timestamp} | ${testName} | ${status} | ${detail}\n`
  );
}

async function saveScreenshot(driver, label, status) {
  const screenshot = await driver.takeScreenshot();
  const fileName = `${label}-${status}.png`;
  fs.writeFileSync(path.join(ARTIFACTS_DIR, fileName), screenshot, 'base64');
}

function buildDriver() {
  const options = new chrome.Options();
  options.addArguments('--headless=new');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--window-size=1920,1080');
  options.addArguments(`--user-data-dir=/tmp/chrome-${Date.now()}`);

  return new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();
}

async function runTest(testName, testFn) {
  ensureArtifactsDir();
  let driver;

  try {
    driver = buildDriver();
    await driver.get(SITE_URL);
    await saveScreenshot(driver, testName, 'inicio');

    await testFn(driver);

    await saveScreenshot(driver, testName, 'ok');
    appendLog(testName, 'OK', 'Teste executado com sucesso');
    console.log(`OK: ${testName}`);
  } catch (error) {
    if (driver) {
      try {
        await saveScreenshot(driver, testName, 'erro');
      } catch (screenshotErr) {
        console.error('Falha ao capturar screenshot:', screenshotErr);
      }
    }

    appendLog(testName, 'ERRO', error.message);
    console.error(`ERRO: ${testName}`);
    console.error(error.message);
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
}

(async function testeInterfaceLocal() {
  console.log('Abrindo site local...');

  await runTest('visibilidade_status', async function (driver) {
    const titulo = await driver.getTitle();
    console.log('Título:', titulo);
    expect(titulo).to.include('Portal Acadêmico');

    const campoBusca = await driver.findElement(By.id('campoBusca'));
    await campoBusca.sendKeys('Administração');

    const botaoBusca = await driver.findElement(By.id('btnBusca'));
    await botaoBusca.click();

    await driver.wait(until.elementLocated(By.id('resultadoBusca')), 5000);
    const textoBusca = await driver.findElement(By.id('textoBusca')).getText();
    console.log('Resultado da busca:', textoBusca);
    expect(textoBusca).to.include('Administração');
  });

  await runTest('prevencao_erros', async function (driver) {
    const form = await driver.findElement(By.id('formContato'));
    await form.submit();

    const mensagem = await driver.wait(until.elementLocated(By.id('mensagem')), 5000);
    const textoMensagem = await mensagem.getText();
    console.log('Mensagem:', textoMensagem);
    expect(textoMensagem).to.include('Preencha nome e e-mail');
  });

  await runTest('consistencia_padroes', async function (driver) {
    const nav = await driver.findElement(By.css('nav'));
    const visivel = await nav.isDisplayed();
    console.log('Menu visível?', visivel);
    expect(visivel).to.be.true;

    const links = await driver.findElements(By.css('.menu a'));
    console.log('Quantidade de links do menu:', links.length);
    expect(links.length).to.be.greaterThan(3);

    const botoes = await driver.findElements(By.css('button'));
    console.log('Quantidade de botões:', botoes.length);
    expect(botoes.length).to.be.greaterThan(1);
  });

  console.log('Arquivos salvos em:', ARTIFACTS_DIR);
})();