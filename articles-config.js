/**
 * 閱讀冒險島 - 文章清單設定檔 (articles-config.js)
 * 教師若欲新增或更換文章，只需在此清單中新增一筆物件，或修改預設文章的資訊與題庫路徑。
 */
const ARTICLES_CONFIG = [
  {
    id: "turtle-island",
    title: "海上有一隻烏龜",
    author: "小甜根",
    source: "【得報】第 89 期「故事」專欄",
    publishDate: "2026年10月23日",
    difficulty: "★★★",
    targetGrade: "國小四年級",
    totalPages: 7,
    // PDF 檔案路徑：採用相對於網站根目錄的相對路徑，相容 GitHub Pages
    pdfUrl: "public/articles/turtle-island.pdf",
    coverTag: "宜蘭龜山島的觀察與想像",
    summary: "小甜根乘車經過宜蘭海岸，望向海面發現形狀像烏龜的島嶼。在與島嶼的想像對話中，領悟到觀察角度與命名的奧妙，發現同一件事物可以有不只一種看法。",
    // 對應題庫識別碼
    quizId: "quiz-turtle"
  }
];

// 預設當前載入的文章
const CURRENT_ARTICLE_ID = "turtle-island";

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ARTICLES_CONFIG, CURRENT_ARTICLE_ID };
}
