# dsh-sidebar-tidy — 侧边栏精简

把 DSH Web GUI 侧边栏的全局面板行收敛成 **插件 / 自动化任务 / 更多** 三行；其余面板
（插件市场、QQ机器人、语音设置、演示文稿、工具箱 …）全部收进「更多」菜单里，点菜单行等价于点
原来的侧栏行。白名单之外的新面板**自动**进「更多」，不用改代码。

## 为什么需要它

`@deepseek-ai/dsh-client-ui-sidebar`（0.2.1-rc.5）本来就有一套「收起 / 更多」的机制：
`createPanelPins()` 里有一份内存态的 `unpinned` 列表，里面的面板 id 不出现在侧栏、只进
「更多」菜单的 `entries`。但产品随附唯一的 `sidebar.panellist.actions` 注册项
（`dsh-client-ui-entry-customization`）只渲染「浏览更多插件 / 创建你的插件」两行，
既不渲染 `entries`、也没有 Pin 控件（README 原文：*默认更多菜单只提供插件浏览和创建，
不列出面板或 Pin 控件*）。于是 `unpinned` 永远是空的 —— 结果就是所有插件面板全摊在侧栏上，
「更多」里一个面板都没有。

`setPinned` 没有暴露成 Cordis 服务，第三方插件改不了那份内存列表，所以这里走两条路：
CSS 隐藏侧栏行（声明式、不碰 React 状态）+ 自注册一个 `sidebar.panellist.actions` 把面板
列进「更多」。

## 装法

```sh
dsh plugin --profile web add github:Hao0311/dsh-sidebar-tidy
```

装完重启一次 `dsh web`，再刷新页面。

### 本地开发装法

```
# 1) 让 profile 能解析到这个包（junction 即可）
cmd /c mklink /J "%USERPROFILE%\.dsh\profiles\web\node_modules\dsh-sidebar-tidy" "<本仓库路径>"

# 2) profile 的 package.json 里加一条依赖（与其它 link: 插件一致）
"dsh-sidebar-tidy": "link:D:/Workspaces/DSH/plugins/dsh-sidebar-tidy"

# 3) profile 的 cordis.patch.yml 末尾加 insert 行（新插件行必须用 insert:，写 id+name 会被静默跳过）
- insert:
    - id: sidebar-tidy
      name: 'dsh-sidebar-tidy'
```

然后刷新页面（客户端模块由 `dsh.client.immediately` 在启动时下发；宿主没热加载时需重启 DSH）。

## 保留清单

| 留在侧栏 | 进「更多」 |
|---|---|
| 插件（`plugins`，官方固定条目，不受 unpinned 影响） | 插件市场 / QQ机器人 / 语音设置 / 演示文稿 / 工具箱 / 其它新面板 |
| 自动化任务（`schedules`） | |
| 更多（`sidebar.panellist.actions` 一注册就出现） | |

想改白名单：`client.js` 里 `KEEP_PANEL_IDS`（决定「更多」菜单不列谁）和 `LOCALES` 里的
`keep` 标签（决定 CSS 不隐藏谁）要一起改。

## 实现要点 / 坑

- **标签匹配而非 id**：侧栏行 DOM 只有 `aria-label`，没有 data-id（0.2.1-rc.5 实测），
  所以 CSS 按标签隐藏。每条规则外面套了 `:has(button[aria-label="更多"])` 守卫，
  语言/标签对不上时规则整体不生效 —— 宁可退回官方原样，也不会把侧栏清空。
- **`[class*="panelList"]` / `[class*="panelRow"]`**：CSS Module 的类名是 `<hash>_<name>`，
  哈希会随构建变，`class*=` 匹配后半段才稳。
- **工具箱不是面板**：`dsh-toolbox` 用 DOM 直接往 `nav.panelList` 塞了一行 `#tbx-nav-entry`，
  不在 `slots` 里。所以单独 CSS 隐藏它，并在「更多」里放一行 `.click()` 触发它自己的 toggle。
  它的面板是固定浮层（不锚定那个按钮），从别处触发位置正常；它是 CSS 隐藏而不是移除，
  所以它自己的 `mountEntry()` 不会认为入口丢了又插回来。
- **菜单行组件**：`Menu` 的行必须是 `@deepseek-ai/dsh-client-ui-primitives` 的
  `MenuItemButton`（props：children/shortcut/icon/current/disabled/danger/separatorBefore/onSelect），
  取不到时降级成裸 `<button>`，不至于整页崩。
- `order: -1` 让它排在官方那两行前面；分隔线用内联样式画（菜单内部的 separator 类是私有哈希名）。
