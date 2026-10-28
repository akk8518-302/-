/**
 * 閱讀冒險島 - 測驗引擎核心 (quiz-engine.js)
 * 負責題目渲染、四種題型作答互動、送出判定、詳細解析展示、評分計算與狀態持久化保存。
 */

class QuizEngine {
  constructor() {
    this.quizData = null;
    this.currentIndex = 0;
    this.userAnswers = {};    // 儲存每題學生的作答內容
    this.checkedQuestions = {};// 記錄每題是否已點擊「確認答案」
    this.scores = {};          // 每題得分
    this.selfRubricScores = {};// 簡答題自評勾選狀態
    this.storageKey = "reading_adventure_turtle_state_v1";
    this.onStateChangeCallback = null;
  }

  /**
   * 初始化測驗資料
   * @param {Object} quizData - 題庫資料物件
   */
  init(quizData) {
    this.quizData = quizData;
    this.loadState();
  }

  /**
   * 從 LocalStorage 載入歷史進度
   */
  loadState() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.currentIndex = parsed.currentIndex || 0;
        this.userAnswers = parsed.userAnswers || {};
        this.checkedQuestions = parsed.checkedQuestions || {};
        this.scores = parsed.scores || {};
        this.selfRubricScores = parsed.selfRubricScores || {};
      }
    } catch (e) {
      console.warn("[QuizEngine] 無法讀取本機儲存進度", e);
    }
  }

  /**
   * 儲存進度至 LocalStorage
   */
  saveState() {
    try {
      const state = {
        currentIndex: this.currentIndex,
        userAnswers: this.userAnswers,
        checkedQuestions: this.checkedQuestions,
        scores: this.scores,
        selfRubricScores: this.selfRubricScores,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(state));
    } catch (e) {
      console.warn("[QuizEngine] 無法儲存本機進度", e);
    }
  }

  /**
   * 取得當前題目物件
   */
  getCurrentQuestion() {
    if (!this.quizData || !this.quizData.questions) return null;
    return this.quizData.questions[this.currentIndex];
  }

  /**
   * 取得當前關卡資訊
   */
  getCurrentLevel() {
    const q = this.getCurrentQuestion();
    if (!q || !this.quizData.levels) return null;
    return this.quizData.levels.find(l => l.id === q.levelId);
  }

  /**
   * 取得總題數
   */
  getTotalQuestions() {
    return this.quizData ? this.quizData.questions.length : 0;
  }

  /**
   * 取得目前總得分
   */
  getTotalScore() {
    let total = 0;
    for (const key in this.scores) {
      total += (Number(this.scores[key]) || 0);
    }
    return total;
  }

  /**
   * 取得各層次得分統計
   */
  getLevelStats() {
    const stats = [
      { id: 1, name: "第一層：提取訊息", total: 2, earned: 0, count: 2 },
      { id: 2, name: "第二層：直接推論", total: 4, earned: 0, count: 4 },
      { id: 3, name: "第三層：詮釋與統整", total: 12, earned: 0, count: 4 },
      { id: 4, name: "第四層：評價與省思", total: 8, earned: 0, count: 3 }
    ];

    if (!this.quizData) return stats;

    this.quizData.questions.forEach(q => {
      const levelStat = stats.find(s => s.id === q.levelId);
      if (levelStat && this.scores[q.id] !== undefined) {
        levelStat.earned += (Number(this.scores[q.id]) || 0);
      }
    });

    return stats;
  }

  /**
   * 切換題號
   * @param {number} newIndex - 新的題號索引 (0-based)
   */
  goToQuestion(newIndex) {
    if (newIndex >= 0 && newIndex < this.getTotalQuestions()) {
      this.currentIndex = newIndex;
      this.saveState();
      this.render();
      if (this.onStateChangeCallback) this.onStateChangeCallback("question_changed");
    }
  }

  nextQuestion() {
    if (this.currentIndex < this.getTotalQuestions() - 1) {
      this.goToQuestion(this.currentIndex + 1);
    }
  }

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.goToQuestion(this.currentIndex - 1);
    }
  }

  /**
   * 重新挑戰當前題目
   */
  resetCurrentQuestion() {
    const q = this.getCurrentQuestion();
    if (!q) return;
    delete this.userAnswers[q.id];
    delete this.checkedQuestions[q.id];
    delete this.scores[q.id];
    delete this.selfRubricScores[q.id];
    this.saveState();
    this.render();
    if (this.onStateChangeCallback) this.onStateChangeCallback("question_reset");
  }

  /**
   * 重設整份測驗
   */
  resetAll() {
    this.currentIndex = 0;
    this.userAnswers = {};
    this.checkedQuestions = {};
    this.scores = {};
    this.selfRubricScores = {};
    localStorage.removeItem(this.storageKey);
    this.render();
    if (this.onStateChangeCallback) this.onStateChangeCallback("quiz_reset_all");
  }

  /**
   * 提交確認當前題目答案
   */
  submitCurrentQuestion() {
    const q = this.getCurrentQuestion();
    if (!q) return;

    const answer = this.userAnswers[q.id];
    if (answer === undefined || answer === null || answer === "") {
      alert("請先完成作答，再點擊「確認答案」喔！");
      return;
    }

    let earnedPoints = 0;

    if (q.type === "single_choice") {
      if (answer === q.correctAnswer) {
        earnedPoints = q.points;
      } else {
        earnedPoints = 0;
      }
    } else if (q.type === "matching") {
      // 配對題依正確配對數計分
      let correctMatches = 0;
      for (const itemKey in q.correctPairs) {
        if (answer && answer[itemKey] === q.correctPairs[itemKey]) {
          correctMatches += 1;
        }
      }
      earnedPoints = correctMatches; // 滿分 3 分，每配對 1 分
    } else if (q.type === "ordering") {
      // 排序題判定
      const targetStr = q.correctOrder.join(",");
      const userStr = Array.isArray(answer) ? answer.join(",") : "";
      if (userStr === targetStr) {
        earnedPoints = q.points; // 4 分
      } else {
        // 部分給分：若首項正確給 1 分，尾項正確給 1 分
        let partial = 0;
        if (answer && answer[0] === q.correctOrder[0]) partial += 1;
        if (answer && answer[answer.length - 1] === q.correctOrder[q.correctOrder.length - 1]) partial += 1;
        earnedPoints = partial;
      }
    } else if (q.type === "short_answer") {
      // 簡答題依學生自我檢核勾選表或基本填寫給分
      const rubricChecked = this.selfRubricScores[q.id] || [];
      earnedPoints = rubricChecked.length; // 依勾選向度給分
      if (earnedPoints === 0 && answer.trim().length >= 10) {
        earnedPoints = 1; // 至少有認真寫滿10字，給予起步鼓勵分1分
      }
    }

    this.scores[q.id] = earnedPoints;
    this.checkedQuestions[q.id] = true;
    this.saveState();
    this.render();

    // 播放答對或激勵音效 (若支援)
    if (window.soundController) {
      if (earnedPoints > 0) {
        window.soundController.playSuccess();
      } else {
        window.soundController.playRetry();
      }
    }

    if (this.onStateChangeCallback) this.onStateChangeCallback("question_checked");
  }

  /**
   * 渲染當前題目介面
   * @param {string} containerId - 題目容器 DOM ID
   */
  render(containerId = "quiz-container-box") {
    const container = document.getElementById(containerId);
    if (!container) return;

    const q = this.getCurrentQuestion();
    if (!q) {
      container.innerHTML = `<div class="empty-quiz-notice">題庫準備中...</div>`;
      return;
    }

    const level = this.getCurrentLevel();
    const isChecked = !!this.checkedQuestions[q.id];
    const earnedScore = this.scores[q.id] || 0;
    const isFullyCorrect = earnedScore === q.points;
    const isLastQuestion = this.currentIndex === this.getTotalQuestions() - 1;
    const allCompleted = this.checkAllQuestionsAnswered();

    // 進度計算
    const progressPercent = Math.round(((this.currentIndex + 1) / this.getTotalQuestions()) * 100);

    let html = `
      <div class="quiz-card-wrapper" role="region" aria-label="第${q.id}題">
        <!-- 頂部資訊列：關卡徽章與題號進度 -->
        <div class="quiz-header-bar">
          <div class="level-indicator-tag" style="background-color: ${level.color}15; color: ${level.color}; border: 1.5px solid ${level.color}40;">
            <span class="level-badge-icon">${level.badge}</span>
            <span class="level-badge-title">${level.name}</span>
          </div>
          <div class="quiz-progress-text">
            <span>題號 <strong>${q.id}</strong> / ${this.getTotalQuestions()}</span>
            <span class="points-badge">本題配分：${q.points} 分</span>
          </div>
        </div>

        <!-- 進度條 -->
        <div class="quiz-progress-bar-bg" aria-hidden="true">
          <div class="quiz-progress-bar-fill" style="width: ${progressPercent}%; background-color: ${level.color};"></div>
        </div>

        <!-- 題目內文區 -->
        <div class="quiz-prompt-area">
          <h2 class="quiz-prompt-title">${q.title}</h2>
          <p class="quiz-prompt-question">${q.question}</p>
        </div>

        <!-- 互動答題區 (依題型渲染) -->
        <div class="quiz-interactive-zone" id="interactive-zone-box">
          ${this.renderQuestionTypeContent(q, isChecked)}
        </div>

        <!-- 答題確認按鈕列 -->
        <div class="quiz-action-bar">
          <div class="quiz-action-left">
            <button type="button" class="btn btn-outline" id="quiz-btn-prev" ${this.currentIndex === 0 ? "disabled" : ""}>
              ⬅ 上一題
            </button>
            <button type="button" class="btn btn-outline-soft" id="quiz-btn-reset-single" title="清除本題答案，重新思索">
              🔄 重試本題
            </button>
          </div>

          <div class="quiz-action-right">
            ${!isChecked ? `
              <button type="button" class="btn btn-adventure" id="quiz-btn-submit">
                ✨ 確認答案
              </button>
            ` : `
              ${!isLastQuestion ? `
                <button type="button" class="btn btn-primary" id="quiz-btn-next">
                  下一題 ➡
                </button>
              ` : `
                <button type="button" class="btn btn-success-finish" id="quiz-btn-finish">
                  🎉 完成挑戰，查看成果報告！
                </button>
              `}
            `}
          </div>
        </div>

        <!-- 解析與回饋卡片 (確認答案後顯示) -->
        ${isChecked ? this.renderExplanationCard(q, earnedScore, isFullyCorrect) : ""}
      </div>
    `;

    container.innerHTML = html;
    this.bindQuizInteractiveEvents(q, isChecked);
  }

  /**
   * 依據題型渲染專屬互動元件
   */
  renderQuestionTypeContent(q, isChecked) {
    const savedAnswer = this.userAnswers[q.id];

    // 1. 單選題
    if (q.type === "single_choice") {
      return `
        <div class="single-choice-options" role="radiogroup" aria-label="選擇題選項">
          ${q.options.map(opt => {
            const isSelected = savedAnswer === opt.key;
            let statusClass = "";
            if (isChecked) {
              if (opt.key === q.correctAnswer) {
                statusClass = "option-correct";
              } else if (isSelected && opt.key !== q.correctAnswer) {
                statusClass = "option-wrong";
              }
            } else if (isSelected) {
              statusClass = "option-selected";
            }

            return `
              <div
                class="choice-option-card ${statusClass} ${isChecked ? "disabled-interactive" : ""}"
                data-option-key="${opt.key}"
                tabindex="${isChecked ? "-1" : "0"}"
                role="radio"
                aria-checked="${isSelected}"
              >
                <div class="option-key-badge">${opt.key}</div>
                <div class="option-text-content">${opt.text}</div>
                <div class="option-status-icon">
                  ${isChecked && opt.key === q.correctAnswer ? "✔" : ""}
                  ${isChecked && isSelected && opt.key !== q.correctAnswer ? "✖" : ""}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }

    // 2. 配對題
    if (q.type === "matching") {
      const currentPairs = savedAnswer || {};
      return `
        <div class="matching-container">
          <p class="matching-guide-hint">💡 點選左側「觀察方式」，再點選右側「感受或理解」進行配對：</p>
          <div class="matching-grid">
            <div class="matching-column" id="matching-items-col">
              ${q.items.map(item => {
                const targetKey = currentPairs[item.id];
                const matchedTarget = q.targets.find(t => t.id === targetKey);
                return `
                  <div class="matching-item-card" data-item-id="${item.id}">
                    <span class="matching-label">${item.label}</span>
                    <div class="matched-badge ${targetKey ? "has-pair" : "empty-pair"}">
                      ${matchedTarget ? `連至 ➔ ${matchedTarget.label}` : "點此選擇配對..."}
                    </div>
                  </div>
                `;
              }).join("")}
            </div>

            <div class="matching-column" id="matching-targets-col">
              ${q.targets.map(target => {
                return `
                  <button type="button" class="matching-target-btn ${isChecked ? "disabled" : ""}" data-target-id="${target.id}">
                    ${target.label}
                  </button>
                `;
              }).join("")}
            </div>
          </div>
        </div>
      `;
    }

    // 3. 排序題
    if (q.type === "ordering") {
      const orderKeys = (savedAnswer && Array.isArray(savedAnswer)) ? savedAnswer : q.items.map(i => i.id);
      return `
        <div class="ordering-container">
          <p class="ordering-guide-hint">💡 請使用按鈕調整順序，由上到下排出故事的先後順序：</p>
          <div class="ordering-list" id="ordering-sortable-list">
            ${orderKeys.map((key, idx) => {
              const itemObj = q.items.find(i => i.id === key);
              return `
                <div class="ordering-item-card" data-key="${key}" data-index="${idx}">
                  <div class="order-rank-badge">${idx + 1}</div>
                  <div class="order-text">${itemObj ? itemObj.text : key}</div>
                  ${!isChecked ? `
                    <div class="order-action-arrows">
                      <button type="button" class="btn-arrow btn-arrow-up" data-dir="up" data-idx="${idx}" ${idx === 0 ? "disabled" : ""} title="向上移動">▲</button>
                      <button type="button" class="btn-arrow btn-arrow-down" data-dir="down" data-idx="${idx}" ${idx === orderKeys.length - 1 ? "disabled" : ""} title="向下移動">▼</button>
                    </div>
                  ` : `
                    <div class="order-check-tag">
                      ${q.correctOrder[idx] === key ? "✔ 順序正確" : "需再確認"}
                    </div>
                  `}
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }

    // 4. 簡答題
    if (q.type === "short_answer") {
      const textVal = savedAnswer || "";
      const rubricChecked = this.selfRubricScores[q.id] || [];
      return `
        <div class="short-answer-container">
          <label for="short-answer-textarea" class="visually-hidden">簡答題作答區</label>
          <textarea
            id="short-answer-textarea"
            class="short-answer-input"
            rows="5"
            placeholder="${q.placeholder || "請在此輸入你的想法..."}"
            ${isChecked ? "readonly" : ""}
          >${textVal}</textarea>
          <div class="textarea-counter-row">
            <span>已輸入字數：<strong id="char-counter">${textVal.length}</strong> 字</span>
            <span class="textarea-tip">建議完整寫出原因與生活例子喔！</span>
          </div>

          ${isChecked ? `
            <div class="rubric-checklist-card">
              <div class="rubric-header">
                <span class="rubric-title">📋 國小四年級自我檢核與評分規準表</span>
                <span class="rubric-sub">（請誠實對照自己的回答，符合項目請打勾計分）</span>
              </div>
              <div class="rubric-items-list">
                ${q.rubric.map((r, rIdx) => {
                  const isItemChecked = rubricChecked.includes(rIdx);
                  return `
                    <label class="rubric-item-label">
                      <input
                        type="checkbox"
                        class="rubric-checkbox"
                        data-rubric-idx="${rIdx}"
                        ${isItemChecked ? "checked" : ""}
                      />
                      <span class="rubric-item-text">
                        <strong>【${r.score} 分】</strong> ${r.criteria}
                      </span>
                    </label>
                  `;
                }).join("")}
              </div>
              <div class="sample-answer-box">
                <div class="sample-title">🌟 優秀作答參考範例：</div>
                <div class="sample-body">${q.sampleAnswer.replace(/\n/g, "<br/>")}</div>
              </div>
            </div>
          ` : ""}
        </div>
      `;
    }

    return "";
  }

  /**
   * 渲染解析卡片
   */
  renderExplanationCard(q, earnedScore, isFullyCorrect) {
    let resultBannerClass = isFullyCorrect ? "result-banner-success" : "result-banner-retry";
    let resultTitle = isFullyCorrect
      ? `🎉 太棒了！答對了！（獲得 ${earnedScore} / ${q.points} 分）`
      : `💡 需要再想想喔！（獲得 ${earnedScore} / ${q.points} 分）`;

    return `
      <div class="quiz-feedback-card ${resultBannerClass}" role="alert">
        <div class="feedback-banner">
          <span class="feedback-icon">${isFullyCorrect ? "🌟" : "🔎"}</span>
          <h3 class="feedback-heading">${resultTitle}</h3>
        </div>

        <div class="feedback-content-grid">
          <!-- 正確答案與依據 -->
          <div class="feedback-section">
            <h4 class="feedback-sub-title">🎯 正確答案 / 參考標準</h4>
            <div class="feedback-text highlight-answer">
              ${q.type === "single_choice" ? `選項 (${q.correctAnswer})` : ""}
              ${q.type === "matching" ? "① 像一座島 ｜ ② 像一隻烏龜 ｜ ③ 開始理解形狀會影響聯想" : ""}
              ${q.type === "ordering" ? "正確順序：B ➔ C ➔ D ➔ A" : ""}
              ${q.type === "short_answer" ? "詳見上方自我檢核規準與參考範例" : ""}
            </div>
          </div>

          <!-- 文章依據 -->
          <div class="feedback-section">
            <h4 class="feedback-sub-title">📖 文章依據（請對照左側文章）</h4>
            <div class="feedback-text text-evidence">${q.evidence}</div>
          </div>

          <!-- 詳細解說 -->
          <div class="feedback-section">
            <h4 class="feedback-sub-title">💡 深度解析</h4>
            <div class="feedback-text">${q.explanation}</div>
          </div>

          <!-- 常見思考盲點 -->
          <div class="feedback-section">
            <h4 class="feedback-sub-title">⚠️ 常見思考盲點</h4>
            <div class="feedback-text misconception-text">${q.misconception}</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 綁定互動事件
   */
  bindQuizInteractiveEvents(q, isChecked) {
    // 1. 單選題點擊事件
    if (q.type === "single_choice" && !isChecked) {
      const optionCards = document.querySelectorAll(".choice-option-card");
      optionCards.forEach(card => {
        card.addEventListener("click", () => {
          const key = card.getAttribute("data-option-key");
          this.userAnswers[q.id] = key;
          optionCards.forEach(c => c.classList.remove("option-selected"));
          card.classList.add("option-selected");
          this.saveState();
        });
      });
    }

    // 2. 配對題點擊事件
    if (q.type === "matching" && !isChecked) {
      let activeItemId = null;
      const itemCards = document.querySelectorAll(".matching-item-card");
      const targetBtns = document.querySelectorAll(".matching-target-btn");

      if (!this.userAnswers[q.id]) {
        this.userAnswers[q.id] = {};
      }

      itemCards.forEach(card => {
        card.addEventListener("click", () => {
          activeItemId = card.getAttribute("data-item-id");
          itemCards.forEach(c => c.classList.remove("item-active"));
          card.classList.add("item-active");
        });
      });

      targetBtns.forEach(btn => {
        btn.addEventListener("click", () => {
          if (!activeItemId) {
            alert("請先點選左側的一項觀察方式，再選擇配對項目喔！");
            return;
          }
          const targetId = btn.getAttribute("data-target-id");
          this.userAnswers[q.id][activeItemId] = targetId;
          this.saveState();
          this.render(); // 刷新顯示配對標籤
        });
      });
    }

    // 3. 排序題上下按鈕
    if (q.type === "ordering" && !isChecked) {
      const upBtns = document.querySelectorAll(".btn-arrow-up");
      const downBtns = document.querySelectorAll(".btn-arrow-down");

      if (!this.userAnswers[q.id]) {
        this.userAnswers[q.id] = q.items.map(i => i.id);
      }

      const swapItems = (idx1, idx2) => {
        const arr = [...this.userAnswers[q.id]];
        const temp = arr[idx1];
        arr[idx1] = arr[idx2];
        arr[idx2] = temp;
        this.userAnswers[q.id] = arr;
        this.saveState();
        this.render();
      };

      upBtns.forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.getAttribute("data-idx"), 10);
          if (idx > 0) swapItems(idx, idx - 1);
        });
      });

      downBtns.forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.getAttribute("data-idx"), 10);
          if (idx < this.userAnswers[q.id].length - 1) swapItems(idx, idx + 1);
        });
      });
    }

    // 4. 簡答題輸入與自評 Checkbox
    if (q.type === "short_answer") {
      const textarea = document.getElementById("short-answer-textarea");
      const charCounter = document.getElementById("char-counter");

      if (textarea && !isChecked) {
        textarea.addEventListener("input", (e) => {
          this.userAnswers[q.id] = e.target.value;
          if (charCounter) charCounter.textContent = e.target.value.length;
          this.saveState();
        });
      }

      // 自評勾選表點擊
      if (isChecked) {
        const checkboxes = document.querySelectorAll(".rubric-checkbox");
        checkboxes.forEach(cb => {
          cb.addEventListener("change", () => {
            const checkedList = [];
            checkboxes.forEach(box => {
              if (box.checked) {
                checkedList.push(parseInt(box.getAttribute("data-rubric-idx"), 10));
              }
            });
            this.selfRubricScores[q.id] = checkedList;
            this.scores[q.id] = checkedList.length;
            this.saveState();
            // 更新回饋標題分數
            const heading = document.querySelector(".feedback-heading");
            if (heading) {
              const full = this.scores[q.id] === q.points;
              heading.textContent = full
                ? `🎉 太棒了！答對了！（獲得 ${this.scores[q.id]} / ${q.points} 分）`
                : `💡 自評完成！（獲得 ${this.scores[q.id]} / ${q.points} 分）`;
            }
          });
        });
      }
    }

    // 按鈕列事件
    const prevBtn = document.getElementById("quiz-btn-prev");
    const nextBtn = document.getElementById("quiz-btn-next");
    const submitBtn = document.getElementById("quiz-btn-submit");
    const resetSingleBtn = document.getElementById("quiz-btn-reset-single");
    const finishBtn = document.getElementById("quiz-btn-finish");

    if (prevBtn) prevBtn.addEventListener("click", () => this.prevQuestion());
    if (nextBtn) nextBtn.addEventListener("click", () => this.nextQuestion());
    if (submitBtn) submitBtn.addEventListener("click", () => this.submitCurrentQuestion());
    if (resetSingleBtn) resetSingleBtn.addEventListener("click", () => {
      if (confirm("確定要重試本題嗎？這會清除目前的答案。")) {
        this.resetCurrentQuestion();
      }
    });
    if (finishBtn) finishBtn.addEventListener("click", () => {
      if (this.onStateChangeCallback) this.onStateChangeCallback("view_results");
    });
  }

  /**
   * 檢查是否所有題目都已完成
   */
  checkAllQuestionsAnswered() {
    if (!this.quizData) return false;
    return this.quizData.questions.every(q => this.checkedQuestions[q.id]);
  }
}

// 導出全局實例
window.quizEngine = new QuizEngine();
