# 杨光 · 个人学术主页

零构建、零依赖的静态学术主页。所有内容由 `data/` 目录下的 JSON 驱动，修改内容不需要碰 HTML 或 CSS。

## 目录结构

```
homepage_cv/
├── index.html              页面骨架（导航、侧栏、正文容器）
├── data/
│   ├── site.json           站点配置 + 章节清单
│   ├── profile.json        个人信息（姓名、职位、指标、联系方式）
│   ├── research.json       研究兴趣
│   ├── experience.json     教育与工作经历
│   ├── projects.json       科研项目
│   ├── publications.json   代表性成果
│   └── service.json        学术服务与荣誉
├── assets/
│   ├── style.css           全部样式
│   ├── script.js           读取 JSON 并渲染
│   ├── yg.jpg              头像
│   └── favicon.png         站点图标
├── .nojekyll               告诉 GitHub Pages 不要用 Jekyll 处理
└── README.md
```

## 渲染流程

1. `index.html` 只保留空容器：`#nav`、`#sidebar`、`#content-body`。
2. `assets/script.js` 先加载 `data/site.json`。
3. 读取 `site.profile` 指向的个人信息文件，以及 `site.sections` 中每个章节的 `file`。
4. 按章节的 `type` 调用对应渲染函数生成 DOM。
5. 语言与分区体系按「用户手动选择 → 配置默认值」的顺序解析，详见下文。

## 默认语言

首次访问的语言由 `data/site.json` 的 `site.defaultLang` 决定（当前为 `zh`）。优先级：

1. `localStorage` 中的 `lang` —— 用户点过右上角语言按钮后会被永久记住；
2. 没有记录时，使用 `site.defaultLang`；
3. 该字段缺失或非法时，回退到 `index.html` 中的 `data-lang`。

`index.html` 的 `<html lang="zh-CN" data-lang="zh">` 与内联脚本只负责避免首屏闪烁，其兜底值需与 `site.defaultLang` 保持一致。

想验证默认值或回到默认语言，清除本地记录即可：

```js
localStorage.removeItem('lang');
location.reload();
```

## 默认分区体系

## 默认分区体系

论文分区的默认体系由 `data/publications.json` 的 `rank.default` 决定（当前为 `jcr`）。优先级同样是「用户手动选择 → 配置默认值」，清除本地记录后可回到默认：

```js
localStorage.removeItem('rank');
location.reload();
```

切换分区只影响分组与篇数统计，不会改动任何内容文件。

## 内容修改指南

### 个人信息

编辑 `data/profile.json`：

| 字段 | 说明 |
|---|---|
| `name` | 页面标题处的姓名 |
| `role` | 职位 / 单位 |
| `photo` | 头像路径，相对站点根目录 |
| `metrics` | 侧栏指标，`value` + `label` |
| `contacts` | 联系方式列表，`icon` 支持 `scholar` / `github` / `orcid` / `cv` / `mail` |
| `collaboration` | 侧栏合作邀约卡片 |
| `meta` | 底部本地时间的位置与时区 |

### 新增论文

在 `data/publications.json` 对应分组的 `items` 数组开头插入一项：

```json
{ "rank": 1, "title": "论文标题", "authors": "Yang G, Zhou Y, Chen X, et al.", "venue": "会议或期刊全称, 年份, 卷(期): 页码." }
```

- 编号 `[1]`–`[n]` 由 CSS 计数器自动生成，跨分组连续，不需要手写。
- `authors` 写纯文本、逗号分隔。文件顶部的 `"self": ["Yang G", "杨光"]` 声明了本人姓名，脚本自动处理：首位出现时加粗加下划线（第一作者），其余位置加粗（通讯作者等）。
- 作者名后加 `*` 会自动渲染为通讯作者上标，不要手写 HTML。
- `rank` 为分区数字：写单个数字表示三套体系相同；体系间不一致时写 `{ "cas": 2, "jcr": 1, "xr": 3 }`；会议论文可省略。省略 `rank` 的条目只按所属分组展示，不参与分区打分。
- 默认分区体系由 `rank.default` 决定（当前 `jcr`），用户在页面上的切换同样记在 `localStorage` 的 `rank` 中。
- `title`、`venue` 按纯文本渲染；`note` 仍支持内联 HTML。

### 新增科研项目

在 `data/projects.json` 的 `items` 中插入：

```json
{
  "date": "2026.01 – 2028.12",
  "title": { "zh": "项目中文名", "en": "Project title in English" },
  "funder": { "zh": "资助计划（编号）", "en": "Funding program (No. ...)" },
  "amount": { "zh": "20 万元 · 主持", "en": "CNY 200k · PI" }
}
```

