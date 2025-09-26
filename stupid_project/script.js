/* -----------------------------
   Quiz Application - Version Améliorée
   Améliorations : gestion d'erreurs, performance, UX, code modulaire
----------------------------- */

class QuizManager {
  constructor() {
    this.questions = [];
    this.filteredQuestions = [];
    this.currentIndex = 0;
    this.shuffleMode = true;
    this.conquestMode = true;
    this.correctCount = 0;
    this.missedQuestions = [];
    this.decks = {};
    this.stats = { totalAnswered: 0, streak: 0, bestStreak: 0 };
    this.shortcuts = new Map();
    
    this.initializeElements();
    this.setupEventListeners();
    this.loadPreloadedDecks();
    this.loadStats();
    this.setupKeyboardShortcuts();
  }

  initializeElements() {
    this.elements = {
      progressContainer: this.getElementById('progressContainer'),
      progressText: this.getElementById('progressText'),
      progressFill: this.getElementById('progressFill'),
      progressBar: this.getElementById('progressBar'),
      csvInput: this.getElementById('deckFile'),
      deckSelect: this.getElementById('deckSelect'),
      rangeSelect: this.getElementById('range'),
      questionDiv: this.getElementById('question'),
      instructionsDiv: this.getElementById('instructions'),
      commentDiv: this.getElementById('comment'),
      answerInput: this.getElementById('answerInput'),
      resultDiv: this.getElementById('result'),
      quizContainer: this.getElementById('quizContainer'),
      shuffleCheckbox: this.getElementById('shuffleMode'),
      conquestCheckbox: this.getElementById('conquestMode'),
      mainContainer: document.querySelector('.main-container')
    };

    // Créer le bouton de suppression
    this.createDeleteButton();
   this.toggleMainContainer(false);
    this.createMainToggleButton();
  }

  toggleMainContainer(forceState = null) {
  if (!this.elements.mainContainer) return;

  const isVisible = forceState !== null 
    ? forceState 
    : this.elements.mainContainer.style.display === 'none';

  this.elements.mainContainer.style.display = isVisible ? 'block' : 'none';
}

  getElementById(id) {
    const element = document.getElementById(id);
    if (!element) {
      console.warn(`Element with id '${id}' not found`);
    }
    return element;
  }

  setupEventListeners() {
    // Mode toggles avec debounce
    this.elements.shuffleCheckbox?.addEventListener('change', 
      this.debounce(() => this.toggleShuffleMode(), 100));
    
    this.elements.conquestCheckbox?.addEventListener('change', 
      this.debounce(() => this.toggleConquestMode(), 100));

    // Input handlers avec amélioration UX
    this.elements.answerInput?.addEventListener('keydown', (e) => this.handleAnswerInput(e));
    this.elements.answerInput?.addEventListener('input', () => this.updateInputStyling());
    
    this.elements.csvInput?.addEventListener('change', (e) => this.handleFileUpload(e));
    this.elements.deckSelect?.addEventListener('change', () => this.handleDeckChange());
    this.elements.rangeSelect?.addEventListener('change', () => this.filterQuestions());

    // Auto-focus management
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.elements.answerInput?.style.display !== 'none') {
        setTimeout(() => this.elements.answerInput?.focus(), 100);
      }
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ignorer si on tape dans un input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      
      switch(e.key) {
        case 's': case 'S':
          e.preventDefault();
          this.elements.shuffleCheckbox?.click();
          break;
        case 'c': case 'C':
          e.preventDefault();
          this.elements.conquestCheckbox?.click();
          break;
        case 'r': case 'R':
          e.preventDefault();
          if (e.ctrlKey) this.restartQuiz();
          break;
        case 'Escape':
          this.elements.answerInput?.blur();
          break;
      }
    });
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  createDeleteButton() {
    this.deleteDeckButton = document.createElement('button');
    this.deleteDeckButton.textContent = "選択したデッキを削除";
    this.deleteDeckButton.className = "delete-deck-btn";
    this.deleteDeckButton.style.cssText = `
      margin-left: 10px;
      font-size: 0.8rem;
      padding: 8px 12px;
      background-color: #cf6679;
      display: none;
      transition: all 0.2s ease;
    `;
    
    this.deleteDeckButton.addEventListener('click', () => this.deleteDeck());
    this.elements.deckSelect?.parentNode.insertBefore(
      this.deleteDeckButton, 
      this.elements.deckSelect.nextSibling
    );
  }

