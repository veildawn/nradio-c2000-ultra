# NRadio Astryx 管理界面

基于 Meta [Astryx](https://github.com/meta/astryx) 的 OpenWrt 全局管理界面。登录页、导航、搜索、浅色/深色模式由 React 19 与 Astryx 组件实现；所有管理页面通过同一个主题展示，不需要跳转到另一套高级控制台。

管理范围包括状态与日志、网络接口、无线、DHCP/DNS、防火墙、路由、系统配置、软件包、备份升级，以及 NRadio 的 5G 蜂窝、在线更新和双系统切换。菜单来自 `ui.menu.load()` 返回的权限过滤结果，后续安装的 LuCI 插件也会进入导航和搜索，多级设置保留原有页签。

这是完整管理界面的替换，**不是将全部 LuCI 业务代码重写成 React**。现有页面仍由 LuCI 渲染，兼容样式统一表单、表格、弹窗与操作按钮；会话、ACL、CSRF、UCI 校验、未保存提示以及配置应用/回滚仍走原有 LuCI 流程。没有新增特权 RPC，也没有用演示数据替代设备数据。

## 构建和预览

需要 Node.js 24、npm 和 Python 3。在仓库根目录运行：

```bash
npm --prefix ui/astryx ci
npm --prefix ui/astryx run build
python3 -m http.server 8765 --bind 127.0.0.1
```

打开 `http://127.0.0.1:8765/ui/astryx/preview.html`，登录预览使用 `?login=1`。预览页明确标注演示数据，配置和登录提交只记录在当前浏览器页面内，不连接路由器。实际设备页面通过现有 LuCI 页面与 RPC 获取数据。

生成文件位于 `board/files/www/luci-static/astryx/`，由构建生成，不提交到 Git。当前 JS/CSS 总计约 1.15 MB（gzip 约 270 KB；实际传输量取决于 Web 服务压缩设置），另有许可证文件。路由器只提供本地静态文件，不运行 Node.js、不加载 CDN、字体或远端脚本。浏览器需支持 CSS 层、原生 ES modules、`inert` 与 `color-mix()`（建议当前 Chrome、Firefox、Safari）。

## 集成进固件

先完成上面的 `npm ci` 和 `npm run build`，再运行 `board/inject_imagebuilder.py` 或 `board/apply.py`。两种构建入口都会检查资源是否存在，避免生成缺失主题的镜像。GitHub Actions 已包含资源构建及浏览器回归。

`90-nradio-astryx-ui` 在首次启动时注册并选择 Astryx 主题，保留其他已安装的主题作为恢复选项。现有设备的 UCI 配置、插件与权限规则无需转换。

## 单独安装界面包

```bash
python3 ui/astryx/scripts/package.py
```

输出 `build/nradio-astryx-ui.tar.gz`，只包含 Astryx 资源、菜单桥接脚本、主题模板、主题注册脚本和说明；不包含固件或蜂窝后端。适用于已安装现代 ucode 版 LuCI 的 OpenWrt（本仓库 Snapshot），不能用于原厂 Web 系统或旧的 Lua 版 LuCI。

把界面包上传到设备 `/tmp/` 后，在设备上运行：

```sh
tar -xzf /tmp/nradio-astryx-ui.tar.gz -C /
sh /etc/uci-defaults/90-nradio-astryx-ui
rm -f /etc/uci-defaults/90-nradio-astryx-ui
/etc/init.d/uhttpd restart
```

如需恢复本固件随附的 Bootstrap 主题：

```sh
uci set luci.main.mediaurlbase='/luci-static/bootstrap'
uci commit luci
/etc/init.d/uhttpd restart
```

## 验证与边界

```bash
python3 -m pip install 'playwright>=1.50,<2'
python3 -m playwright install chromium
python3 -m unittest discover -s tests -v
```

浏览器回归覆盖原生登录字段与提交、表单校验、未保存指示器、权限过滤后的菜单及多级页签、全局搜索、手机导航、主题持久化和 LuCI 弹窗。测试使用真实构建产物与本地 LuCI 形状的表单/RPC 替身；主题模板另经 ucode 编译器语法检查。

尚未在 C2000 Ultra 实机部署新主题。实际 Wi-Fi/蜂窝设置、断网后的配置回滚、软件包安装和第三方插件专有布局仍需上机验收。动态接入插件菜单不代表每个第三方插件的自定义 CSS 均已逐一验证。

## 源码与许可证

- `src/main.tsx`：Astryx 导航、搜索、主题和登录按钮。
- `src/style.css`：页面及 LuCI 控件样式。
- `src/luci-base.css`：OpenWrt Bootstrap 的兼容布局基础，Apache-2.0；上游文件 blob `4a101006b8940cf68ca9bd92e30283a6679ce3eb`。
- `board/files/www/luci-static/resources/menu-astryx.js`：LuCI 菜单桥接。
- `board/files/usr/share/ucode/luci/template/themes/astryx/`：主题模板。
- `reference/`：上游模板及许可证。Astryx、React、StyleX 使用 MIT，LuCI 基础样式与模板使用 Apache-2.0。构建时收集生产依赖许可证到 `THIRD-PARTY-NOTICES.txt`，随界面一起分发。
