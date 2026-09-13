// Interactive Quiz Controller: 5-question practice quiz with instant feedback and distractor explanations

export class QuizController {
  constructor(containerEl, questions = [], onScoreUpdate = () => {}) {
    this.container = containerEl;
    this.questions = questions;
    this.currentIndex = 0;
    this.answers = {}; // { questionId: selectedIndex }
    this.flagged = new Set(); // { questionIndex }
    this.mode = 'stepper'; // 'stepper' or 'all'
    this.onScoreUpdate = onScoreUpdate;
    this.isCompleted = false;
    this.startTime = Date.now();
    this.timerInterval = null;
    this.elapsedSeconds = 0;

    this.startTimer();
    this.bindKeyboardShortcuts();
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.elapsedSeconds = 0;
    this.timerInterval = setInterval(() => {
      if (!this.isCompleted) {
        this.elapsedSeconds++;
        const timerEl = document.getElementById('quizTimerDisplay');
        if (timerEl) {
          const mins = Math.floor(this.elapsedSeconds / 60);
          const secs = this.elapsedSeconds % 60;
          timerEl.textContent = `⏱️ ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
      }
    }, 1000);
  }

  bindKeyboardShortcuts() {
    // Clean up any existing listener
    if (window._quizKeyHandler) {
      window.removeEventListener('keydown', window._quizKeyHandler);
    }

    window._quizKeyHandler = (e) => {
      // Don't intercept if user is typing in an input/textarea or modal is open
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const quizPanel = document.getElementById('quizPanel');
      if (!quizPanel || quizPanel.classList.contains('hidden')) return;

      const key = e.key.toUpperCase();
      if (this.mode === 'stepper' && !this.isCompleted) {
        if (key === 'A' || key === '1') this.selectOption(this.currentIndex, 0);
        else if (key === 'B' || key === '2') this.selectOption(this.currentIndex, 1);
        else if (key === 'C' || key === '3') this.selectOption(this.currentIndex, 2);
        else if (key === 'D' || key === '4') this.selectOption(this.currentIndex, 3);
        else if (key === 'F') this.toggleFlag(this.currentIndex);
        else if (e.key === 'ArrowRight' || e.key === 'Enter') {
          if (this.answers[this.currentIndex] !== undefined) {
            if (this.currentIndex < this.questions.length - 1) this.nextQuestion();
            else this.finishQuiz();
          }
        } else if (e.key === 'ArrowLeft') {
          if (this.currentIndex > 0) this.prevQuestion();
        }
      }
    };

    window.addEventListener('keydown', window._quizKeyHandler);
  }

  toggleFlag(qIndex) {
    if (this.flagged.has(qIndex)) {
      this.flagged.delete(qIndex);
    } else {
      this.flagged.add(qIndex);
    }
    this.render();
  }

  setQuestions(questions) {
    this.questions = questions;
    this.currentIndex = 0;
    this.answers = {};
    this.flagged.clear();
    this.isCompleted = false;
    this.startTimer();
    this.render();
  }

  setMode(mode) {
    this.mode = mode;
    this.render();
  }

  selectOption(qIndex, optionIndex) {
    // If already answered this question, do not allow changing answer
    if (this.answers[qIndex] !== undefined) return;

    this.answers[qIndex] = optionIndex;

    // Check if all 5 questions are answered
    if (Object.keys(this.answers).length === this.questions.length) {
      this.isCompleted = true;
    }

    this.onScoreUpdate({
      score: this.getScore(),
      total: this.questions.length,
      answeredCount: Object.keys(this.answers).length,
      isCompleted: this.isCompleted
    });

    this.render();
  }

  getScore() {
    let score = 0;
    this.questions.forEach((q, idx) => {
      if (this.answers[idx] === q.correctIndex) {
        score++;
      }
    });
    return score;
  }

  nextQuestion() {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      this.render();
    }
  }

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.render();
    }
  }

  retakeQuiz() {
    this.answers = {};
    this.flagged.clear();
    this.currentIndex = 0;
    this.isCompleted = false;
    this.startTimer();
    this.onScoreUpdate({
      score: 0,
      total: this.questions.length,
      answeredCount: 0,
      isCompleted: false
    });
    this.render();
  }

  render() {
    if (!this.container) return;
    if (!this.questions || this.questions.length === 0) {
      this.container.innerHTML = `<div class="empty-quiz-state">No quiz questions generated yet.</div>`;
      return;
    }

    if (this.isCompleted && this.mode === 'stepper') {
      this.renderCompletedSummary();
      return;
    }

    if (this.mode === 'stepper') {
      this.renderStepper();
    } else {
      this.renderAllQuestions();
    }
  }

  renderStepper() {
    const q = this.questions[this.currentIndex];
    const userAnswer = this.answers[this.currentIndex];
    const isAnswered = userAnswer !== undefined;
    const isCorrect = isAnswered && userAnswer === q.correctIndex;
    const total = this.questions.length;
    const score = this.getScore();

    const isFlagged = this.flagged.has(this.currentIndex);
    const mins = Math.floor(this.elapsedSeconds / 60);
    const secs = this.elapsedSeconds % 60;
    const timeFormatted = `⏱️ ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    let optionsHtml = q.options.map((opt, optIdx) => {
      let stateClass = "";
      let badgeIcon = String.fromCharCode(65 + optIdx); // A, B, C, D

      if (isAnswered) {
        if (optIdx === q.correctIndex) {
          stateClass = "correct-choice";
          badgeIcon = "✓";
        } else if (optIdx === userAnswer) {
          stateClass = "incorrect-choice";
          badgeIcon = "✕";
        } else {
          stateClass = "neutral-disabled";
        }
      }

      return `
        <button class="quiz-option-btn ${stateClass}" 
                data-opt="${optIdx}" 
                ${isAnswered ? 'disabled' : ''} 
                onclick="window.studyPulseQuiz.selectOption(${this.currentIndex}, ${optIdx})">
          <span class="option-letter-badge">${badgeIcon}</span>
          <span class="option-text">${this.escapeHtml(opt)}</span>
          <span class="option-key-hint">[${String.fromCharCode(65 + optIdx)}]</span>
        </button>
      `;
    }).join("");

    let explanationHtml = "";
    if (isAnswered) {
      const distractorNote = q.distractorExplanations?.[userAnswer] || "";
      explanationHtml = `
        <div class="quiz-explanation-box ${isCorrect ? 'exp-correct' : 'exp-incorrect'} animate-fade-in">
          <div class="exp-header">
            <span class="exp-badge ${isCorrect ? 'badge-success' : 'badge-danger'}">
              ${isCorrect ? '✓ Spot on!' : '✕ Concept Misconception'}
            </span>
            <span class="exp-citation">📖 ${this.escapeHtml(q.citation || 'Lecture Reference')}</span>
          </div>
          <div class="exp-body">
            <p class="exp-correct-text"><strong>Why it's correct:</strong> ${this.escapeHtml(q.explanation)}</p>
            ${!isCorrect && distractorNote ? `<p class="exp-distractor-text"><strong>Why your choice was wrong:</strong> ${this.escapeHtml(distractorNote)}</p>` : ''}
          </div>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="quiz-card animate-card">
        <div class="quiz-meta-header">
          <div class="quiz-progress-indicator">
            <span class="q-number-pill">Question ${this.currentIndex + 1} of ${total}</span>
            <span class="q-score-pill">Score: ${score}/${Object.keys(this.answers).length} answered</span>
            <span class="q-timer-pill" id="quizTimerDisplay">${timeFormatted}</span>
          </div>
          <div class="quiz-mode-toggles">
            <button class="btn-flag-q ${isFlagged ? 'flagged' : ''}" 
                    title="Flag for later review (or press F)"
                    onclick="window.studyPulseQuiz.toggleFlag(${this.currentIndex})">
              ${isFlagged ? '🚩 Flagged' : '🏳️ Flag'}
            </button>
            <button class="btn-mode-toggle active" title="Stepper View">Single</button>
            <button class="btn-mode-toggle" onclick="window.studyPulseQuiz.setMode('all')" title="Full Sheet View">All 5</button>
          </div>
        </div>

        <div class="quiz-progress-bar-wrap">
          <div class="quiz-progress-bar" style="width: ${((this.currentIndex + 1) / total) * 100}%"></div>
        </div>

        <div class="quiz-question-body">
          <h3 class="quiz-question-title">${this.escapeHtml(q.question)}</h3>
          <div class="quiz-keyboard-shortcuts-bar">
            <span>⌨️ Keyboard: Press [A], [B], [C], [D] to pick • [F] to flag • [→] / [Enter] for next</span>
          </div>
        </div>

        <div class="quiz-options-list">
          ${optionsHtml}
        </div>

        ${explanationHtml}

        <div class="quiz-navigation-footer">
          <button class="btn-quiz-nav btn-prev" 
                  ${this.currentIndex === 0 ? 'disabled' : ''} 
                  onclick="window.studyPulseQuiz.prevQuestion()">
            ← Previous
          </button>
          
          ${this.currentIndex < total - 1 ? `
            <button class="btn-quiz-nav btn-next" 
                    ${!isAnswered ? 'disabled' : ''} 
                    onclick="window.studyPulseQuiz.nextQuestion()">
              Next Question →
            </button>
          ` : `
            <button class="btn-quiz-nav btn-finish" 
                    ${!isAnswered ? 'disabled' : ''} 
                    onclick="window.studyPulseQuiz.finishQuiz()">
              View Scorecard 🏆
            </button>
          `}
        </div>
      </div>
    `;
  }

  renderAllQuestions() {
    const total = this.questions.length;
    const score = this.getScore();
    const answeredCount = Object.keys(this.answers).length;

    let questionsHtml = this.questions.map((q, idx) => {
      const userAnswer = this.answers[idx];
      const isAnswered = userAnswer !== undefined;
      const isCorrect = isAnswered && userAnswer === q.correctIndex;

      let optionsHtml = q.options.map((opt, optIdx) => {
        let stateClass = "";
        let badgeIcon = String.fromCharCode(65 + optIdx);

        if (isAnswered) {
          if (optIdx === q.correctIndex) {
            stateClass = "correct-choice";
            badgeIcon = "✓";
          } else if (optIdx === userAnswer) {
            stateClass = "incorrect-choice";
            badgeIcon = "✕";
          } else {
            stateClass = "neutral-disabled";
          }
        }

        return `
          <button class="quiz-option-btn ${stateClass}" 
                  data-opt="${optIdx}" 
                  ${isAnswered ? 'disabled' : ''} 
                  onclick="window.studyPulseQuiz.selectOption(${idx}, ${optIdx})">
            <span class="option-letter-badge">${badgeIcon}</span>
            <span class="option-text">${this.escapeHtml(opt)}</span>
          </button>
        `;
      }).join("");

      let explanationHtml = "";
      if (isAnswered) {
        const distractorNote = q.distractorExplanations?.[userAnswer] || "";
        explanationHtml = `
          <div class="quiz-explanation-box ${isCorrect ? 'exp-correct' : 'exp-incorrect'} animate-fade-in">
            <div class="exp-header">
              <span class="exp-badge ${isCorrect ? 'badge-success' : 'badge-danger'}">
                ${isCorrect ? '✓ Correct' : '✕ Misconception'}
              </span>
              <span class="exp-citation">📖 ${this.escapeHtml(q.citation || 'Lecture Citation')}</span>
            </div>
            <div class="exp-body">
              <p class="exp-correct-text"><strong>Explanation:</strong> ${this.escapeHtml(q.explanation)}</p>
              ${!isCorrect && distractorNote ? `<p class="exp-distractor-text"><strong>Why choice was wrong:</strong> ${this.escapeHtml(distractorNote)}</p>` : ''}
            </div>
          </div>
        `;
      }

      return `
        <div class="quiz-sheet-item ${isAnswered ? (isCorrect ? 'item-correct' : 'item-incorrect') : ''}">
          <div class="sheet-item-header">
            <span class="sheet-q-num">Q${idx + 1}</span>
            <h4 class="sheet-q-title">${this.escapeHtml(q.question)}</h4>
          </div>
          <div class="quiz-options-list">
            ${optionsHtml}
          </div>
          ${explanationHtml}
        </div>
      `;
    }).join("");

    this.container.innerHTML = `
      <div class="quiz-sheet-container">
        <div class="quiz-meta-header">
          <div class="quiz-progress-indicator">
            <span class="q-number-pill">Full Sheet: ${answeredCount}/${total} Answered</span>
            <span class="q-score-pill">Score: ${score}/${total}</span>
          </div>
          <div class="quiz-mode-toggles">
            <button class="btn-mode-toggle" onclick="window.studyPulseQuiz.setMode('stepper')">Single</button>
            <button class="btn-mode-toggle active">All 5</button>
          </div>
        </div>

        <div class="quiz-sheet-list">
          ${questionsHtml}
        </div>

        ${answeredCount === total ? `
          <div class="quiz-sheet-summary-banner animate-fade-in">
            <div class="summary-score-text">Final Score: <strong>${score} / ${total}</strong> (${Math.round((score/total)*100)}%)</div>
            <button class="btn-retake-quiz" onclick="window.studyPulseQuiz.retakeQuiz()">↻ Retake Practice Quiz</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  finishQuiz() {
    this.isCompleted = true;
    this.renderCompletedSummary();
  }

  renderCompletedSummary() {
    const total = this.questions.length;
    const score = this.getScore();
    const percent = Math.round((score / total) * 100);
    const mins = Math.floor(this.elapsedSeconds / 60);
    const secs = this.elapsedSeconds % 60;
    const timeSpent = `${mins}m ${secs}s`;

    let badgeTitle = "";
    let badgeDesc = "";
    let badgeEmoji = "🎯";

    if (score === 5) {
      badgeEmoji = "🏆";
      badgeTitle = "Exam Mastery (100%)";
      badgeDesc = "Flawless concept grasp! You are completely ready for exam questions on this material.";
    } else if (score >= 4) {
      badgeEmoji = "⭐";
      badgeTitle = "High Proficiency (80%)";
      badgeDesc = "Strong command of core mechanisms. Review the 1 question you missed in the revision notes.";
    } else if (score >= 3) {
      badgeEmoji = "📈";
      badgeTitle = "Solid Foundation (60%)";
      badgeDesc = "Good intuition, but pay close attention to the Exam Traps & Boundary Conditions in your notes.";
    } else {
      badgeEmoji = "💡";
      badgeTitle = "Needs Review (<60%)";
      badgeDesc = "We recommend switching study mode to 'First-Principles' and re-reading the step-by-step mechanisms.";
    }

    this.container.innerHTML = `
      <div class="quiz-summary-card animate-card ${score === 5 ? 'perfect-score' : ''}">
        <div class="summary-trophy-icon">${badgeEmoji}</div>
        <h2 class="summary-title">${badgeTitle}</h2>
        <div class="summary-meta-badges">
          <span class="stat-pill">⏱️ Time: ${timeSpent}</span>
          <span class="stat-pill">🎯 Accuracy: ${percent}%</span>
          ${this.flagged.size > 0 ? `<span class="stat-pill flagged-pill">🚩 ${this.flagged.size} Flagged</span>` : ''}
        </div>
        <div class="summary-score-display">
          <span class="big-score">${score}</span>
          <span class="score-divider">/</span>
          <span class="score-total">${total}</span>
        </div>
        <p class="summary-desc">${badgeDesc}</p>

        <div class="summary-breakdown-list">
          ${this.questions.map((q, idx) => {
            const correct = this.answers[idx] === q.correctIndex;
            const flagged = this.flagged.has(idx);
            return `
              <div class="breakdown-row ${correct ? 'row-correct' : 'row-incorrect'}">
                <span class="breakdown-status">${correct ? '✓' : '✕'}</span>
                <span class="breakdown-label">${flagged ? '🚩 ' : ''}Q${idx + 1}: ${this.escapeHtml(q.question.slice(0, 75))}...</span>
                <span class="breakdown-tag">${correct ? '+1 pt' : 'Missed'}</span>
              </div>
            `;
          }).join('')}
        </div>

        <div class="summary-action-btns">
          <button class="btn-retake-quiz" onclick="window.studyPulseQuiz.retakeQuiz()">
            ↻ Retake Quiz
          </button>
          <button class="btn-review-sheet" onclick="window.studyPulseQuiz.setMode('all')">
            🔍 Review All Explanations
          </button>
          <button class="btn-jump-notes" onclick="window.studyPulseApp.switchTab('notes')">
            📝 Jump to Revision Notes
          </button>
        </div>
      </div>
    `;
  }

  escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
