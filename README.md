# 🎡 LuckyWheel 抽奖模拟器

一个**纯前端、零依赖**的转盘抽奖模拟器。填好奖项列表，圆盘自动等分；拖动圆盘边缘的圆点即可微调每个奖项的中奖概率，点击开始即可旋转抽奖。灵感来自街头抽奖摊的「实物摆盘」风格，温暖手绘、开箱即用。

> 不写一行后端、不装一个包、不跑一次构建 —— 双击 `index.html` 就能玩。

![HTML5](https://img.shields.io/badge/HTML-5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS-3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript&logoColor=black)
![Zero Dependency](https://img.shields.io/badge/dependencies-0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ 特性

- 🎯 **自动等分** —— 圆盘按奖项数量自动均分，列表实时显示各扇区占比。
- 🖱️ **拖拽调概率** —— 拖动圆盘边缘的金色圆点，即可微调相邻两个奖项的中奖概率（带最小占比保护，不会压没）。
- 🔢 **精确调整** —— 右侧列表内可直接输入数字，精确控制每个奖项权重。
- 🖼️ **图片奖品** —— 每个奖项可上传图片，按扇区大小**自适应**裁成圆形绘制在圆盘上；无图则为纯文字扇区。
- 🎰 **加权旋转** —— 基于权重做随机旋转，`easeOutCubic` 缓动 + 顶部指针指示，落点精准对齐。
- 🔔 **结果提示** —— 中奖后弹出提示；未中奖（「没中」扇区）专属文案「得，没中」。
- 🌈 **街头摊位风** —— 米黄底色、奶油卡片、3D 立体红色按钮，接地气又好看。

---

## 🚀 快速开始

### 方式一：直接打开

双击项目根目录下的 `index.html` 即可在浏览器中运行。

### 方式二：本地静态服务器（推荐）

避免某些浏览器对 `file://` 下资源加载的限制：

```bash
# 进入项目目录
cd lottery-simulator

# Python 自带静态服务器
python3 -m http.server 8000
```

然后浏览器访问 <http://localhost:8000> 。

---

## 📖 使用说明

1. **填列表**：在右侧输入框填写奖项名称，回车即添加（也可点 📷 为某项上传奖品图片）。
2. **自动等分**：圆盘按当前列表数量均分，每个扇区默认概率相等，占比 % 实时显示在列表中。
3. **调概率**：拖动圆盘边缘的**金色圆点**微调相邻扇区占比；或在列表的数字框里精确输入权重。
4. **开始抽奖**：点击「开始抽奖」，圆盘加权随机旋转并停在某一扇区，上方指针指示，下方弹出中奖结果。

> 额外按钮：`等分` 一键恢复均分；`清空` 移除全部奖项。

---

## 🗂️ 项目结构

```text
lottery-simulator/
├── index.html      # 页面结构（圆盘容器、控制面板、结果提示）
├── style.css       # 街头摊位温暖风格样式
├── script.js       # 核心逻辑：圆盘绘制、拖拽、加权旋转、抽奖
├── assets/         # 默认奖品图片（7 张）
│   ├── key.png     # 奔驰（车钥匙）
│   ├── watch.png   # 大金劳儿（金表）
│   ├── money.png   # 钞票（百元大钞）
│   ├── top.png     # 陀螺
│   ├── phone.png   # 手机
│   ├── bear.png    # 泰迪熊
│   └── gold.png    # 金条
└── .gitignore
```

---

## 🎨 自定义奖品

默认奖品在 `script.js` 的 `DEFAULT_PRIZES` 数组中定义。修改它即可定制开箱即用的转盘：

```js
const DEFAULT_PRIZES = [
  { label: '没中',   weight: 1, color: '#e63946', imgSrc: null,          hideLabel: false, lose: true },
  { label: '奔驰',   weight: 1, color: null,     imgSrc: 'assets/key.png',   hideLabel: true  },
  { label: '大金劳儿', weight: 1, color: null,   imgSrc: 'assets/watch.png', hideLabel: true  },
  // ...
];
```

字段说明：

| 字段        | 类型            | 说明                                                                 |
| ----------- | --------------- | -------------------------------------------------------------------- |
| `label`     | `string`        | 奖项名称（显示于列表与结果弹窗；`hideLabel` 为 `true` 时不绘于圆盘）。 |
| `weight`    | `number`        | 权重，决定中奖概率。等分时都为 `1`。                                  |
| `color`     | `string \| null`| 扇区底色；`null` 时循环使用内置暖色调板；可指定如 `#e63946` 红色。    |
| `imgSrc`    | `string \| null`| 奖品图片路径（相对 `index.html`）；`null` 为纯文字扇区。             |
| `hideLabel` | `boolean`       | `true` 时圆盘上只显示图片、不显示文字。                              |
| `lose`      | `boolean`       | `true` 时该扇区为「未中奖」，结果提示语变为「得，没中」。            |

> 提示：运行时也可通过界面动态增删奖项、上传图片、拖动调概率，无需改动代码。

---

## ⚙️ 技术实现要点

- **技术栈**：原生 HTML + CSS + Canvas，**无框架、无构建步骤**。
- **数据模型**：每个奖项为 `{ id, label, weight, img?, imgSrc?, color?, hideLabel?, lose? }`；扇区弧度完全由权重推算，因此「拖圆点」与「改数字」两种调占比方式天然同步。
- **拖拽约束**：在环形坐标下用 `clampBoundary` / `applyBoundary` 约束相邻扇区，处理边界跨越 0°、仅 2 个奖项等临界情况，并保留最小 1% 占比。
- **旋转抽奖**：`pickWinner()` 按权重加权随机选中扇区，旋转用 `easeOutCubic` 缓动，落点对齐顶部指针；带 WebAudio 过界 tick 音效增强转盘感。
- **图片性能**：图片经 `imgCache`（dataURL → `Image`）缓存，旋转时不会逐帧重复解码；加载完成后自动重绘。

---

## 🧭 开发路线图

- [ ] 中奖历史记录
- [ ] 音效开关
- [ ] 奖项配置导出 / 导入（JSON）
- [ ] 中奖结果弹窗动画
- [ ] 多语言支持

欢迎提 Issue 或 PR 一起完善 🎉

---

## 🤝 贡献

1. Fork 本仓库
2. 新建分支：`git checkout -b feat/your-feature`
3. 提交改动：`git commit -m "feat: your feature"`
4. 推送分支：`git push origin feat/your-feature`
5. 提交 Pull Request

---

## 📄 许可证

[MIT License](./LICENSE) © 2026 LuckyWheel Contributors