createMainToggleButton() {
  const btn = document.createElement('button');
  btn.textContent = "👁️";
  btn.className = "toggle-main-btn";
  btn.style.cssText = `
    position: fixed;
    top: 15px;
    right: 15px;
    padding: 8px 12px;
    background: #6200ee;
    color: white;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    z-index: 1100;
    font-size: 1.2rem;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  btn.addEventListener('click', () => this.toggleMainContainer());

  document.body.appendChild(btn);
}



  toggleShuffleMode() {
    this.shuffleMode = this.elements.shuffleCheckbox?.checked ?? true;
    this.showNotification(`シャッフルモード: ${this.shuffleMode ? 'ON' : 'OFF'}`, 'info');
    if (this.filteredQuestions.length > 0) {
      this.filterQuestions();
    }
  }

  toggleConquestMode() {
    this.conquestMode = this.elements.conquestCheckbox?.checked ?? false;
    this.showNotification(`コンクエストモード: ${this.conquestMode ? 'ON' : 'OFF'}`, 'info');
    if (this.conquestMode) {
      this.loadConquest();
    } else {
      localStorage.removeItem('conquestSession');
    }
  }

  handleAnswerInput(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const answer = this.elements.answerInput?.value.trim() || '';
      
      if (answer === '') {
        this.skipQuestion();
      } else {
        this.checkAnswer();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.showHint();
    }
  }

  updateInputStyling() {
    const input = this.elements.answerInput;
    if (!input) return;
    
    const value = input.value.trim();
    if (value.length > 0) {
      input.style.borderLeft = '4px solid #03dac6';
    } else {
      input.style.borderLeft = 'none';
    }
  }

  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      this.showNotification('ファイルを読み込み中...', 'info');
      
      const results = await this.parseCSVFile(file);
      const deckName = this.sanitizeFileName(file.name);
      
      if (results.data.length === 0) {
        throw new Error('ファイルにデータが見つかりません');
      }

      this.validateDeckData(results.data);
      
      this.decks[deckName] = { 
        data: results.data, 
        preloaded: false,
        uploadDate: new Date().toISOString()
      };
      
      this.updateDeckSelect();
      this.showNotification(`${deckName} を正常に読み込みました (${results.data.length}問)`, 'success');

      // 最初のデッキとして設定
      if (!this.elements.deckSelect?.dataset.activeDeck) {
        this.elements.deckSelect.value = deckName;
        this.elements.deckSelect.dataset.activeDeck = deckName;
        this.loadDeck(deckName, true);
      }
    } catch (error) {
      this.showNotification(`エラー: ${error.message}`, 'error');
      console.error('File upload error:', error);
    }
  }

  parseCSVFile(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: resolve,
        error: reject
      });
    });
  }

  sanitizeFileName(fileName) {
    return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  validateDeckData(data) {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('無効なデータ形式');
    }

    const requiredFields = ['Question', 'Answers'];
    const firstRow = data[0];
    
    for (const field of requiredFields) {
      if (!(field in firstRow)) {
        throw new Error(`必須フィールド '${field}' が見つかりません`);
      }
    }
  }

  handleDeckChange() {
    const deckName = this.elements.deckSelect?.value;
    if (deckName && this.decks[deckName]) {
      this.loadDeck(deckName, false);
    }
  }

  updateDeckSelect() {
    if (!this.elements.deckSelect) return;

    this.elements.deckSelect.innerHTML = '<option value="">デッキを読み込む...</option>';
    
    Object.entries(this.decks).forEach(([name, deck]) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = `${name} (${deck.data.length}問)${deck.preloaded ? ' [内蔵]' : ''}`;
      this.elements.deckSelect.appendChild(option);
    });

    this.updateDeleteButtonVisibility();
  }

  updateDeleteButtonVisibility() {
    const selectedDeck = this.elements.deckSelect?.value;
    const shouldShow = selectedDeck && 
                      this.decks[selectedDeck] && 
                      !this.decks[selectedDeck].preloaded;
    
    this.deleteDeckButton.style.display = shouldShow ? 'inline-block' : 'none';
  }

  loadDeck(deckName, shuffleAtLoad = false) {
    try {
      if (!this.decks[deckName]) {
        throw new Error(`デッキ '${deckName}' が見つかりません`);
      }

      this.elements.deckSelect.dataset.activeDeck = deckName;
      this.questions = [...this.decks[deckName].data]; // Create copy
      this.setupRangeOptions();
      this.filteredQuestions = [...this.questions];
      
      if (shuffleAtLoad && this.shuffleMode) {
        this.shuffleArray(this.filteredQuestions);
      }
      
      this.currentIndex = 0;
      this.correctCount = 0;
      this.missedQuestions = [];
      
      this.elements.quizContainer.style.display = 'block';
      this.elements.rangeSelect.style.display = 'block';
      
      this.showQuestion();
      this.showNotification(`${deckName}を開始しました`, 'success');
    } catch (error) {
      this.showNotification(`エラー: ${error.message}`, 'error');
    }
  }

  setupRangeOptions() {
    if (!this.elements.rangeSelect) return;

    this.elements.rangeSelect.innerHTML = '<option value="all">すべてのカード</option>';
    
    const step = 100; // Reduced step for better granularity
    for (let i = 0; i < this.questions.length; i += step) {
      const end = Math.min(i + step, this.questions.length);
      const option = document.createElement('option');
      option.value = `${i}-${end - 1}`;
      option.textContent = `${i + 1} — ${end}`;
      this.elements.rangeSelect.appendChild(option);
    }
  }

  filterQuestions() {
    const value = this.elements.rangeSelect?.value;
    
    if (value === 'all') {
      this.filteredQuestions = [...this.questions];
    } else {
      const [start, end] = value.split('-').map(Number);
      this.filteredQuestions = this.questions.slice(start, end + 1);
    }
    
    if (this.shuffleMode) {
      this.shuffleArray(this.filteredQuestions);
    }
    
    this.currentIndex = 0;
    this.correctCount = 0;
    this.showQuestion();
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  parseUnderline(text) {
    if (!text) return '';
    return String(text).replace(/__(.*?)__/g, '<u>$1</u>');
  }

  formatText(text) {
    if (!text) return '';
    let parsed = this.parseUnderline(text);
    return parsed.replace(/\n/g, '<br>');
  }

  showQuestion() {
    if (this.currentIndex < this.filteredQuestions.length) {
      const q = this.filteredQuestions[this.currentIndex];
      
      this.elements.questionDiv.innerHTML = this.parseUnderline(q.Question);
      this.elements.instructionsDiv.innerHTML = this.parseUnderline(q.Instructions || '');
      this.elements.answerInput.value = '';
      this.elements.resultDiv.textContent = '';
      this.elements.commentDiv.innerHTML = '';
      this.elements.answerInput.style.display = 'block';
      
      // Focus with slight delay for better UX
      setTimeout(() => this.elements.answerInput?.focus(), 50);
      
      this.updateProgress();
      this.saveConquest();
      
      // Add question counter to title
      document.title = `Quiz (${this.currentIndex + 1}/${this.filteredQuestions.length})`;
    } else {
      this.showResults();
    }
  }

  updateProgress() {
    if (!this.elements.progressContainer) return;

    this.elements.progressContainer.style.display = 'block';
    
    const current = this.currentIndex + 1;
    const total = this.filteredQuestions.length;
    const percent = Math.round((current / total) * 100);
    
    this.elements.progressText.textContent = `${current} / ${total} (${percent}%)`;
    this.elements.progressFill.style.width = `${percent}%`;
    
    // Enhanced color scheme
    const colors = [
      { threshold: 20, color: '#E0BBE4' },
      { threshold: 40, color: '#D291BC' },
      { threshold: 60, color: '#957DAD' },
      { threshold: 80, color: '#6A0572' },
      { threshold: 100, color: '#3C003C' }
    ];
    
    const color = colors.find(c => percent <= c.threshold)?.color || '#3C003C';
    this.elements.progressFill.style.background = color;

    // Responsive width
    if (this.elements.mainContainer) {
      const mainWidth = this.elements.mainContainer.offsetWidth;
      this.elements.progressBar.style.width = `${mainWidth}px`;
    }
  }

  checkAnswer() {
    const userAnswer = this.normalizeAnswer(this.elements.answerInput?.value || '');
    const correctAnswers = this.filteredQuestions[this.currentIndex].Answers
      .split(',')
      .map(a => this.normalizeAnswer(a.trim()))
      .filter(a => a.length > 0);

    if (correctAnswers.includes(userAnswer)) {
      this.handleCorrectAnswer();
    } else {
      this.handleIncorrectAnswer();
    }
    
    this.stats.totalAnswered++;
  }

  handleCorrectAnswer() {
    this.elements.resultDiv.textContent = '✅ 正解！';
    this.elements.resultDiv.style.color = '#4CAF50';
    this.elements.commentDiv.innerHTML = this.filteredQuestions[this.currentIndex].Comment || '';
    
    this.correctCount++;
    this.stats.streak++;
    
    if (this.stats.streak > this.stats.bestStreak) {
      this.stats.bestStreak = this.stats.streak;
      this.showNotification(`新記録のストリーク: ${this.stats.bestStreak}連続正解！`, 'success');
    }
    
    this.saveStats();
    
    // Visual feedback
    this.elements.answerInput.style.backgroundColor = '#1B5E20';
    setTimeout(() => {
      this.elements.answerInput.style.backgroundColor = '#1e1e1e';
      this.nextQuestion();
    }, 800);
  }

  handleIncorrectAnswer() {
    this.elements.resultDiv.textContent = `❌ 不正解 - 正解: ${this.filteredQuestions[this.currentIndex].Answers}`;
    this.elements.resultDiv.style.color = '#F44336';
    
    this.missedQuestions.push(this.filteredQuestions[this.currentIndex]);
    this.stats.streak = 0;
    
    // Visual feedback
    this.elements.answerInput.style.backgroundColor = '#B71C1C';
    this.elements.answerInput.value = '';
    
    setTimeout(() => {
      this.elements.answerInput.style.backgroundColor = '#1e1e1e';
      this.nextQuestion();
    }, 1500);
  }

  skipQuestion() {
    this.elements.resultDiv.textContent = '⏭️ スキップ';
    this.elements.resultDiv.style.color = '#FF9800';
    this.elements.commentDiv.textContent = `正解は: ${this.filteredQuestions[this.currentIndex].Answers}`;
    
    this.missedQuestions.push(this.filteredQuestions[this.currentIndex]);
    this.stats.streak = 0;
    
    setTimeout(() => this.nextQuestion(), 1000);
  }

  showHint() {
    const currentQ = this.filteredQuestions[this.currentIndex];
    const firstAnswer = currentQ.Answers.split(',')[0].trim();
    const hint = firstAnswer.substring(0, Math.ceil(firstAnswer.length / 3)) + '...';
    
    this.showNotification(`ヒント: ${hint}`, 'info');
  }

  normalizeAnswer(answer) {
    try {
      return wanakana.toHiragana(answer.trim().toLowerCase());
    } catch (error) {
      console.warn('Wanakana conversion failed:', error);
      return answer.trim().toLowerCase();
    }
  }

  nextQuestion() {
    this.currentIndex++;
    this.showQuestion();
  }

  showResults() {
    const total = this.filteredQuestions.length;
    const missed = this.missedQuestions.length;
    const success = this.correctCount;
    const percentSuccess = Math.round((success / total) * 100);

    // Enhanced results display
    this.elements.questionDiv.innerHTML = `
      <div class="results-container">
        <h2>📊 クイズ結果</h2>
        <div class="stats-grid">
          <div class="stat-item correct">
            <span class="stat-number">${success}</span>
            <span class="stat-label">正解</span>
          </div>
          <div class="stat-item incorrect">
            <span class="stat-number">${missed}</span>
            <span class="stat-label">不正解</span>
          </div>
          <div class="stat-item percentage">
            <span class="stat-number">${percentSuccess}%</span>
            <span class="stat-label">成功率</span>
          </div>
        </div>
        ${this.stats.bestStreak > 1 ? `<p>🔥 最高連続正解: ${this.stats.bestStreak}</p>` : ''}
      </div>
    `;

    this.elements.instructionsDiv.innerHTML = '';
    this.elements.answerInput.style.display = 'none';
    this.elements.progressContainer.style.display = 'none';
    document.title = 'Quiz - 完了';
    
    localStorage.removeItem('conquestSession');

    // Action buttons
    this.createResultButtons(missed > 0);
    
    // Performance message
    this.showPerformanceMessage(percentSuccess);
  }

  createResultButtons(hasMissed) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'result-buttons';
    buttonContainer.style.marginTop = '20px';

    if (hasMissed) {
      const reviewBtn = this.createButton('🔄 復習モード', () => this.startReview());
      buttonContainer.appendChild(reviewBtn);
    }

    const restartBtn = this.createButton('🔄 再開始', () => this.restartQuiz());
    const newDeckBtn = this.createButton('📚 新しいデッキ', () => this.resetForNewDeck());
    
    buttonContainer.appendChild(restartBtn);
    buttonContainer.appendChild(newDeckBtn);
    
    this.elements.questionDiv.appendChild(buttonContainer);
  }

  createButton(text, handler) {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.margin = '5px';
    button.addEventListener('click', handler);
    return button;
  }

  startReview() {
    this.filteredQuestions = [...this.missedQuestions];
    this.missedQuestions = [];
    this.currentIndex = 0;
    this.correctCount = 0;
    this.showQuestion();
    this.showNotification('復習モードを開始します', 'info');
  }

  restartQuiz() {
    this.currentIndex = 0;
    this.correctCount = 0;
    this.missedQuestions = [];
    this.filterQuestions();
    this.showNotification('クイズを再開始しました', 'info');
  }

  resetForNewDeck() {
    this.elements.quizContainer.style.display = 'none';
    this.elements.rangeSelect.style.display = 'none';
    this.elements.progressContainer.style.display = 'none';
    this.elements.deckSelect.dataset.activeDeck = '';
    this.elements.deckSelect.value = '';
    document.title = 'Quiz';
  }

  showPerformanceMessage(percentage) {
    let message, type;
    
    if (percentage >= 90) {
      message = '🏆 素晴らしい！完璧に近い成績です！';
      type = 'success';
    } else if (percentage >= 70) {
      message = '👍 良い成績です！';
      type = 'success';
    } else if (percentage >= 50) {
      message = '📚 もう少し頑張りましょう！';
      type = 'info';
    } else {
      message = '💪 練習を続けて頑張りましょう！';
      type = 'warning';
    }
    
    setTimeout(() => this.showNotification(message, type), 500);
  }

  saveConquest() {
    if (!this.conquestMode) return;
    
    try {
      const session = {
        currentIndex: this.currentIndex,
        filteredQuestions: this.filteredQuestions,
        correctCount: this.correctCount,
        missedQuestions: this.missedQuestions,
        timestamp: Date.now()
      };
      localStorage.setItem('conquestSession', JSON.stringify(session));
    } catch (error) {
      console.warn('Failed to save conquest session:', error);
    }
  }

  loadConquest() {
    try {
      const sessionData = localStorage.getItem('conquestSession');
      if (!sessionData) return;
      
      const session = JSON.parse(sessionData);
      
      // Check if session is not too old (24 hours)
      if (Date.now() - session.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem('conquestSession');
        return;
      }
      
      this.filteredQuestions = session.filteredQuestions || [];
      this.currentIndex = session.currentIndex || 0;
      this.correctCount = session.correctCount || 0;
      this.missedQuestions = session.missedQuestions || [];
      
      if (this.filteredQuestions.length > 0) {
        this.showQuestion();
        this.showNotification('前回のセッションを復元しました', 'info');
      }
    } catch (error) {
      console.warn('Failed to load conquest session:', error);
      localStorage.removeItem('conquestSession');
    }
  }

  deleteDeck() {
    const selectedDeck = this.elements.deckSelect?.value;
    if (!selectedDeck || !this.decks[selectedDeck] || this.decks[selectedDeck].preloaded) {
      return;
    }

    if (!confirm(`「${selectedDeck}」を削除しますか？`)) {
      return;
    }

    delete this.decks[selectedDeck];

    if (this.elements.deckSelect.dataset.activeDeck === selectedDeck) {
      this.resetForNewDeck();
    }

    this.updateDeckSelect();
    this.showNotification(`${selectedDeck}を削除しました`, 'info');
  }

  async loadPreloadedDecks() {
    const preloadedDecks = ["decks/jouyou.csv", "decks/non-jouyou.csv", "decks/non-jouyou_last_onyomi.csv"];
    
    for (const url of preloadedDecks) {
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        
        const csvText = await response.text();
        const deckName = url.split('/').pop();
        const results = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        
        this.decks[deckName] = { data: results.data, preloaded: true };
        
        this.updateDeckSelect();
        
        // Auto-load first deck
        if (!this.elements.deckSelect?.dataset.activeDeck) {
          this.elements.deckSelect.value = deckName;
          this.elements.deckSelect.dataset.activeDeck = deckName;
          this.updateDeckSelect();
          this.loadDeck(deckName, true);
        }
      } catch (error) {
        console.warn(`Failed to load preloaded deck ${url}:`, error);
      }
    }
  }

  saveStats() {
    try {
      localStorage.setItem('quizStats', JSON.stringify(this.stats));
    } catch (error) {
      console.warn('Failed to save stats:', error);
    }
  }

  loadStats() {
    try {
      const saved = localStorage.getItem('quizStats');
      if (saved) {
        this.stats = { ...this.stats, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Failed to load stats:', error);
    }
  }

  showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 1000;
      transform: translateX(100%);
      transition: transform 0.3s ease;
      max-width: 300px;
      word-wrap: break-word;
    `;
    
    // Type-specific styling
    const colors = {
      success: '#4CAF50',
      error: '#F44336',
      warning: '#FF9800',
      info: '#2196F3'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.style.transform = 'translateX(0)', 10);
    
    // Auto remove
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.quizManager = new QuizManager();
});

