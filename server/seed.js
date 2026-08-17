// One-off seeder that writes 4 demo posts + a starter profile.
// Run with:  node server/seed.js   (or  npm run seed)
//
// Idempotent: if data/posts.json already exists and has items, it does nothing
// unless --force is passed.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const store = require('./store');

const force = process.argv.includes('--force');

const profile = {
  name: '我的小角落',
  avatar: '',
  intro: {
    zh: '这是一个记录学习与思考的个人小站。文章涵盖成长、技术与生活。\n\n欢迎你留下脚印，或在「联系」页面给我留言。',
    en: 'This is my little corner of the internet — a place to share what I learn, build, and think about. No grand insights, just notes along the way.\n\nFeel free to say hello via the Contact page.'
  },
  about: {
    zh: '## 关于我\n\n我是一名**终身学习者**，喜欢把零散的知识整理成文章。\n\n- 📚 我在学习：写作、思维模型、编程\n- ✍️ 我在写：读书笔记、项目总结、生活随笔\n- 🌱 我相信：日拱一卒，功不唐捐\n\n如果你也喜欢这样的内容，欢迎常来逛逛。',
    en: '## About me\n\nI am a **lifelong learner** who likes turning scattered notes into shareable articles.\n\n- 📚 Learning: writing, mental models, programming\n- ✍️ Writing: book notes, project postmortems, life fragments\n- 🌱 Belief: small consistent steps compound\n\nStick around if any of that sounds interesting.'
  },
  contacts: [
    { label: 'Email',   url: 'mailto:hello@example.com' },
    { label: 'GitHub',  url: 'https://github.com/yourname' },
    { label: 'Twitter', url: 'https://x.com/yourname' }
  ]
};

