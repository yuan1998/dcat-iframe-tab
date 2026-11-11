'use strict';

/*
 * tab-hash.js 的无浏览器逻辑测试（仅需 node，无第三方依赖）
 *   node tests/tab-hash.node.js [被测 JS 路径]
 *
 * 模拟 iframe-tab 父窗口：jQuery 链式对象、window.iframeTabParent、location/history。
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const target = process.argv[2] || path.join(__dirname, '../src/assets/js/tab-hash.js');
const code = fs.readFileSync(target, 'utf8');

function chain(o) {
    o = o || {};
    const el = {
        length: o.length === undefined ? 1 : o.length,
        attrs: o.attrs || {},
        attr(name) { return this.attrs[name]; },
        find(sel) { return o.onFind ? o.onFind(sel) : chain({ length: 0 }); },
        first() { return el; },
        click() { if (o.onClick) o.onClick(); return el; },
        addClass() { return el; },
        removeClass() { return el; },
        append() { if (o.onAppend) o.onAppend(); return el; },
        parents() { return el; },
        index() { return 0; },
        on() { return el; },
    };
    return el;
}

function createEnv(initialHash, opts) {
    opts = opts || {};
    const state = { activeSrc: opts.initialSrc || '/admin' };
    const log = { replaceState: [], menuClicks: 0, tabClicks: 0, appendSlide: 0, appendPane: 0 };
    const handlers = {};
    const activeHref = '#iframe-active';

    const location = {
        href: 'https://clue-parse.app.test/admin',
        origin: 'https://clue-parse.app.test',
        pathname: '/admin',
        search: '',
        hash: initialHash || '',
    };

    function menuMatch(selector) {
        return (opts.menuUrls || []).some(function (u) {
            return selector.indexOf('"' + u + '"') !== -1;
        });
    }

    function $(arg) {
        if (typeof arg === 'function') { arg(); return undefined; }   // DOM ready
        if (arg && arg.__isDocument) {
            return { on(ev, sel, fn) { handlers['click|' + sel] = fn; } };
        }
        if (arg && arg.__isWindow) {
            return { on(ev, fn) { handlers[ev] = fn; } };
        }
        if (arg === activeHref) {
            return chain({
                onFind(sel) {
                    return sel === '> iframe'
                        ? chain({ attrs: { src: state.activeSrc } })
                        : chain({ length: 0 });
                },
            });
        }
        if (typeof arg === 'string' && arg.indexOf('.main-menu a[href=') === 0) {
            const matched = menuMatch(arg);
            return chain({
                length: matched ? 1 : 0,
                onClick() {
                    log.menuClicks++;
                    if (matched) state.activeSrc = opts.targetUrl;
                },
            });
        }
        if (typeof arg === 'string' && arg.indexOf('#iframe-home-') === 0) {
            return chain({ length: 0, onClick() { log.tabClicks++; } });
        }
        return chain({ length: 1 });
    }

    const win = {
        __isWindow: true,
        location: location,
        history: {
            replaceState(a, b, url) {
                log.replaceState.push(url);
                const m = String(url).match(/#.*$/);
                location.hash = m ? m[0] : '';
            },
        },
        iframeTabParent: {
            swiper: {
                appendSlide() { log.appendSlide++; },
                slideTo() {},
                updateSlides() {},
            },
            iframeTabTemplate: {
                tabItem() { return '<tab></tab>'; },
                tabContentItem(url) { state.activeSrc = url; return '<pane></pane>'; },
            },
            iframeTab: {
                generateID(url) { return 'id_' + url; },
                removeTabBarStyle() {},
                cacheUpdateTabBar() {},
            },
            elements: {
                iframe_tab: {
                    find(sel) {
                        return sel === '.nav-link.active'
                            ? chain({ attrs: { href: activeHref } })
                            : chain({ length: 0 });
                    },
                },
                iframe_tabContent: { append() { log.appendPane++; } },
            },
        },
    };

    const sandbox = {
        window: win,
        document: { __isDocument: true },
        URL: URL,
        encodeURI: encodeURI,
        decodeURI: decodeURI,
        setTimeout(fn) { fn(); },
        console: console,
        $: $,
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);

    return { location, log, handlers, state };
}

let failures = 0;
function check(name, condition, detail) {
    if (condition) {
        console.log('ok  -', name);
    } else {
        failures++;
        console.log('FAIL-', name, detail === undefined ? '' : JSON.stringify(detail));
    }
}

/* 1. 首次进入：把首页标签路由写入 hash */
let env = createEnv('');
check('首次进入写入 #/admin', env.location.hash === '#/admin', env.location.hash);

/* 2. 刷新恢复：hash 指向菜单路由时交给菜单点击创建标签 */
env = createEnv('#/admin/users', { targetUrl: '/admin/users', menuUrls: ['/admin/users'] });
check('刷新恢复触发菜单点击', env.log.menuClicks === 1, env.log);
check('恢复后 hash 保持目标路由', env.location.hash === '#/admin/users', env.location.hash);

/* 3. 无菜单项的深层路由：直接构造标签页 */
env = createEnv('#/admin/users/1/edit', { targetUrl: '/admin/users/1/edit', menuUrls: [] });
check('深层路由构造标签', env.log.appendSlide === 1 && env.log.appendPane === 1, env.log);
check('深层路由 hash 正确', env.location.hash === '#/admin/users/1/edit', env.location.hash);

/* 4. 恶意 hash 被拒绝 */
['javascript:alert(1)', 'https://evil.example/x', '//evil.example/x', '/admin/auth/logout'].forEach(function (raw) {
    const e = createEnv('#' + encodeURI(raw));
    check('拒绝 ' + raw, e.log.menuClicks === 0 && e.log.appendSlide === 0 && e.location.hash === '#/admin', e.log);
});

/* 5. 菜单点击委托：切换标签后同步 hash */
env = createEnv('', { targetUrl: '/admin/settings' });
env.state.activeSrc = '/admin/settings';
Object.keys(env.handlers).forEach(function (key) {
    if (key.indexOf('click|.main-menu') === 0) env.handlers[key]();
});
check('菜单点击后 hash 同步', env.location.hash === '#/admin/settings', env.location.hash);

/* 6. hashchange：手动改 hash 后打开对应标签 */
env = createEnv('', { targetUrl: '/admin/orders', menuUrls: ['/admin/orders'] });
env.location.hash = '#/admin/orders';
if (env.handlers.hashchange) env.handlers.hashchange();
check('hashchange 打开标签', env.log.menuClicks === 1, env.log);

if (failures) {
    console.error('\n' + failures + ' check(s) failed for ' + target);
    process.exit(1);
}
console.log('\nall checks passed for ' + target);
