/**
 * dsh-sidebar-tidy 浏览器半边：把侧边栏的全局面板行收敛成「插件 + 自动化任务 + 更多」三行，
 * 其余面板（插件市场 / QQ机器人 / 语音设置 / 演示文稿 / 工具箱 …）全部收进「更多」菜单。
 *
 * 背景（0.2.1-rc.5 的官方行为）
 * ------------------------------
 * `dsh-client-ui-sidebar` 里有一份**内存态**的 `unpinned` 列表（`createPanelPins`）：
 * 列表里的面板 id 不在侧栏渲染，只会出现在「更多」菜单的 `entries` 属性里。但产品随附的
 * 唯一 `sidebar.panellist.actions` 注册项（ui-entry-customization）只渲染「浏览更多插件 /
 * 创建你的插件」两行，**不渲染 entries、也没有 Pin 控件**，于是 unpinned 永远是空的 ——
 * 结果就是所有插件面板全摆在侧栏外面，「更多」里反而没有它们。
 *
 * 官方没有把 setPinned 暴露成服务，别的插件改不了那份内存列表。所以这里做两件事：
 *   1. 用一段高特异性 CSS 把除白名单外的面板行隐藏掉（纯声明式，不碰 React 状态）；
 *   2. 自己注册一个 `sidebar.panellist.actions`，把隐藏掉的面板以菜单行的形式列进「更多」，
 *      点击走官方的 `onOpen(id)`（会走 analytics + selectPanel，和点侧栏行等价）。
 *
 * 白名单之外的任何新面板会自动进「更多」—— 因为 entries 是动态的（`slots.entriesOfSlot`），
 * CSS 这边是「除白名单全隐藏」，两边口径一致。
 *
 * 例外：dsh-toolbox 的「工具箱」不是注册面板，它是 DOM 自己塞进 `nav.panelList` 的一行
 * （`#tbx-nav-entry`）。所以单独隐藏它，并在「更多」里放一行用 `.click()` 触发它自己的
 * toggle —— 它的面板是固定浮层（不是锚定在那个按钮上的），从别处触发位置是对的。
 */
