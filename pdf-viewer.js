/**
 * 閱讀冒險島 - PDF 閱讀器控制器 (pdf-viewer.js)
 * 負責內嵌 PDF 顯示、縮放控制、全螢幕切換、行動端適配與載入失敗備援機制。
 */

class PDFViewerController {
  constructor() {
    this.container = null;
    this.iframe = null;
    this.currentZoom = 100;
    this.currentUrl = "";
    this.isLoaded = false;
  }

  /**
   * 初始化 PDF 閱讀器
   * @param {string} containerId - PDF 容器 DOM ID
   * @param {string} pdfUrl - PDF 檔案相對路徑
   */
  init(containerId, pdfUrl) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn(`[PDFViewer] 找不到容器元素: ${containerId}`);
      return;
    }
    this.currentUrl = pdfUrl;
    this.render();
  }

  /**
   * 渲染 PDF 介面與控制列
   */
  render() {
    if (!this.container) return;

    // 清空現有容器內容
    this.container.innerHTML = `
      <div class="pdf-viewer-wrapper">
        <div class="pdf-toolbar" role="toolbar" aria-label="PDF閱讀器工具列">
          <div class="pdf-toolbar-left">
            <span class="pdf-badge">📄 文章閱讀區</span>
            <span class="pdf-page-hint" id="pdf-article-title">《海上有一隻烏龜》</span>
          </div>
          <div class="pdf-toolbar-actions">
            <button type="button" class="pdf-tool-btn" id="pdf-zoom-out-btn" title="縮小 (Zoom Out)" aria-label="縮小">
              <span>➖</span>
            </button>
            <span class="pdf-zoom-level" id="pdf-zoom-text">100%</span>
            <button type="button" class="pdf-tool-btn" id="pdf-zoom-in-btn" title="放大 (Zoom In)" aria-label="放大">
              <span>➕</span>
            </button>
            <button type="button" class="pdf-tool-btn" id="pdf-zoom-reset-btn" title="重設大小" aria-label="重設大小">
              <span>↺</span>
            </button>
            <button type="button" class="pdf-tool-btn" id="pdf-fullscreen-btn" title="全螢幕閱讀" aria-label="全螢幕閱讀">
              <span>⛶ 全螢幕</span>
            </button>
            <a href="${this.currentUrl}" target="_blank" rel="noopener noreferrer" class="pdf-tool-link" title="以新分頁開啟原始 PDF">
              <span>↗ 另開閱讀</span>
            </a>
          </div>
        </div>

        <div class="pdf-viewport" id="pdf-viewport-box">
          <div class="pdf-loading-overlay" id="pdf-loading-indicator">
            <div class="pdf-spinner"></div>
            <p>正在載入閱讀文章，請稍候...</p>
          </div>

          <!-- 核心內嵌 iframe -->
          <iframe
            id="embedded-pdf-frame"
            src="${this.currentUrl}#toolbar=1&navpanes=0&view=FitH"
            title="閱讀文章 PDF 閱讀器"
            class="pdf-frame"
            loading="lazy"
          ></iframe>

          <!-- 載入失敗備援提示卡片 (預設隱藏) -->
          <div class="pdf-fallback-card" id="pdf-fallback-notice" style="display: none;">
            <div class="fallback-icon">📖</div>
            <h3>瀏覽器未直接預覽 PDF？</h3>
            <p>別擔心！你可以點擊下方按鈕，在獨立分頁中輕鬆閱讀文章，讀完後再回來答題喔！</p>
            <div class="fallback-actions">
              <a href="${this.currentUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
                🚀 在新分頁開啟文章 PDF
              </a>
              <a href="${this.currentUrl}" download="海上有一隻烏龜.pdf" class="btn btn-secondary">
                📥 下載 PDF 檔案
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  /**
   * 綁定按鈕與縮放事件
   */
  bindEvents() {
    this.iframe = document.getElementById("embedded-pdf-frame");
    const loadingIndicator = document.getElementById("pdf-loading-indicator");
    const fallbackNotice = document.getElementById("pdf-fallback-notice");

    if (this.iframe) {
      // 監聽載入完成
      this.iframe.onload = () => {
        if (loadingIndicator) {
          loadingIndicator.style.display = "none";
        }
        this.isLoaded = true;
      };

      // 監聽載入錯誤或逾時備援
      setTimeout(() => {
        if (!this.isLoaded && loadingIndicator) {
          loadingIndicator.style.display = "none";
          if (fallbackNotice) {
            fallbackNotice.style.display = "flex";
          }
        }
      }, 7000);
    }

    // 縮放按鈕
    const zoomInBtn = document.getElementById("pdf-zoom-in-btn");
    const zoomOutBtn = document.getElementById("pdf-zoom-out-btn");
    const zoomResetBtn = document.getElementById("pdf-zoom-reset-btn");
    const fullscreenBtn = document.getElementById("pdf-fullscreen-btn");

    if (zoomInBtn) {
      zoomInBtn.addEventListener("click", () => this.zoom(10));
    }
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener("click", () => this.zoom(-10));
    }
    if (zoomResetBtn) {
      zoomResetBtn.addEventListener("click", () => this.resetZoom());
    }
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener("click", () => this.toggleFullscreen());
    }
  }

  /**
   * 縮放控制
   * @param {number} delta - 縮放增量
   */
  zoom(delta) {
    const newZoom = Math.min(Math.max(this.currentZoom + delta, 70), 160);
    this.currentZoom = newZoom;
    const zoomText = document.getElementById("pdf-zoom-text");
    if (zoomText) zoomText.textContent = `${this.currentZoom}%`;

    if (this.iframe) {
      this.iframe.style.transform = `scale(${this.currentZoom / 100})`;
      this.iframe.style.transformOrigin = "top center";
      // 調整包裝盒寬度以防止破版
      if (this.currentZoom > 100) {
        this.iframe.style.width = `${100 / (this.currentZoom / 100)}%`;
      } else {
        this.iframe.style.width = "100%";
      }
    }
  }

  /**
   * 重設縮放
   */
  resetZoom() {
    this.currentZoom = 100;
    const zoomText = document.getElementById("pdf-zoom-text");
    if (zoomText) zoomText.textContent = "100%";
    if (this.iframe) {
      this.iframe.style.transform = "none";
      this.iframe.style.width = "100%";
    }
  }

  /**
   * 全螢幕檢視
   */
  toggleFullscreen() {
    const viewport = document.getElementById("pdf-viewport-box");
    if (!viewport) return;

    if (!document.fullscreenElement) {
      if (viewport.requestFullscreen) {
        viewport.requestFullscreen();
      } else if (viewport.webkitRequestFullscreen) {
        viewport.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  /**
   * 切換不同文章路徑
   * @param {string} newUrl - 新 PDF 路徑
   * @param {string} title - 文章標題
   */
  loadArticle(newUrl, title = "") {
    this.currentUrl = newUrl;
    this.isLoaded = false;
    this.render();
    const titleEl = document.getElementById("pdf-article-title");
    if (titleEl && title) {
      titleEl.textContent = `《${title}》`;
    }
  }
}

// 導出全局實例
window.pdfViewerController = new PDFViewerController();
