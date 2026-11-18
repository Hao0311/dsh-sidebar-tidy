/**
 * dsh-sidebar-tidy — 宿主半边。
 *
 * 这个插件**不需要任何宿主逻辑**：所有工作都在浏览器半边（`client.js`，由 DSH 的
 * 客户端模块加载器按 package.json 的 `dsh.client` 自动下发）。留这个空 apply 只为
 * 让 Cordis 把它当成一个正常插件行加载 —— patch 层 `insert:` 需要一个能 apply 的模块。
 *
 * 为什么不做成 `webserver/index-inject`（像 dsh-toolbox / dsh-mobile-console 那样）：
 * 那条路塞进去的是普通 <script>，拿不到 `ctx.slots`，不能往「更多」菜单里塞菜单行，
 * 只能靠 DOM hack 往弹层里贴按钮。要正大光明地注册 `sidebar.panellist.actions`，
 * 必须是客户端模块插件（`window.__ModuleLoader__.load`）。
 */

/** 没有要注入的宿主服务。 */
export const inject = [];

/** 空实现：本插件的全部行为在浏览器端。 */
export function apply() {}
