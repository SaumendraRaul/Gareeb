import { expect, test, type Page } from '@playwright/test';
async function demo(page:Page){await page.goto('/');await page.getByRole('button',{name:'Take a look around with demo data'}).click();await expect(page.getByRole('heading',{name:'Hey friend'})).toBeVisible();}
async function add(page:Page){await page.getByRole('button',{name:'Add transaction',exact:true}).filter({visible:true}).first().click();}
test('failed storage write preserves existing saved data and leaves the form open',async({page})=>{
 await demo(page);const original=await page.locator('.balance-card h2').innerText();await add(page);await page.getByLabel('Amount',{exact:true}).fill('123');await page.getByLabel('What was it for?').fill('Must not be saved');
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Storage is full','QuotaExceededError');};});
 await page.getByRole('button',{name:'Save expense'}).click();await expect(page.getByRole('status')).toContainText('Could not save');await expect(page.getByRole('dialog')).toBeVisible();await page.reload();await expect(page.locator('.balance-card h2')).toHaveText(original);await expect(page.getByRole('button',{name:/Must not be saved/})).toHaveCount(0);
});
test('negative amounts and transfers to the same wallet cannot be saved',async({page})=>{
 await demo(page);await add(page);await page.getByLabel('Amount',{exact:true}).fill('-1');await page.getByLabel('What was it for?').fill('Invalid');await page.getByRole('button',{name:'Save expense'}).click();await expect(page.getByRole('dialog')).toBeVisible();expect(await page.getByLabel('Amount',{exact:true}).evaluate((input:HTMLInputElement)=>input.validity.valid)).toBe(false);
 await page.getByRole('button',{name:'Transfer',exact:true}).click();await page.getByLabel('Amount',{exact:true}).fill('50');await page.getByLabel('To wallet').selectOption('bank');await page.getByRole('button',{name:'Save transfer'}).click();await expect(page.getByRole('alert')).toContainText('two different wallets');
});
test('320px screens and landscape dialogs do not overflow',async({page})=>{
 await page.setViewportSize({width:320,height:700});await demo(page);for(const name of ['Activity','Insights','Plan','Wallets','Overview']){await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('button',{name,exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await add(page);await page.setViewportSize({width:844,height:390});await expect(page.getByRole('button',{name:'Save expense'})).toBeAttached();await page.getByRole('button',{name:'Save expense'}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Save expense'})).toBeVisible();expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});
test('a used wallet cannot be deleted and its transactions stay intact',async({page})=>{
 await demo(page);const navigation=page.getByRole('navigation',{name:await page.locator('.bottom-nav').isVisible()?'Mobile navigation':'Main navigation'});await navigation.getByRole('button',{name:'Wallets',exact:true}).click();await page.getByRole('button',{name:'Edit Everyday account',exact:true}).click();await page.getByRole('button',{name:'Delete',exact:true}).click();await expect(page.getByRole('status')).toContainText('cannot be deleted');await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('heading',{name:'Everyday account',exact:true})).toBeVisible();
});