window.__ModuleLoader__.load({
  id: 'dsh-sidebar-tidy',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** 宿主 UI 原语（MenuItemButton 等）。取不到就降级成纯文字行，不抛错。 */
    let MenuItemButton;
    try {
      MenuItemButton = require('@deepseek-ai/dsh-client-ui-primitives').MenuItemButton;
    } catch {
      MenuItemButton = undefined;
    }

    const NS = 'sidebar-tidy';
    const STYLE_ID = 'dsh-sidebar-tidy';
    const TOOLBOX_ENTRY_ID = 'tbx-nav-entry';
    /** 侧栏保留的面板 id：插件（固定条目，永远是它是第一行）。 */
    const KEEP_PANEL_IDS = new Set(['plugins', 'schedules']);

    const zh = {
      toolbox: '工具箱',
      hideHint: '收进「更多」',
    };
    const en = {
      toolbox: 'Toolbox',
      hideHint: 'Folded into More',
    };

    /**
     * 各语言下要保留的三行标签：插件、自动化任务、更多。
     * 用标签而不是 id 匹配，是因为侧栏行 DOM 上只有 `aria-label`，没有 data-id（0.2.1-rc.5 实测）。
     * 每条规则自带 `:has(button[aria-label="更多"])` 守卫：语言变了、标签对不上时规则整体不生效，
     * 宁可退回官方原样，也不会把侧栏清空。
     */
    const LOCALES = [
      { more: '更多', keep: ['插件', '自动化任务', '更多'] },
      { more: 'More', keep: ['Plugins', 'Automation tasks', 'More'] },
    ];

    /** 把标签数组拼成 `:not([aria-label="…"])` 串。 */
    function notLabels(labels) {
      return labels.map((label) => `:not([aria-label=${JSON.stringify(label)}])`).join('');
    }

    /** 生成隐藏规则。只隐藏白名单之外的面板行，外加工具箱那一行。 */
    function buildCss() {
      const rules = [];
      for (const { more, keep } of LOCALES) {
        const skip = notLabels(keep);
        const nav = `nav[class*="panelList"]:has(button[aria-label=${JSON.stringify(more)}])`;
        // 行按钮本身（侧栏行可能被 Tooltip 包一层，所以用后代选择器而不是 ">"）。
        rules.push(`${nav} button[class*="panelRow"]${skip}{display:none!important}`);
        // 万一 Tooltip 渲染了外层元素，一并隐藏，避免留下 2px 行距的空隙。
        rules.push(`${nav} > *:has(> button[class*="panelRow"]${skip}){display:none!important}`);
      }
      // 工具箱：不是注册面板，是 DOM 直接塞进来的一行。
      rules.push(`#${TOOLBOX_ENTRY_ID}{display:none!important}`);
      return rules.join('\n');
    }

    /** 注入/更新样式表（幂等，重复调用只会替换内容）。 */
    function injectStyle() {
      if (typeof document === 'undefined') return;
      let tag = document.getElementById(STYLE_ID);
      if (tag === null) {
        tag = document.createElement('style');
        tag.id = STYLE_ID;
        tag.dataset.plugin = 'dsh-sidebar-tidy';
        document.head.appendChild(tag);
      }
      const css = buildCss();
      if (tag.textContent !== css) tag.textContent = css;
    }

    /** 「更多」菜单里的一行：点击 → 关闭菜单 → 打开对应面板。 */
    function panelRow(entry, onOpen, onDismiss) {
      const select = () => {
        onDismiss();
        onOpen(entry.id);
      };
      if (MenuItemButton === undefined) {
        return h('button', { key: entry.id, type: 'button', onClick: select }, entry.label);
      }
      return h(MenuItemButton, {
        key: entry.id,
        current: entry.active === true,
        onSelect: select,
      }, entry.label);
    }

    /**
     * 「更多」菜单的自定义行：被收起来的面板 + 工具箱。
     * `entries` 由 SidebarRoot 传进来（全部可自定义面板，含 id/label/active，已排除插件管理）。
     */
    function HiddenPanelRows(props) {
      const { entries, onOpen, onDismiss, t } = props;
      const rows = [];
      for (const entry of Array.isArray(entries) ? entries : []) {
        if (entry === null || entry === undefined) continue;
        if (KEEP_PANEL_IDS.has(entry.id)) continue;
        rows.push(panelRow(entry, onOpen, onDismiss));
      }
      // 工具箱只在它真的挂上了才出现。
      if (typeof document !== 'undefined' && document.getElementById(TOOLBOX_ENTRY_ID) !== null) {
        const openToolbox = () => {
          onDismiss();
          document.getElementById(TOOLBOX_ENTRY_ID)?.click();
        };
        rows.push(MenuItemButton === undefined
          ? h('button', { key: 'toolbox', type: 'button', onClick: openToolbox }, t('toolbox'))
          : h(MenuItemButton, { key: 'toolbox', onSelect: openToolbox }, t('toolbox')));
      }
      if (rows.length === 0) return null;
      // 自定义行之后跟一条分隔线，把官方的「浏览更多插件 / 创建你的插件」隔开。
      // （菜单内部的 separator class 是 CSS Module 私有名，拿不到，所以用内联样式画一条。）
      rows.push(h('div', {
        key: 'tidy-separator',
        role: 'separator',
        style: {
          height: 1,
          margin: '4px 8px',
          background: 'var(--dsw-alias-border-l2, rgba(127,127,127,.25))',
        },
      }));
      return h(React.Fragment, null, rows);
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        injectStyle();
        try {
          if (ctx.locale && typeof ctx.locale.register === 'function') {
            ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'sidebar-tidy: dictionaries');
          }
        } catch {
          /* 忽略：菜单行退化为中文默认值。 */
        }
        const t = typeof ctx.locale?.bind === 'function' ? ctx.locale.bind(NS) : (key) => zh[key] ?? key;
        if (!ctx.slots || typeof ctx.slots.inject !== 'function') return;
        // order: -1 —— 排在官方那两行（浏览/创建插件）之前，进「更多」第一眼看到的是面板。
        ctx.slots.inject('sidebar.panellist.actions', () => ctx.slots.register({
          name: 'sidebar.panellist.actions',
          id: 'sidebar-tidy',
          order: -1,
          locale: NS,
          inject: () => ({ t }),
        }, HiddenPanelRows));
      },
    };
  },
});