// ---- 4 demo posts (zipped cover SVG illustrations) ----
const postsList = [
  {
    slug: 'on-marginal-gains',
    category: 'Growth Mindset',
    tags: ['life', 'habits'],
    status: 'published',
    date: '2026-05-12',
    cover: '/images/cover-marginal.svg',
    title: {
      zh: '日拱一卒：边际改善的力量',
      en: 'Marginal Gains: The Quiet Power of 1%'
    },
    summary: {
      zh: '与其追求一次性的彻底改变，不如每天进步 1%。一篇关于持续微改进的复盘。',
      en: 'Forget sweeping life overhauls. Tiny 1% improvements, stacked over time, quietly change everything.'
    },
    body: {
      zh: `## 为什么 1% 更有用

我们总想找到那个**"改变一切"的决定**——换一份工作、搬到一个新城市、戒掉所有的坏习惯。
但回看自己这几年真正发生的变化，几乎都不是来自某个惊天动地的瞬间，而是来自每天 1% 的悄悄推进。

> "The aggregation of marginal gains is the compound effect of tiny improvements."

## 我试着做的小事

- 每天写 200 字，哪怕只是流水账
- 每周看完一本书的一个章节
- 把"今天我能多做的一件小事"写在便签上
- 睡前把手机放在客厅

这些事情都不性感，但 90 天后回头看，**复利效应会自己显现**。

## 给自己的提醒

不要被"完美的一天"绑架。每一天做对一件小事，长此以往，足以成为你想成为的那个人。
`,
      en: `## Why 1% is more powerful

We keep chasing the **"change it all"** moment — a new job, a new city, dropping every bad habit overnight.
Looking back, the shifts that actually moved me didn't come from one dramatic pivot. They came from tiny 1% moves, made daily.

> "The aggregation of marginal gains is the compound effect of tiny improvements."

## Tiny habits I'm trying

- write 200 words a day, even when they're messy
- finish one chapter of a book every week
- jot down "one small thing I can finish today"
- leave my phone in the living room before bed

None of these are sexy. But 90 days in, the compounding speaks for itself.

## A reminder to future me

Stop waiting for the perfect day. Do one small thing, today, on repeat.
`
    }
  },
  {
    slug: 'building-mywebsite',
    category: 'Technology',
    tags: ['nodejs', 'cloudflare'],
    status: 'published',
    date: '2026-04-02',
    cover: '/images/cover-build.svg',
    title: {
      zh: '我用 Node.js + JSON 搭了一个双语小博客',
      en: 'I built a tiny bilingual blog with Node.js and JSON'
    },
    summary: {
      zh: '从 0 到 1 做一个支持中英双语、可在本地和 Cloudflare 上跑的极简博客。',
      en: 'A from-scratch minimalist blog that runs locally and ships to Cloudflare Pages.'
    },
    body: {
      zh: `## 目标很简单

想做一个**真的能用**的小站，不需要数据库，不需要复杂的构建链：
- 本地能跑（\`node server/index.js\`）
- 一键推到 Cloudflare Pages
- 自带后台，能写文章、上传图片、切换隐藏/显示

## 架构选择

- **Express** 处理本地 API
- **JSON 文件**作为数据存储（\`data/posts.json\` 等）
- **Cloudflare Functions**（\`functions/api/*.js\`）作为部署时的 API
- **localStorage + JWT** 做后台登录
- **多语言字段**嵌在每条记录里：\`{ zh, en }\`

\`\`\`js
// Example post shape
{
  id: 'abcd1234',
  status: 'published',
  title:    { zh: '你好', en: 'Hello' },
  summary:  { zh: '...',   en: '...' },
  body:     { zh: '...',   en: '...' },
  date: '2026-04-02'
}
\`\`\`

## 几个我用得很顺手的小工具

- **\`renderMarkdown\`** —— 客户端轻量 Markdown 渲染（够用就好）
- **\`localStorage\` + JWT** —— 不需要 cookie 也能跨页保持登录态
- **\`multer\`** —— 处理图片上传，本地写盘、Cloudflare 上换 R2 即可

完整代码放在仓库里，欢迎 star。
`,
      en: `## A simple goal

I wanted a **useful** little site — no database, no fancy build step:
- runs locally with \`node server/index.js\`
- ships to Cloudflare Pages in one push
- ships with an admin panel: write posts, upload images, hide/show posts

## Architecture choices

- **Express** for local API endpoints
- **JSON files** as the data layer (\`data/posts.json\` and friends)
- **Cloudflare Functions** at \`functions/api/*.js\` mirror the same APIs in prod
- **localStorage + JWT** for admin auth — no cookies needed
- **bilingual fields** inline on each record: \`{ zh, en }\`

\`\`\`js
// Example post shape
{
  id: 'abcd1234',
  status: 'published',
  title:    { zh: '你好', en: 'Hello' },
  summary:  { zh: '...',   en: '...' },
  body:     { zh: '...',   en: '...' },
  date: '2026-04-02'
}
\`\`\`

## Tiny helpers I like

- **\`renderMarkdown\`** — small client-side Markdown renderer (good enough)
- **\`localStorage\` + JWT** — auth state survives reload without server-side sessions
- **\`multer\`** — image uploads write to disk locally; swap for R2 in Cloudflare

Full source is in the repo — star if it helps.
`
    }
  },
  {
    slug: 'notes-on-deep-work',
    category: 'Growth Mindset',
    tags: ['focus', 'work'],
    status: 'published',
    date: '2026-03-15',
    cover: '/images/cover-focus.svg',
    title: {
      zh: '深度工作的三条朴素原则',
      en: 'Three Quiet Rules of Deep Work'
    },
    summary: {
      zh: '不是 4 点起床、不是双显示器、不是所有番茄钟。真正能用的是这三件小事。',
      en: 'Not 4am wake-ups, not dual monitors, not every flavor of Pomodoro. Three small rules that actually work.'
    },
    body: {
      zh: `## 不要追逐"最有效率的自己"

网上能搜到一堆"提高效率"的清单，每一条都很短，每一条都让人兴奋，但几乎没人能长期坚持。

我决定反其道而行之——只留三条。

## 规则一：做事前先写下"完成是什么样子"

打开任何工作之前，先用一句话写下"结束长什么样"。

> 今天交付一份能跑通的脚本，包含 README，最多 200 行。

这一句话做了两件事：界定范围，提供完成信号。

## 规则二：把深度时段留在精力最好的时段

对大多数人来说上午比下午更靠谱，下午比晚上更靠谱。我自己的经验：**最重要的那件事，永远放在当天的第一块时间**，后面再处理邮件、消息、琐事。

## 规则三：允许自己"看起来没用"

深度工作最反直觉的是——它看起来 **一点都不像在工作**。一个人坐在桌前两小时写三百个字，他人看到的只是"发呆"。

不用解释，不用表现得忙。做完就行。
`,
      en: `## Stop chasing your "most productive self"

The internet is full of productivity checklists. Each item is short, each one feels exciting, almost none of them stick.

I went the other way and kept just three rules.

## Rule 1: Write down "what does done look like"

Before opening any work, write one sentence:

> Today I will ship a runnable script with a README, ≤ 200 lines.

That sentence does two things: bounds the scope, and gives you a finish line.

## Rule 2: Put deep work in your peak window

For most people, mornings beat afternoons, afternoons beat evenings. In my experience, **the most important task of the day always goes in the first block** — emails and chat come afterwards.

## Rule 3: Allow yourself to "look unproductive"

Deep work is counterintuitive — it barely looks like work. Someone sitting for two hours writing 300 words looks, to outside eyes, like they're zoning out.

Don't perform. Don't explain. Just ship.
`
    }
  },
  {
    slug: 'first-steps-into-llms',
    category: 'Technology',
    tags: ['ai', 'notes'],
    status: 'published',
    date: '2026-02-08',
    cover: '/images/cover-llm.svg',
    title: {
      zh: '给写代码的人：第一次玩转 LLM 的几条笔记',
      en: 'For Engineers: First Notes on Playing with LLMs'
    },
    summary: {
      zh: '从工程师视角出发，写给"会用 API、写过 prompt、想过把它接进自己的项目"的人。',
      en: 'From an engineer\'s perspective — written for people who can hit an API, have written prompts, and wondered how to plug this into their own project.'
    },
    body: {
      zh: `## 别把 LLM 当搜索引擎用

LLM 不是搜索引擎。它不知道**事件真伪**，但能极好地 **整理思路、转换格式、起承转合**。

把它当"结对编程的同事"用，比当"老师"用靠谱得多。

## Prompt 不是越长越好

我最初以为 prompt 越长越有用，于是写了一两百字的指令。结果发现：

- **清晰** > 详细
- **示例** > 规则
- **结构化输入** > 自然语言

给三个例子，比给三个规则更稳。

## 把它嵌入自己的应用

最简单的形态：

\`\`\`js
const user = "请帮我把这段会议纪要整理成待办列表";
const out  = await llm.complete({ prompt: TEMPLATE + user });
\`\`\`

注意三点：
1. **结果要校验**：永远把 LLM 的输出当作"提案"而不是"答案"。
2. **失败也要兜底**：写好 try/catch 和超时。
3. **评估必须有**：哪怕只有 10 条人工打标数据，也能让你"知道改善有没有用"。

工具终归是工具，**用得稳的人，才是赢家**。
`,
      en: `## Don't use an LLM as a search engine

An LLM is not a search engine. It can't really tell you **what is true**, but it's extremely good at **structuring thoughts, transforming formats, smoothing prose**.

Use it like a pair-programming colleague rather than a textbook.

## Longer prompts ≠ better prompts

I used to believe longer prompts were stronger. I'd write 150+ word instructions. Then I learned:

- **clarity** beats verbosity
- **examples** beat rules
- **structured input** beats free-form text

Three good examples crush three good rules.

## Embedding it in your own app

The simplest shape:

\`\`\`js
const user = "Turn these meeting notes into a TODO list";
const out  = await llm.complete({ prompt: TEMPLATE + user });
\`\`\`

Three things to remember:

1. **Validate the output**: always treat the LLM's reply as a *proposal*, never as *truth*.
2. **Plan for failure**: wrap in try/catch, set timeouts.
3. **Always evaluate**: even 10 hand-labeled examples tell you whether a change actually helped.

The tool is just a tool. **The operator wins.**
`
    }
  }
];