日期列、标题、资助信息与金额会自动按现有版式排版。

### 新增经历

`data/experience.json` 的 `items`：

```json
{
  "date": "2027.01 – 至今",
  "org": { "zh": "单位中文名", "en": "Organization" },
  "duty": { "zh": "职位", "en": "Position" },
  "advisor": {
    "label": { "zh": "导师", "en": "Advisor" },
    "name": { "zh": "姓名", "en": "Name" },
    "url": "https://example.com"
  }
}
```

`advisor` 可省略，省略后只显示单位与职位。

### 中英双语字段

所有需要翻译的文本写成对象：

```json
{ "zh": "中文", "en": "English" }
```

不需要翻译的（论文标题、期刊名、作者列表）直接写字符串，两种语言共用。右上角 `中文 / EN` 按钮切换，选择会记在浏览器本地；首次访问默认中文。

### 调整章节顺序

编辑 `data/site.json` 的 `sections` 数组。顺序即页面顺序，`id` 必须与导航锚点一致：

```json
{ "id": "publications", "type": "publications", "file": "data/publications.json" }
```

`type` 目前支持：`interests`、`timeline`、`projects`、`publications`、`service`。

新增章节时需要同时：

1. 在 `data/` 下新建内容文件；
2. 在 `sections` 中登记 `id`、`type`、`file`；
3. 在 `nav` 中加一条指向 `#id` 的链接；
4. 如果是新的 `type`，在 `script.js` 的 `RENDERERS` 中补充渲染函数。

## 本地预览

浏览器会拦截 `file://` 下的 JSON 请求，必须通过 HTTP 打开：

```bash
cd homepage_cv
python -m http.server 8000
```

然后访问 <http://localhost:8000>。也可以使用 `npx serve` 等任意静态服务器。

## 部署到 GitHub Pages

### 方式一：用户站点（推荐）

1. 新建公开仓库，命名为 `<用户名>.github.io`。
2. 将本目录下所有文件推送到仓库根目录。
3. 仓库 **Settings → Actions → General**，将 Actions permissions 设为 `Allow all actions and reusable workflows` 并保存。
4. 仓库 **Settings → Pages**，Source 选 `Deploy from a branch`，分支 `main`，目录 `/ (root)`。
5. 访问 `https://<用户名>.github.io`。

### 方式二：项目站点

仓库可以任意命名，推送后在 Pages 中选择 `main` / root，站点地址为 `https://<用户名>.github.io/<仓库名>/`。页面内所有路径都是相对路径，无需额外配置。

仓库中已包含 `.nojekyll`，可以避免 Jekyll 处理资源目录。

### 部署报错：Actions is currently unavailable

自 2024 年 6 月 30 日起，GitHub Pages 的所有构建（包括 `Deploy from a branch`）都通过 GitHub Actions 执行，因此仓库必须允许运行 Actions，否则 Pages 会提示：

> Actions is currently unavailable for your repository, and your Pages site requires a Jekyll build step.

处理步骤：

1. 在 **Settings → Actions → General** 中启用 Actions；
2. 回到 **Settings → Pages** 重新保存一次 Source；
3. 在 **Actions** 标签页查看 `pages build and deployment`，失败则 Re-run all jobs。

若该选项置灰，通常是组织策略限制、账号邮箱未验证，或私有仓库未开通 Pages（免费账号需仓库为 Public）。`.nojekyll` 只跳过 Jekyll 处理，不能代替启用 Actions。

## 样式调整

`assets/style.css` 顶部的 `:root` 集中定义了：

- 颜色：`--paper`、`--ink`、`--muted`、`--faint`、`--rule`、`--link`
- 字体：`--serif`、`--sans`
- 版心：`--max`

深色模式在 `[data-theme="dark"]` 中覆盖同名变量。响应式断点为 `900px` 与 `460px`。

## 注意事项

- 重命名或移动 `data/` 下的文件后，要同步修改 `data/site.json` 里对应的 `file` 路径。
- `index.html` 中的 `<html data-lang>` 与 `localStorage` 里的 `lang` 只决定首屏渲染，最终默认语言以 `data/site.json` 的 `site.defaultLang` 为准。
- 论文分区体系同理：`publications.json` 的 `rank.default` 是默认值，`localStorage` 中的 `rank` 会覆盖它。
- 论文序号、右对齐的导师与金额、章节分隔线都由 CSS 自动处理，不需要在 JSON 里写样式。
- 首页的 `<title>` 与 `meta description` 仍写在 `index.html` 中，需要改站名时直接编辑该文件头部。
