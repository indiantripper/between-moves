import test from 'node:test';
import assert from 'node:assert/strict';
import {themePreference,resolveTheme} from '../src/theme.js';
test('new or invalid preferences follow the system in either colour scheme',()=>{
 for(const choice of [undefined,null,'system','invalid']){assert.equal(themePreference(choice),'system');assert.equal(resolveTheme(choice,true),'dark');assert.equal(resolveTheme(choice,false),'light');}
});
test('explicit light or dark choices override system appearance',()=>{
 for(const system of [true,false]){assert.equal(resolveTheme('light',system),'light');assert.equal(resolveTheme('dark',system),'dark');}
});