const existing = store.getPosts();
if (existing.items && existing.items.length && !force) {
  console.log('[seed] posts already present (' + existing.items.length + '). Use --force to overwrite.');
} else {
  // Generate IDs and timestamps the same way posts.create() would.
  const items = postsList.map((p, i) => Object.assign({}, p, {
    id: crypto.randomBytes(6).toString('hex'),
    createdAt: new Date(Date.now() - (postsList.length - i) * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    author: 'admin',
  }));
  store.savePosts({ items });
  console.log('[seed] wrote ' + items.length + ' posts.');
}

// Profile
store.saveProfile(profile);
console.log('[seed] wrote profile.');

// Write demo SVG covers if missing
const IMG_DIR_PATH = path.join(__dirname, '..', 'public', 'images');
const covers = [
  ['cover-marginal.svg',  '#7a9e9f', '1%'],
  ['cover-build.svg',     '#5a6f9e', 'BUILD'],
  ['cover-focus.svg',     '#9f7a5a', 'FOCUS'],
  ['cover-llm.svg',       '#7a5a9f', 'LLM'],
];
covers.forEach(function(c) {
  const fp = path.join(IMG_DIR_PATH, c[0]);
  if (fs.existsSync(fp)) return;
  fs.writeFileSync(fp, makeCover(c[1], c[2]), 'utf8');
  console.log('[seed] wrote cover ' + c[0]);
});

function makeCover(bg, label) {
  // Simple flat SVG that looks pleasant as a cover thumbnail.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 420" width="800" height="420">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="1" stop-color="#2c3e50"/>
    </linearGradient>
  </defs>
  <rect width="800" height="420" fill="url(#g)"/>
  <circle cx="640" cy="80" r="120" fill="#ffffff" opacity=".08"/>
  <circle cx="120" cy="360" r="160" fill="#ffffff" opacity=".06"/>
  <text x="50%" y="58%" text-anchor="middle" font-family="Georgia, serif" font-size="120" font-weight="700" fill="#ffffff" opacity=".85" letter-spacing="6">${label}</text>
</svg>`;
}