// Add CSS for enhanced styling and inject it
const additionalStyles = `
  .results-container {
    text-align: center;
    padding: 20px;
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 20px;
    margin: 20px 0;
  }
  
  .stat-item {
    padding: 15px;
    border-radius: 10px;
    text-align: center;
    transition: transform 0.2s ease;
  }
  
  .stat-item:hover {
    transform: translateY(-2px);
  }
  
  .stat-item.correct { background-color: #1B5E20; }
  .stat-item.incorrect { background-color: #B71C1C; }
  .stat-item.percentage { background-color: #1565C0; }
  
  .stat-number {
    display: block;
    font-size: 2em;
    font-weight: bold;
  }
  
  .stat-label {
    display: block;
    font-size: 0.9em;
    opacity: 0.8;
  }
  
  .result-buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }
  
  .delete-deck-btn:hover {
    background-color: #B71C1C !important;
    transform: scale(1.05);
  }
  
  .quiz-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 15px;
  }
  
  .question-number {
    background: #6200ee;
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.9em;
    font-weight: bold;
  }
  
  .streak-display {
    background: linear-gradient(45deg, #ff6b6b, #ffd93d);
    color: white;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.8em;
    font-weight: bold;
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
  
  .input-container {
    position: relative;
    margin: 15px 0;
  }
  
  .input-helper {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: #666;
    font-size: 0.8em;
    pointer-events: none;
  }
  
  .question-card {
    background: linear-gradient(135deg, #1e1e1e, #2a2a2a);
    border-radius: 15px;
    padding: 20px;
    margin: 10px 0;
    border-left: 4px solid #bb86fc;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }
  
  .mode-toggle {
    display: flex;
    align-items: center;
    gap: 15px;
    margin: 10px 0;
    flex-wrap: wrap;
  }
  
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 50px;
    height: 24px;
  }
  
  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: .4s;
    border-radius: 24px;
  }
  
  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: .4s;
    border-radius: 50%;
  }
  
  input:checked + .toggle-slider {
    background-color: #bb86fc;
  }
  
  input:checked + .toggle-slider:before {
    transform: translateX(26px);
  }
  
  .deck-info {
    background: #2a2a2a;
    padding: 10px 15px;
    border-radius: 8px;
    margin: 10px 0;
    font-size: 0.9em;
    color: #ccc;
  }
  
  .loading-spinner {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #bb86fc;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 10px;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .shortcuts-help {
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 10px;
    border-radius: 8px;
    font-size: 0.8em;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  .shortcuts-help.show {
    opacity: 1;
  }
  
  @media (max-width: 480px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }
    
    .notification {
      right: 10px !important;
      left: 10px !important;
      max-width: none !important;
    }
    
    .quiz-header {
      flex-direction: column;
      gap: 10px;
    }
    
    .mode-toggle {
      justify-content: center;
    }
    
    .shortcuts-help {
      position: relative;
      bottom: auto;
      left: auto;
      margin: 10px 0;
    }
  }
  
  .answer-feedback {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 3em;
    font-weight: bold;
    opacity: 0;
    transition: all 0.5s ease;
    pointer-events: none;
    z-index: 100;
  }
  
  .answer-feedback.show {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.2);
  }
  
  .answer-feedback.correct {
    color: #4CAF50;
    text-shadow: 0 0 20px #4CAF50;
  }
  
  .answer-feedback.incorrect {
    color: #F44336;
    text-shadow: 0 0 20px #F44336;
  }

  .toggle-main-btn {
  transition: transform 0.2s ease;
}
.toggle-main-btn:active {
  transform: scale(0.9);
}

@media (max-width: 480px) {
  .toggle-main-btn {
    top: 10px !important;
    right: 10px !important;
    padding: 6px 10px !important;
    font-size: 1rem !important;
  }
}

`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

