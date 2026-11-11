'use strict';

/*
 * tab-hash.js 的无浏览器逻辑测试（仅需 node，无第三方依赖）
 *   node tests/tab-hash.node.js [被测 JS 路径]
 *
 * 模拟 iframe-tab 父窗口：jQuery 链式对象、window.iframeTabParent、
 * location/history、sessionStorage 与侧边栏菜单链接。
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
        text() { return o.text || ''; },
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
    const log = {
        replaceState: [], menuClicks: 0, tabClicks: 0,
        appendSlide: 0, appendPane: 0, tabTitles: [],
    };
    const handlers = {};
    const activeHref = '#iframe-active';
    const storage = Object.assign({}, opts.storage || {});
    const menuLinks = (opts.menuLinks || []).map(function (href) {
        return { getAttribute: function () { return href; } };
    });

    const location = {
        href: 'https://clue-parse.app.test/admin',
        origin: 'https://clue-parse.app.test',
        pathname: '/admin',
        search: '',
        hash: initialHash || '',
    };

    function $(arg) {
        if (arg === undefined) return chain({ length: 0 });
        if (typeof arg === 'function') { arg(); return undefined; }   // DOM ready
        if (arg && arg.__isDocument) {
            return { on(ev, sel, fn) { handlers['click|' + sel] = fn; } };
        }
        if (arg && arg.__isWindow) {
            return { on(ev, fn) { handlers[ev] = fn; } };
        }
        if (arg && arg.getAttribute) {                               // 菜单 <a> 元素
            const href = arg.getAttribute('href');
            return chain({
                attrs: { href: href },
                onClick() {
                    log.menuClicks++;
                    state.activeSrc = href;
                },
            });
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
        sessionStorage: {
            getItem(k) { return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
            setItem(k, v) { storage[k] = String(v); },
        },
        iframeTabParent: {
            swiper: {
                appendSlide() { log.appendSlide++; },
                slideTo() {},
                updateSlides() {},
            },
            iframeTabTemplate: {
                tabItem(title) { log.tabTitles.push(title); return '<tab></tab>'; },
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
                            ? chain({ attrs: { href: activeHref }, text: opts.activeTitle || '' })
                            : chain({ length: 0 });
                    },
                },
                iframe_tabContent: { append() { log.appendPane++; } },
            },
        },
    };

    const sandbox = {
        window: win,
        document: {
            __isDocument: true,
            querySelectorAll() { return menuLinks; },
        },
        URL: URL,
        encodeURI: encodeURI,
        decodeURI: decodeURI,
        setTimeout(fn) { fn(); },
        console: console,
        $: $,
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);

    return { location, log, handlers, state, storage };
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

/* 1. 首次进入：写 hash 并缓存标签标题 */
let env = createEnv('', { activeTitle: '首页' });
check('首次进入写入 #/admin', env.location.hash === '#/admin', env.location.hash);
check('首次进入缓存标题', env.storage['dcat-iframe-tab-title:/admin'] === '首页', env.storage);

/* 2. 刷新恢复：菜单里存在该路由时交给 base.js 创建 */
env = createEnv('#/admin/users', { targetUrl: '/admin/users', menuLinks: ['/admin/users'] });
check('刷新恢复触发菜单点击', env.log.menuClicks === 1, env.log);
check('恢复后 hash 保持目标路由', env.location.hash === '#/admin/users', env.location.hash);

/* 3. 菜单 href 是绝对地址也能归一化匹配 */
env = createEnv('#/admin/users', {
    menuLinks: ['https://clue-parse.app.test/admin/users'],
});
check('绝对地址菜单可匹配', env.log.menuClicks === 1, env.log);

/* 4. 菜单 href 带 query 差异时退化到路径匹配 */
env = createEnv('#/admin/users?tab=1', { menuLinks: ['/admin/users'] });
check('query 差异仍可匹配', env.log.menuClicks === 1, env.log);

/* 5. 用户反馈场景：无菜单项的页面，刷新后标题不能变成 URL slug */
const firstVisit = createEnv('', {
    initialSrc: '/admin/auth/advertiser_users',
    activeTitle: '广告主账号',
});
check('首次访问写入该页面 hash', firstVisit.location.hash === '#/admin/auth/advertiser_users', firstVisit.location.hash);
env = createEnv('#/admin/auth/advertiser_users', {
    storage: firstVisit.storage,
    menuLinks: [],
});
check('无菜单项时构造标签', env.log.appendSlide === 1 && env.log.appendPane === 1, env.log);
check('刷新后标题仍是「广告主账号」', env.log.tabTitles[0] === '广告主账号', env.log.tabTitles);

/* 6. 跨会话复制 hash（无缓存）时兜底为 URL，不崩溃 */
env = createEnv('#/admin/detail/9', { menuLinks: [], storage: {} });
check('无缓存时兜底标题为 URL', env.log.tabTitles[0] === '/admin/detail/9', env.log.tabTitles);

/* 7. 恶意 hash 被拒绝 */
['javascript:alert(1)', 'https://evil.example/x', '//evil.example/x', '/admin/auth/logout'].forEach(function (raw) {
    const e = createEnv('#' + encodeURI(raw));
    check('拒绝 ' + raw, e.log.menuClicks === 0 && e.log.appendSlide === 0 && e.location.hash === '#/admin', e.log);
});

/* 8. 菜单点击委托：切换标签后同步 hash */
env = createEnv('', { targetUrl: '/admin/settings', activeTitle: '系统配置' });
env.state.activeSrc = '/admin/settings';
Object.keys(env.handlers).forEach(function (key) {
    if (key.indexOf('click|.main-menu') === 0) env.handlers[key]();
});
check('菜单点击后 hash 同步', env.location.hash === '#/admin/settings', env.location.hash);

/* 9. hashchange：手动改 hash 后打开对应标签 */
env = createEnv('', { menuLinks: ['/admin/orders'] });
env.location.hash = '#/admin/orders';
if (env.handlers.hashchange) env.handlers.hashchange();
check('hashchange 打开标签', env.log.menuClicks === 1, env.log);

if (failures) {
    console.error('\n' + failures + ' check(s) failed for ' + target);
    process.exit(1);
}
console.log('\nall checks passed for ' + target);
