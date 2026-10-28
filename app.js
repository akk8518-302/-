/**
 * 閱讀冒險島 - 主應用程式核心 (app.js)
 * 負責全域頁面狀態切換、Web Audio 兒童互動音效、無障礙動態切換、成果證書列印與教師管理面板。
 */

// 1. Web Audio API 免下載無依賴輕量音效合成器
class SoundSynthesizer {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  playSuccess() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 清脆的三連琶音 (C5, E5, G5)
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.18, now + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.36);
    });
  }

  playRetry() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 溫和鼓勵的雙低音 (G4, E4)
    [392.0, 329.63].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.12);

      gain.gain.setValueAtTime(0.12, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.29);
    });
  }

  playClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }
}

window.soundController = new SoundSynthesizer();

// 2. 主應用程式路由與流程控制器
class ReadingAdventureApp {
  constructor() {
    this.currentView = "home"; // 'home' | 'read' | 'challenge' | 'result'
    this.article = null;
    this.reduceMotion = false;
    this.mobileSplitTab = "quiz"; // 'article' | 'quiz' (針對窄螢幕)
  }

  init() {
    // 取得當前文章設定
    if (typeof ARTICLES_CONFIG !== "undefined" && ARTICLES_CONFIG.length > 0) {
      this.article = ARTICLES_CONFIG[0];
    }

    // 初始化測驗引擎
    if (window.quizEngine && typeof QUIZ_DATA_TURTLE !== "undefined") {
      window.quizEngine.init(QUIZ_DATA_TURTLE);
      window.quizEngine.onStateChangeCallback = (action) => this.handleEngineCallback(action);
    }

    // 初始化 PDF 閱讀器
    if (window.pdfViewerController && this.article) {
      window.pdfViewerController.init("pdf-column-container", this.article.pdfUrl);
    }

    this.bindGlobalEvents();
    this.renderHeaderArticleInfo();
    this.renderHomeOverview();
    this.switchView("home");

    // 檢查無障礙動態偏好
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      this.toggleReduceMotion(true);
    }
  }

  /**
   * 綁定導覽列、頁面切換、無障礙與教師專區等全域事件
   */
  bindGlobalEvents() {
    // 導覽列按鈕
    document.querySelectorAll("[data-nav-view]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const view = btn.getAttribute("data-nav-view");
        window.soundController.playClick();
        this.switchView(view);
      });
    });

    // 首頁「開始冒險」按鈕
    const startAdventureBtn = document.getElementById("btn-start-adventure");
    if (startAdventureBtn) {
      startAdventureBtn.addEventListener("click", () => {
        window.soundController.playSuccess();
        this.switchView("challenge");
      });
    }

    // 首頁「先讀文章」按鈕
    const startReadBtn = document.getElementById("btn-start-reading-alone");
    if (startReadBtn) {
      startReadBtn.addEventListener("click", () => {
        window.soundController.playClick();
        this.switchView("read");
      });
    }

    // 音效開關
    const soundToggleBtn = document.getElementById("toggle-sound-btn");
    if (soundToggleBtn) {
      soundToggleBtn.addEventListener("click", () => {
        const enabled = window.soundController.toggle();
        soundToggleBtn.innerHTML = enabled ? "🔊 音效：開" : "🔇 音效：關";
        soundToggleBtn.classList.toggle("btn-active", enabled);
      });
    }

    // 動態效果開關 (無障礙)
    const motionToggleBtn = document.getElementById("toggle-motion-btn");
    if (motionToggleBtn) {
      motionToggleBtn.addEventListener("click", () => {
        this.toggleReduceMotion(!this.reduceMotion);
      });
    }

    // 行動裝置切換 [看文章 / 做題目] 頁籤
    const mobileTabArticle = document.getElementById("mobile-tab-article");
    const mobileTabQuiz = document.getElementById("mobile-tab-quiz");
    if (mobileTabArticle && mobileTabQuiz) {
      mobileTabArticle.addEventListener("click", () => {
        this.setMobileTab("article");
      });
      mobileTabQuiz.addEventListener("click", () => {
        this.setMobileTab("quiz");
      });
    }

    // 教師專區 Modal 打開與關閉
    const teacherBtn = document.getElementById("btn-open-teacher-panel");
    const teacherModal = document.getElementById("teacher-management-modal");
    const closeTeacherBtn = document.getElementById("btn-close-teacher-modal");

    if (teacherBtn && teacherModal) {
      teacherBtn.addEventListener("click", () => {
        this.renderTeacherPanelData();
        teacherModal.style.display = "flex";
      });
    }
    if (closeTeacherBtn && teacherModal) {
      closeTeacherBtn.addEventListener("click", () => {
        teacherModal.style.display = "none";
      });
    }

    // 成果頁重新挑戰與列印證書按鈕
    const restartQuizBtn = document.getElementById("btn-restart-entire-quiz");
    const printCertBtn = document.getElementById("btn-print-certificate");
    const backToArticleBtn = document.getElementById("btn-back-to-article");

    if (restartQuizBtn) {
      restartQuizBtn.addEventListener("click", () => {
        if (confirm("確定要重新開始挑戰嗎？這會清除目前的作答紀錄與得分。")) {
          window.quizEngine.resetAll();
          this.switchView("challenge");
        }
      });
    }

    if (printCertBtn) {
      printCertBtn.addEventListener("click", () => {
        window.print();
      });
    }

    if (backToArticleBtn) {
      backToArticleBtn.addEventListener("click", () => {
        this.switchView("challenge");
        this.setMobileTab("article");
      });
    }
  }

  /**
   * 切換視圖
   * @param {string} viewName - 'home' | 'read' | 'challenge' | 'result'
   */
  switchView(viewName) {
    this.currentView = viewName;
    const views = ["home-view", "read-view", "challenge-view", "result-view"];

    views.forEach(v => {
      const el = document.getElementById(v);
      if (el) el.style.display = "none";
    });

    const targetEl = document.getElementById(`${viewName}-view`);
    if (targetEl) {
      targetEl.style.display = "block";
    }

    // 更新導覽列高亮
    document.querySelectorAll("[data-nav-view]").forEach(btn => {
      const v = btn.getAttribute("data-nav-view");
      btn.classList.toggle("nav-link-active", v === viewName);
    });

    if (viewName === "challenge") {
      window.quizEngine.render();
      // 在小螢幕預設為做題模式，可按頂部頁籤切換
      this.setMobileTab(this.mobileSplitTab);
    } else if (viewName === "result") {
      this.renderResultsReport();
    } else if (viewName === "read") {
      // 確保獨立閱讀模式的 PDF 正確加載
      if (window.pdfViewerController && this.article) {
        window.pdfViewerController.init("standalone-pdf-container", this.article.pdfUrl);
      }
    }

    window.scrollTo({ top: 0, behavior: this.reduceMotion ? "auto" : "smooth" });
  }

  /**
   * 行動版分頁切換 (左側文章 / 右側題目)
   */
  setMobileTab(tab) {
    this.mobileSplitTab = tab;
    const articleCol = document.getElementById("challenge-article-col");
    const quizCol = document.getElementById("challenge-quiz-col");
    const tabArticle = document.getElementById("mobile-tab-article");
    const tabQuiz = document.getElementById("mobile-tab-quiz");

    if (tabArticle && tabQuiz) {
      tabArticle.classList.toggle("tab-active", tab === "article");
      tabQuiz.classList.toggle("tab-active", tab === "quiz");
    }

    if (articleCol && quizCol) {
      if (window.innerWidth <= 1024) {
        articleCol.style.display = tab === "article" ? "block" : "none";
        quizCol.style.display = tab === "quiz" ? "block" : "none";
      } else {
        // 桌上型電腦一律左右並排
        articleCol.style.display = "block";
        quizCol.style.display = "block";
      }
    }
  }

  /**
   * 處理 QuizEngine 的回呼
   */
  handleEngineCallback(action) {
    if (action === "view_results") {
      window.soundController.playSuccess();
      this.switchView("result");
    }
  }

  /**
   * 切換無障礙動態
   */
  toggleReduceMotion(enabled) {
    this.reduceMotion = enabled;
    document.body.classList.toggle("reduce-motion-mode", enabled);
    const motionBtn = document.getElementById("toggle-motion-btn");
    if (motionBtn) {
      motionBtn.innerHTML = enabled ? "🧘 減少動態：已開啟" : "🏃 動態效果：標準";
      motionBtn.classList.toggle("btn-active", enabled);
    }
  }

  /**
   * 渲染首頁的文章資訊卡片
   */
  renderHeaderArticleInfo() {
    if (!this.article) return;
    const titleElements = document.querySelectorAll(".current-article-title-text");
    titleElements.forEach(el => el.textContent = this.article.title);

    const sourceEl = document.getElementById("home-article-source");
    if (sourceEl) {
      sourceEl.textContent = `${this.article.source} ｜ 作者：${this.article.author} ｜ 難度：${this.article.difficulty}`;
    }
  }

  /**
   * 渲染首頁關卡導覽
   */
  renderHomeOverview() {
    const listEl = document.getElementById("home-levels-list");
    if (!listEl || typeof QUIZ_DATA_TURTLE === "undefined") return;

    listEl.innerHTML = QUIZ_DATA_TURTLE.levels.map(lvl => `
      <div class="level-preview-card" style="border-top: 4px solid ${lvl.color}">
        <div class="level-card-badge">${lvl.badge}</div>
        <h4 class="level-card-name" style="color: ${lvl.color}">${lvl.name}</h4>
        <p class="level-card-sub">${lvl.subtitle}</p>
        <div class="level-card-count">共 ${lvl.questionIds.length} 題挑戰</div>
      </div>
    `).join("");
  }

  /**
   * 渲染學習成果報告頁
   */
  renderResultsReport() {
    if (!window.quizEngine) return;

    const totalScore = window.quizEngine.getTotalScore();
    const maxScore = window.quizEngine.quizData.totalScore || 26;
    const percent = Math.round((totalScore / maxScore) * 100);

    // 成績評語與徽章
    let rankBadge = "🎖️ 閱讀小學徒";
    let rankDesc = "你踏出了深層閱讀的第一步！多看文章解析，一定能收穫更多好想法！";
    let rankStars = "★☆☆";

    if (percent >= 90) {
      rankBadge = "👑 閱讀冒險大師";
      rankDesc = "太不可思議了！你具備敏銳的洞察力與深入的省思能力，完美通關四層次闖關！";
      rankStars = "★★★";
    } else if (percent >= 70) {
      rankBadge = "💎 智慧探險家";
      rankDesc = "表現非常出色！你不僅能提取重要細節，還能推敲人物心情並整合不同視角！";
      rankStars = "★★☆";
    } else if (percent >= 50) {
      rankBadge = "🧭 勇敢航海員";
      rankDesc = "很棒的冒險！你已掌握文章關鍵事實，繼續練習推論與生活延伸思考會更棒！";
      rankStars = "★☆☆";
    }

    // 填充成績數值
    const scoreValEl = document.getElementById("result-score-val");
    const percentValEl = document.getElementById("result-percent-val");
    const badgeNameEl = document.getElementById("result-badge-name");
    const badgeDescEl = document.getElementById("result-badge-desc");
    const starsEl = document.getElementById("result-stars-row");

    if (scoreValEl) scoreValEl.textContent = `${totalScore} / ${maxScore}`;
    if (percentValEl) percentValEl.textContent = `${percent}%`;
    if (badgeNameEl) badgeNameEl.textContent = rankBadge;
    if (badgeDescEl) badgeDescEl.textContent = rankDesc;
    if (starsEl) starsEl.textContent = rankStars;

    // 四層次雷達條分析
    const stats = window.quizEngine.getLevelStats();
    const statsContainer = document.getElementById("result-level-breakdown");
    if (statsContainer) {
      statsContainer.innerHTML = stats.map(s => {
        const p = Math.round((s.earned / s.total) * 100);
        return `
          <div class="level-stat-row">
            <div class="level-stat-header">
              <span class="stat-name">${s.name} (${s.count}題)</span>
              <span class="stat-score">${s.earned} / ${s.total} 分 (${p}%)</span>
            </div>
            <div class="stat-bar-bg">
              <div class="stat-bar-fill" style="width: ${p}%;"></div>
            </div>
          </div>
        `;
      }).join("");
    }

    // 題目回顧清單
    const reviewList = document.getElementById("result-review-list");
    if (reviewList && window.quizEngine.quizData) {
      reviewList.innerHTML = window.quizEngine.quizData.questions.map(q => {
        const earned = window.quizEngine.scores[q.id] || 0;
        const isFull = earned === q.points;
        return `
          <div class="review-item-card ${isFull ? "review-item-correct" : "review-item-retry"}">
            <div class="review-item-top">
              <span class="review-q-id">第 ${q.id} 題</span>
              <span class="review-q-title">${q.title}</span>
              <span class="review-score-tag">${earned} / ${q.points} 分</span>
            </div>
            <p class="review-q-text">${q.question}</p>
            <div class="review-evidence-hint">📖 依據：${q.evidence}</div>
          </div>
        `;
      }).join("");
    }
  }

  /**
   * 渲染教師面板資料與設定說明
   */
  renderTeacherPanelData() {
    const infoBox = document.getElementById("teacher-article-info-preview");
    if (infoBox && this.article) {
      infoBox.innerHTML = `
        <table class="teacher-info-table">
          <tr><th>當前文章標題</th><td>${this.article.title}</td></tr>
          <tr><th>文章來源</th><td>${this.article.source}</td></tr>
          <tr><th>作者</th><td>${this.article.author}</td></tr>
          <tr><th>PDF 儲存路徑</th><td><code>${this.article.pdfUrl}</code></td></tr>
          <tr><th>題庫題數</th><td>共 13 題（四層次架構，總分 26 分）</td></tr>
        </table>
      `;
    }
  }
}

// 監聽 DOM 載入並啟動
document.addEventListener("DOMContentLoaded", () => {
  window.readingAdventureApp = new ReadingAdventureApp();
  window.readingAdventureApp.init();
});

// 監聽視窗縮放以自適應排版
window.addEventListener("resize", () => {
  if (window.readingAdventureApp && window.readingAdventureApp.currentView === "challenge") {
    window.readingAdventureApp.setMobileTab(window.readingAdventureApp.mobileSplitTab);
  }
});
