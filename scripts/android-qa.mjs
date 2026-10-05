import { _android as android } from 'playwright';
import { expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const out='work/android-qa';
await mkdir(out,{recursive:true});
const apk=await readFile('work/released.apk');
const previous=await readFile('work/previous.apk').catch(()=>null);
const report={apk:process.env.RELEASE_TAG || 'local',sha256:createHash('sha256').update(apk).digest('hex'),checks:[],errors:[]};
const [device]=await android.devices();
assert.ok(device,'Android emulator must be connected');
device.setDefaultTimeout(45000);
let page;
const pkg='com.gareeb.money';
async function check(name,fn){await fn();report.checks.push(name);console.log('PASS: '+name);await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
async function launch(){await device.shell(`am start -n ${pkg}/.MainActivity`);const view=await device.webView({pkg});page=await view.page();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(e.message));return page;}
async function nav(name){await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('button',{name,exact:true}).click();}
try{
 report.device={model:device.model(),android:(await device.shell('getprop ro.build.version.release')).toString().trim()};
 await check('APK installs and opens the welcome screen',async()=>{await device.installApk(previous || apk);await launch();await expect(page.getByRole('button',{name:'Make yourself at home'})).toBeVisible();await device.screenshot({path:out+'/01-welcome.png'});});
 await check('Fresh setup saves through the native Preferences plugin',async()=>{await page.getByRole('button',{name:'Make yourself at home'}).click();await page.getByLabel('What should we call you?').fill('Android QA');await page.getByLabel('Monthly income plan').fill('50000');await page.getByLabel('Current main account balance').fill('10000');await page.getByRole('button',{name:'Let’s begin'}).click();await expect(page.getByRole('heading',{name:'Hey Android QA'})).toBeVisible();});
 await check('Expense changes real wallet balance by the exact amount',async()=>{await page.getByRole('button',{name:'Add transaction',exact:true}).filter({visible:true}).first().click();await page.getByLabel('Amount',{exact:true}).fill('123.45');await page.getByLabel('What was it for?').fill('Android coffee');await page.getByRole('button',{name:'Save expense'}).click();await expect(page.locator('.balance-card h2')).toHaveText('₹9,876.55');});
 if(previous) await check('APK update preserves saved records without uninstalling',async()=>{await device.shell(`am force-stop ${pkg}`);await device.installApk(apk);await launch();await expect(page.getByRole('heading',{name:'Hey Android QA'})).toBeVisible();await expect(page.getByRole('button',{name:/Android coffee/})).toBeVisible();await expect(page.locator('.balance-card h2')).toHaveText('₹9,876.55');});
 await check('Force-stop and offline relaunch retain the saved expense',async()=>{await device.shell('svc wifi disable');await device.shell('svc data disable');await device.shell(`am force-stop ${pkg}`);await launch();await expect(page.getByRole('heading',{name:'Hey Android QA'})).toBeVisible();await expect(page.getByRole('button',{name:/Android coffee/})).toBeVisible();await expect(page.locator('.balance-card h2')).toHaveText('₹9,876.55');await device.screenshot({path:out+'/02-offline-relaunch.png'});});
 await check('Android back button closes an entry sheet without losing data',async()=>{await page.getByRole('button',{name:'Add transaction',exact:true}).filter({visible:true}).first().click();await expect(page.getByRole('dialog')).toBeVisible();await device.shell('input keyevent 4');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.balance-card h2')).toHaveText('₹9,876.55');});
 await check('All primary pages fit the Android WebView',async()=>{for(const name of ['Activity','Insights','Plan','Wallets','Overview']){await nav(name);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,name+' overflows');}});
 await check('Transfer preserves the total across native wallets',async()=>{await page.getByRole('button',{name:'Add transaction',exact:true}).filter({visible:true}).first().click();await page.getByRole('button',{name:'Transfer',exact:true}).click();await page.getByLabel('Amount',{exact:true}).fill('500');await page.getByLabel('Transfer description').fill('Cash withdrawal');await page.getByRole('button',{name:'Save transfer'}).click();await expect(page.locator('.balance-card h2')).toHaveText('₹9,876.55');});
 await check('Dark mode survives an Android process restart',async()=>{await page.getByRole('button',{name:'Open settings',exact:true}).click();await page.getByRole('button',{name:'Switch to dark'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await device.shell(`am force-stop ${pkg}`);await launch();await expect(page.getByRole('heading',{name:'Hey Android QA'})).toBeVisible();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await device.screenshot({path:out+'/03-dark.png'});});
 await check('Native backup contains the saved transactions and opens Android sharing',async()=>{await page.getByRole('button',{name:'Open settings',exact:true}).click();await page.getByRole('button',{name:'Export full backup'}).click();let files='';await expect.poll(async()=>{files=(await device.shell(`run-as ${pkg} ls cache`)).toString();return files;},{timeout:20000}).toContain('gareeb-backup-');const filename=files.split(/\s+/).find(x=>/^gareeb-backup-.*\.json$/.test(x));assert.ok(filename);const saved=JSON.parse((await device.shell(`run-as ${pkg} cat cache/${filename}`)).toString());assert.equal(saved.transactions.length,2);assert.equal(saved.transactions.find(t=>t.title==='Android coffee').amount,12345);const activity=(await device.shell('dumpsys activity activities')).toString();assert.match(activity,/ChooserActivity|ResolverActivity/);await expect.poll(async()=>(await device.shell('dumpsys window windows')).toString(),{timeout:20000}).toMatch(/mCurrentFocus=.*(?:ChooserActivity|ResolverActivity)/);await device.screenshot({path:out+'/04-share-sheet.png'});await device.shell('input keyevent 4');});
 await check('No uncaught WebView JavaScript errors',async()=>assert.deepEqual(report.errors,[]));
 report.result='passed';
}catch(error){report.result='failed';report.failure=error.stack;console.error(error);try{await device.screenshot({path:out+'/failure.png'});}catch{}process.exitCode=1;}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await writeFile(out+'/logcat.txt',(await device.shell('logcat -d -t 1200')).toString());await device.close();}
