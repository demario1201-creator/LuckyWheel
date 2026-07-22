# 🎡 LuckyWheel 抽奖模拟器

纯前端、零依赖的转盘抽奖模拟器 —— 填好奖项，圆盘自动等分，拖一拖圆点就能调中奖概率，点一下开始旋转抽奖。灵感取自街头抽奖摊的「实物摆盘」风格，温暖手绘、开箱即用。

> 不写后端、不装依赖、不跑构建 —— 双击 `index.html` 就能玩。

![HTML5](https://img.shields.io/badge/HTML-5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS-3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript&logoColor=black)
![Zero Dependency](https://img.shields.io/badge/dependencies-0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ 核心特点

- 🎯 **自动等分** —— 圆盘按奖项数量自动均分，列表实时显示各扇区占比。
- 🖱️ **拖拽调概率** —— 拖动圆盘边缘的金色圆点，即可微调相邻奖项的中奖概率（带最小占比保护，不会被压没）。
- 🔢 **精确权重** —— 右侧列表内直接输入数字，精确控制每个奖项权重。
- 🖼️ **图片奖品** —— 每个奖项可上传图片，按扇区大小**自适应**裁成圆形绘制；无图则为纯文字扇区。
- 🎰 **加权旋转** —— 基于权重做随机旋转，`easeOutCubic` 缓动 + 手指指针指示，落点精准对齐。
- 📣 **直播文案** —— 抽奖进行中，转盘下方按时间均分三段播放顺口溜文案，抽完隐去再弹结果。
- 🌈 **街头摊位风** —— 米黄底色、奶油卡片、3D 立体红色按钮，接地气又好看。

## 💡 为什么选它（优点）

- **零门槛**：无需 Node、无需打包，任何浏览器直接打开即可运行与分发。
- **所见即所得**：拖圆点与改数字两种方式天然同步，概率调整即时可见。
- **高度可定制**：默认 8 扇区地摊风奖品，运行时可动态增删、传图、调概率；代码层改 `DEFAULT_PRIZES` 即可换整套配置。
- **轻量可靠**：原生 Canvas 绘制 + 图片缓存，旋转流畅不卡顿。
- **开源自由**：MIT 协议，可任意使用、修改、再分发。

---

## 🚀 快速开始

双击 `index.html`；或在目录下启动静态服务器：

```bash
python3 -m http.server 8000
# 浏览器访问 http://localhost:8000
```

---

## 📄 许可证

[MIT License](./LICENSE) © 2026 LuckyWheel Contributors
