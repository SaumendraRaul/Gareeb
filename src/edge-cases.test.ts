import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyState, validateState, exportCSV, type Transaction, parseCSV, day, balances, totals } from './model';
const entry=(overrides:Partial<Transaction>={}):Transaction=>({id:'tx',title:'Coffee',kind:'expense',amount:12345,category:'food',account:'bank',date:day(),note:'',tags:'',reviewed:true,...overrides});
afterEach(()=>vi.useRealTimers());
describe('data recovery edge cases',()=>{
 it('can open previously saved records after the device clock moves backwards',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-05T00:30:00'));
  const saved={...emptyState(),transactions:[entry()]};
  expect(validateState(saved)).toBe(saved);
  vi.setSystemTime(new Date('2026-10-04T23:30:00'));
  expect(validateState(JSON.parse(JSON.stringify(saved))).transactions).toHaveLength(1);
 });
 it('still rejects new future-dated CSV entries',()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-05T12:00:00'));expect(()=>parseCSV('date,title,type,amount\n2026-10-06,Coffee,expense,1',emptyState())).toThrow();});
 it('rejects a malformed record without mutating existing data',()=>{const s=emptyState();s.transactions=[entry()];const original=JSON.stringify(s);expect(()=>parseCSV('date,title,type,amount\n2026-02-30,Bad date,expense,1',s)).toThrow();expect(JSON.stringify(s)).toBe(original);});
 it('export neutralises formulas preceded by tabs or spaces',()=>{
  for(const title of ['\t=1+1','   =1+1','\r=1+1','\n=1+1'])expect(exportCSV([entry({title})])).toContain('"\''+title+'"');
 });
 it('CSV keeps Unicode and multiline notes intact',()=>{const t=entry({title:'किताब ☕',note:'One, two\n"Three"'});expect(parseCSV(exportCSV([t]),emptyState())[0]).toMatchObject({title:t.title,note:t.note,amount:t.amount});});
 it('deleting a transfer restores both wallet balances',()=>{const s=emptyState();s.accounts[0].opening=100000;s.transactions=[entry({kind:'transfer',amount:30000,toAccount:'cash'})];expect(balances(s).map(a=>a.balance)).toEqual([70000,30000]);s.transactions=[];expect(balances(s).map(a=>a.balance)).toEqual([100000,0]);expect(totals(s.transactions).net).toBe(0);});
});
