import { LectureParser } from './parser.js';
import { AIEngine } from './ai-engine.js';
import { QuizController } from './quiz.js';
import { Exporter } from './exporter.js';
import { ParticleNetwork } from './particles.js';

class StudyPulseApp {
  constructor() {
    this.state = {
      rawText: "",
      filename: "",
      fileType: "NONE",
      pages: [],
      stats: { words: 0, chars: 0, estMins: 0, pageCount: 0 },
      subject: "cs",
      style: "exam_cram",
      level: "undergrad",
      apiKey: localStorage.getItem("studypulse_api_key") || "",
      activeTab: "notes",
      synthesis: null,
      masteredTerms: new Set(),
      isProcessing: false,
      currentStep: 1,
      viewMode: 'text' // 'text' or 'pages'
    };

    this.quizController = null;
    this.speechUtterance = null;
    this.isSpeaking = false;
    this.speechRate = 1.2;

    this.initElements();
    this.bindEvents();

    // Initialize subtle interactive particle background
    this.particleNetwork = new ParticleNetwork('particleNetworkCanvas');

    // Expose app instance globally for inline onclick handlers
    window.studyPulseApp = this;

    // Initial state: Step 1 awaiting user PDF upload
    this.updateStats();
    this.updateStepper(1);
  }

  initElements() {
    this.dropZone = document.getElementById('dropZone');
    this.fileInput = document.getElementById('fileInput');
    this.pastedTextArea = document.getElementById('pastedText');
    this.wordCountBadge = document.getElementById('wordCountBadge');
    this.estTimeBadge = document.getElementById('estTimeBadge');
    this.pageCountBadge = document.getElementById('pageCountBadge');
    this.extractedStatsBadge = document.getElementById('extractedStatsBadge');
    this.fileNameBadge = document.getElementById('fileNameBadge');
    this.generateBtn = document.getElementById('generateBtn');
    this.subjectSelect = document.getElementById('subjectSelect');
    this.styleSelect = document.getElementById('styleSelect');
    this.levelSelect = document.getElementById('levelSelect');

    // Extracted content view
    this.extractedContentPanel = document.getElementById('extractedContentPanel');
    this.pageByPageView = document.getElementById('pageByPageView');
    this.togglePageViewBtn = document.getElementById('togglePageViewBtn');

    // Audio elements
    this.audioPlayBtn = document.getElementById('audioPlayBtn');
    this.audioIcon = document.getElementById('audioIcon');
    this.audioLabel = document.getElementById('audioLabel');
    this.audioWaveform = document.getElementById('audioWaveform');

    // View panels
    this.inputSection = document.getElementById('inputSection');
    this.progressSection = document.getElementById('progressSection');
    this.outputSection = document.getElementById('outputSection');
    this.progressFill = document.getElementById('progressFill');
    this.progressStageText = document.getElementById('progressStageText');
    this.progressPercentText = document.getElementById('progressPercentText');

    // Notes & Quiz containers
    this.notesTabBtn = document.getElementById('notesTabBtn');
    this.quizTabBtn = document.getElementById('quizTabBtn');
    this.notesPanel = document.getElementById('notesPanel');
    this.quizPanel = document.getElementById('quizPanel');
    this.quizBadgeCount = document.getElementById('quizBadgeCount');

    // Settings Modal
    this.settingsModal = document.getElementById('settingsModal');
    this.apiKeyInput = document.getElementById('apiKeyInput');
    if (this.apiKeyInput && this.state.apiKey) {
      this.apiKeyInput.value = this.state.apiKey;
    }
  }

  bindEvents() {
    // Drag and drop handlers
    if (this.dropZone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        this.dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.dropZone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        this.dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.dropZone.classList.remove('dragover');
        });
      });

      this.dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
          this.handleFile(files[0]);
        }
      });
    }

    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.handleFile(e.target.files[0]);
        }
      });
    }

    if (this.pastedTextArea) {
      this.pastedTextArea.addEventListener('input', () => {
        this.state.rawText = this.pastedTextArea.value;
        this.state.filename = "Custom_Pasted_Lecture.txt";
        this.state.fileType = "PASTE";
        this.state.pages = LectureParser.chunkTextIntoPages(this.state.rawText);
        this.updateStats();
        this.updateStepper(2);
      });
    }

    // Personalization controls
    if (this.subjectSelect) {
      this.subjectSelect.addEventListener('change', (e) => {
        this.state.subject = e.target.value;
        this.showToast(`Subject updated to: ${e.target.options[e.target.selectedIndex].text}`, 'info');
      });
    }

    if (this.styleSelect) {
      this.styleSelect.addEventListener('change', (e) => {
        this.state.style = e.target.value;
        this.showToast(`Study persona set to: ${e.target.options[e.target.selectedIndex].text}`, 'info');
      });
    }

    if (this.levelSelect) {
      this.levelSelect.addEventListener('change', (e) => {
        this.state.level = e.target.value;
      });
    }

    if (this.generateBtn) {
      this.generateBtn.addEventListener('click', () => {
        this.startSynthesis();
      });
    }

    // Dismiss PDF dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#pdfDropdownWrap')) {
        this.closePdfMenu();
      }
    });
  }

  /**
   * Handle uploaded file
   */
  async handleFile(file) {
    this.showToast(`Parsing ${file.name}...`, 'info');
    try {
      const parsed = await LectureParser.parseFile(file);
      this.state.rawText = parsed.text;
      this.state.pages = parsed.pages || [];
      this.state.filename = parsed.filename;
      this.state.fileType = parsed.type;

      if (this.pastedTextArea) {
        this.pastedTextArea.value = parsed.text;
      }

      this.updateStats();
      this.updateStepper(2);
      this.showToast(`Extracted ${parsed.stats.words.toLocaleString()} words from ${file.name}`, 'success');

      // Smoothly scroll to extracted content so the student sees extraction succeeded
      if (this.extractedContentPanel) {
        this.extractedContentPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch (err) {
      console.error(err);
      this.showToast(`Error parsing file: ${err.message}`, 'error');
    }
  }

  updateStats() {
    this.state.stats = LectureParser.getStats(this.state.rawText);
    const hasText = Boolean(this.state.rawText && this.state.rawText.trim().length > 0);

    if (this.wordCountBadge) {
      this.wordCountBadge.textContent = hasText ? `${this.state.stats.words.toLocaleString()} words` : "0 words";
    }
    if (this.estTimeBadge) {
      this.estTimeBadge.textContent = hasText ? `~${this.state.stats.estMins} min lecture` : "--";
    }
    if (this.pageCountBadge) {
      const pCount = hasText ? (this.state.pages?.length || this.state.stats.pageCount || 1) : 0;
      this.pageCountBadge.textContent = `${pCount} ${pCount === 1 ? 'page' : 'pages'}`;
    }
    if (this.extractedStatsBadge) {
      const pCount = hasText ? (this.state.pages?.length || this.state.stats.pageCount || 1) : 0;
      this.extractedStatsBadge.textContent = `${pCount} Pages • ${hasText ? this.state.stats.words.toLocaleString() : 0} Words`;
    }
    if (this.fileNameBadge) {
      this.fileNameBadge.textContent = this.state.filename || "No lecture file uploaded";
    }
    this.renderPagesView();
  }

  /**
   * Render slide/page cards in Extracted Content Inspector
   */
  renderPagesView() {
    if (!this.pageByPageView) return;
    if (!this.state.rawText || this.state.rawText.trim().length === 0) {
      this.pageByPageView.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.9rem;">
          <span>📄</span>
          <p style="margin-top: 0.5rem;">No lecture file uploaded yet. Drop or select a PDF above to extract its slides and content.</p>
        </div>
      `;
      return;
    }
    const pages = this.state.pages && this.state.pages.length > 0 ? 
      this.state.pages : 
      LectureParser.chunkTextIntoPages(this.state.rawText);

    this.pageByPageView.innerHTML = pages.map(p => `
      <div class="extracted-page-card">
        <div class="page-card-header">
          <span class="page-num-pill">Slide / Page ${p.pageNum}</span>
          <span class="page-word-stat">${p.text.split(/\s+/).filter(Boolean).length} words</span>
        </div>
        <div class="page-card-body">${this.escapeHtml(p.text)}</div>
      </div>
    `).join('');
  }

  toggleExtractedView() {
    if (!this.pageByPageView || !this.pastedTextArea) return;
    const isShowingPages = !this.pageByPageView.classList.contains('hidden');
    if (isShowingPages) {
      this.pageByPageView.classList.add('hidden');
      this.pastedTextArea.classList.remove('hidden');
      if (this.togglePageViewBtn) this.togglePageViewBtn.textContent = "View by Slides/Pages";
    } else {
      this.renderPagesView();
      this.pageByPageView.classList.remove('hidden');
      this.pastedTextArea.classList.add('hidden');
      if (this.togglePageViewBtn) this.togglePageViewBtn.textContent = "View Raw Text";
    }
  }

  async copyExtractedText() {
    if (!this.state.rawText) return;
    try {
      await navigator.clipboard.writeText(this.state.rawText);
      this.showToast("Extracted lecture text copied to clipboard!", "success");
    } catch {
      this.showToast("Copied text via fallback", "info");
    }
  }

  /**
   * Stepper navigation
   */
  goToStep(stepNum) {
    this.updateStepper(stepNum);
    if (stepNum === 1) {
      this.inputSection?.classList.remove('hidden');
      this.dropZone?.scrollIntoView({ behavior: 'smooth' });
    } else if (stepNum === 2) {
      this.inputSection?.classList.remove('hidden');
      this.extractedContentPanel?.scrollIntoView({ behavior: 'smooth' });
    } else if (stepNum === 3) {
      if (this.state.synthesis) {
        this.inputSection?.classList.add('hidden');
        this.outputSection?.classList.remove('hidden');
        this.switchTab('notes');
      } else {
        this.showToast("Click 'Generate Revision Suite' below first.", "info");
      }
    } else if (stepNum === 4) {
      if (this.state.synthesis) {
        this.inputSection?.classList.add('hidden');
        this.outputSection?.classList.remove('hidden');
        this.switchTab('quiz');
      } else {
        this.showToast("Click 'Generate Revision Suite' below first.", "info");
      }
    }
  }

  updateStepper(activeStep) {
    this.state.currentStep = activeStep;
    for (let i = 1; i <= 4; i++) {
      const stepEl = document.getElementById(`stepIndicator${i}`);
      const lineEl = document.getElementById(`stepperLine${i}`);
      if (stepEl) {
        stepEl.classList.toggle('active', i === activeStep);
        stepEl.classList.toggle('completed', i < activeStep);
      }
      if (lineEl) {
        lineEl.classList.toggle('completed', i < activeStep);
      }
    }
  }

  /**
   * Run the AI Synthesis flow
   */
  async startSynthesis() {
    if (!this.state.rawText || this.state.rawText.trim().length < 50) {
      this.showToast("Please upload a lecture PDF or document first.", "warning");
      return;
    }

    this.state.isProcessing = true;
    this.inputSection.classList.add('hidden');
    this.outputSection.classList.add('hidden');
    this.progressSection.classList.remove('hidden');

    // Scroll smoothly to progress
    this.progressSection.scrollIntoView({ behavior: 'smooth' });

    try {
      const result = await AIEngine.synthesize(
        this.state.rawText,
        {
          subject: this.state.subject,
          style: this.state.style,
          level: this.state.level,
          apiKey: this.state.apiKey
        },
        (progress) => {
          if (this.progressFill) this.progressFill.style.width = `${progress.percent}%`;
          if (this.progressStageText) this.progressStageText.textContent = progress.message;
          if (this.progressPercentText) this.progressPercentText.textContent = `${progress.percent}%`;
        }
      );

      this.state.synthesis = result;
      this.state.masteredTerms.clear();

      await new Promise(r => setTimeout(r, 350));
      this.renderOutputs();
      this.updateStepper(3);

      this.progressSection.classList.add('hidden');
      this.outputSection.classList.remove('hidden');
      this.outputSection.scrollIntoView({ behavior: 'smooth' });
      this.showToast("Revision pack & 5-question quiz generated successfully!", "success");
    } catch (err) {
      console.error("Synthesis failed:", err);
      this.showToast(`Generation failed: ${err.message}`, "error");
      this.progressSection.classList.add('hidden');
      this.inputSection.classList.remove('hidden');
    } finally {
      this.state.isProcessing = false;
    }
  }

  /**
   * Render Notes & Quiz views
   */
  renderOutputs() {
    const data = this.state.synthesis;
    if (!data) return;

    // Header metadata
    const lectureTitleEl = document.getElementById('outputLectureTitle');
    const lectureMetaEl = document.getElementById('outputLectureMeta');
    if (lectureTitleEl) lectureTitleEl.textContent = data.metadata.title;
    if (lectureMetaEl) {
      lectureMetaEl.innerHTML = `
        <span class="meta-tag subject-tag">${data.metadata.subject.toUpperCase()}</span>
        <span class="meta-tag style-tag">${AIEngine.getStyleLabel(data.metadata.style)}</span>
        <span class="meta-tag level-tag">${data.metadata.level.toUpperCase()}</span>
        <span class="meta-tag words-tag">${data.metadata.wordCount} words</span>
      `;
    }

    // Render Revision Notes
    this.renderRevisionNotes(data.notes);

    // Initialize Quiz Controller
    const quizMountEl = document.getElementById('quizMount');
    if (quizMountEl) {
      this.quizController = new QuizController(quizMountEl, data.quiz, (scoreData) => {
        if (this.quizBadgeCount) {
          this.quizBadgeCount.textContent = `${scoreData.score}/${scoreData.total}`;
        }
      });
      window.studyPulseQuiz = this.quizController;
      this.quizController.render();
    }

    // Default to notes tab
    this.switchTab(this.state.activeTab || 'notes');
  }

  renderRevisionNotes(notes) {
    const container = document.getElementById('notesContentArea');
    if (!container) return;

    const quickSummary = notes.quickSummary || notes.execSummary || "No summary available.";
    const concepts = notes.importantConcepts || [];
    const definitions = notes.keyDefinitions || notes.terms || [];
    const formulas = notes.importantFormulas || [];
    const examTips = notes.examTips || (notes.pitfalls ? notes.pitfalls.map(p => `Common confusion: ${p.trap} — remember that ${p.fix}`) : []);
    const takeaways = notes.keyTakeaways || notes.cheatSheet || [];

    let html = '';

    // Section 1: Quick Summary
    html += `
      <section class="note-card quick-summary-card animate-card" aria-labelledby="heading-quick-summary">
        <div class="card-icon-header space-between">
          <div class="header-left">
            <span class="card-badge-icon">📋</span>
            <h3 class="card-heading" id="heading-quick-summary">Quick Summary</h3>
          </div>
          <span class="section-pill-tag">Concise Overview</span>
        </div>
        <div class="card-body-text">${this.formatMarkdownInline(quickSummary)}</div>
      </section>
    `;

    // Section 2: Important Concepts
    html += `
      <section class="note-card concepts-card animate-card" aria-labelledby="heading-important-concepts">
        <div class="card-icon-header space-between">
          <div class="header-left">
            <span class="card-badge-icon">💡</span>
            <h3 class="card-heading" id="heading-important-concepts">Important Concepts</h3>
          </div>
          <span class="section-pill-tag">${concepts.length} Core Concepts</span>
        </div>
        ${concepts.length > 0 ? `
          <ul class="concepts-list">
            ${concepts.map(c => `
              <li class="concept-item">
                <div class="concept-bullet-wrap">
                  <span class="concept-bullet">✦</span>
                </div>
                <div class="concept-body">
                  <strong class="concept-title">${this.escapeHtml(c.concept)}:</strong>
                  <span class="concept-desc">${this.formatMarkdownInline(c.explanation)}</span>
                </div>
              </li>
            `).join('')}
          </ul>
        ` : `
          <p class="section-empty-text">No important concepts identified.</p>
        `}
      </section>
    `;

    // Section 3: Key Definitions
    const totalDefs = definitions.length;
    const masteredCount = this.state.masteredTerms.size;

    html += `
      <section class="note-card definitions-card animate-card" aria-labelledby="heading-key-definitions">
        <div class="card-icon-header space-between">
          <div class="header-left">
            <span class="card-badge-icon">🔑</span>
            <h3 class="card-heading" id="heading-key-definitions">Key Definitions</h3>
          </div>
          <div class="mastery-counter" id="masteryCounter">
            Mastered: <strong>${masteredCount}/${totalDefs}</strong>
          </div>
        </div>

        ${definitions.length > 0 ? `
          <div class="terms-grid">
            ${definitions.map((t, idx) => {
              const isMastered = this.state.masteredTerms.has(t.term);
              return `
                <div class="term-box ${isMastered ? 'term-mastered' : ''}" id="term-box-${idx}">
                  <div class="term-top-row">
                    <span class="term-name">${this.escapeHtml(t.term)}</span>
                    <span class="term-tag">${this.escapeHtml(t.importance || 'KEY TERM')}</span>
                  </div>
                  <p class="term-def">${this.escapeHtml(t.definition)}</p>
                  ${t.tip ? `
                    <div class="term-tip">
                      <span class="tip-icon">💡</span>
                      <span class="tip-text">${this.escapeHtml(t.tip)}</span>
                    </div>
                  ` : ''}
                  <label class="term-master-checkbox">
                    <input type="checkbox" ${isMastered ? 'checked' : ''} onchange="window.studyPulseApp.toggleTermMastery('${this.escapeHtml(t.term)}', ${idx})">
                    <span>Mark as Mastered</span>
                  </label>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <p class="section-empty-text">No key definitions found in the lecture material.</p>
        `}
      </section>
    `;

    // Section 4: Important Formulas
    html += `
      <section class="note-card formulas-card animate-card" aria-labelledby="heading-important-formulas">
        <div class="card-icon-header space-between">
          <div class="header-left">
            <span class="card-badge-icon">📐</span>
            <h3 class="card-heading" id="heading-important-formulas">Important Formulas</h3>
          </div>
          <span class="section-pill-tag">${formulas.length > 0 ? `${formulas.length} Formulas` : 'Quantitative'}</span>
        </div>

        ${formulas.length > 0 ? `
          <div class="formulas-grid">
            ${formulas.map(f => `
              <div class="formula-box">
                <div class="formula-top-row">
                  <span class="formula-name">${this.escapeHtml(f.name)}</span>
                  <span class="formula-badge">FORMULA</span>
                </div>
                <div class="formula-equation-wrap">
                  <code class="formula-code">${this.escapeHtml(f.formula)}</code>
                </div>
                <p class="formula-explanation">${this.escapeHtml(f.explanation)}</p>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="empty-formulas-notice">
            <span class="empty-formula-icon">ℹ️</span>
            <span class="empty-formula-text">No important formulas found.</span>
          </div>
        `}
      </section>
    `;

    // Section 5: Exam Tips
    html += `
      <section class="note-card exam-tips-card animate-card" aria-labelledby="heading-exam-tips">
        <div class="card-icon-header space-between">
          <div class="header-left">
            <span class="card-badge-icon">🎯</span>
            <h3 class="card-heading" id="heading-exam-tips">Exam Tips</h3>
          </div>
          <span class="section-pill-tag">High-Yield Focus</span>
        </div>

        ${examTips.length > 0 ? `
          <div class="exam-tips-list">
            ${examTips.map((tip, idx) => `
              <div class="exam-tip-item">
                <div class="tip-badge">
                  <span class="tip-badge-icon">⚡</span>
                  <span class="tip-badge-num">Exam Focus ${idx + 1}</span>
                </div>
                <p class="tip-content">${this.escapeHtml(tip)}</p>
              </div>
            `).join('')}
          </div>
        ` : `
          <p class="section-empty-text">No specific exam tips identified.</p>
        `}
      </section>
    `;

    // Section 6: Key Takeaways
    html += `
      <section class="note-card takeaways-card animate-card" aria-labelledby="heading-key-takeaways">
        <div class="card-icon-header space-between">
          <div class="header-left">
            <span class="card-badge-icon">🚀</span>
            <h3 class="card-heading" id="heading-key-takeaways">Key Takeaways</h3>
          </div>
          <span class="section-pill-tag">Core Retention</span>
        </div>

        ${takeaways.length > 0 ? `
          <ol class="takeaways-list">
            ${takeaways.map((item, idx) => `
              <li class="takeaway-item">
                <div class="takeaway-number">${idx + 1}</div>
                <div class="takeaway-text">${this.escapeHtml(item)}</div>
              </li>
            `).join('')}
          </ol>
        ` : `
          <p class="section-empty-text">No key takeaways identified.</p>
        `}
      </section>
    `;

    container.innerHTML = html;
  }

  toggleTermMastery(termName, boxIndex) {
    if (this.state.masteredTerms.has(termName)) {
      this.state.masteredTerms.delete(termName);
    } else {
      this.state.masteredTerms.add(termName);
    }

    const box = document.getElementById(`term-box-${boxIndex}`);
    if (box) {
      box.classList.toggle('term-mastered', this.state.masteredTerms.has(termName));
    }

    const counter = document.getElementById('masteryCounter');
    if (counter && this.state.synthesis) {
      const defs = this.state.synthesis.notes.keyDefinitions || this.state.synthesis.notes.terms || [];
      const total = defs.length;
      counter.innerHTML = `Mastered: <strong>${this.state.masteredTerms.size}/${total}</strong>`;
    }
  }

  switchTab(tab) {
    this.state.activeTab = tab;
    if (tab === 'notes') {
      this.notesTabBtn?.classList.add('active');
      this.quizTabBtn?.classList.remove('active');
      this.notesPanel?.classList.remove('hidden');
      this.quizPanel?.classList.add('hidden');
      this.updateStepper(3);
    } else {
      this.notesTabBtn?.classList.remove('active');
      this.quizTabBtn?.classList.add('active');
      this.notesPanel?.classList.add('hidden');
      this.quizPanel?.classList.remove('hidden');
      this.updateStepper(4);
      if (this.quizController) {
        this.quizController.render();
      }
    }
  }

  // --- AUDIO READOUT / SPEECH SYNTHESIS ---

  toggleSpeech() {
    if (!('speechSynthesis' in window)) {
      this.showToast("Speech synthesis is not supported in this browser.", "warning");
      return;
    }

    if (this.isSpeaking) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
      this.updateAudioUI(false);
      return;
    }

    const data = this.state.synthesis;
    if (!data) return;

    let readText = `Revision notes for ${data.metadata.title}. `;
    const summary = data.notes.quickSummary || data.notes.execSummary || '';
    if (summary) {
      readText += `Quick Summary: ${summary.replace(/[*_`#]/g, '')}. `;
    }
    if (data.notes.importantConcepts && data.notes.importantConcepts.length > 0) {
      readText += `Important Concepts: `;
      data.notes.importantConcepts.forEach(c => {
        readText += `${c.concept}: ${c.explanation}. `;
      });
    }
    const defs = data.notes.keyDefinitions || data.notes.terms || [];
    if (defs.length > 0) {
      readText += `Key Definitions: `;
      defs.forEach(t => {
        readText += `${t.term}: ${t.definition}. `;
      });
    }
    if (data.notes.importantFormulas && data.notes.importantFormulas.length > 0) {
      readText += `Important Formulas: `;
      data.notes.importantFormulas.forEach(f => {
        readText += `${f.name}: ${f.formula}. `;
      });
    }
    const tips = data.notes.examTips || [];
    if (tips.length > 0) {
      readText += `Exam Tips: `;
      tips.forEach(tip => {
        readText += `${tip}. `;
      });
    }
    const takeaways = data.notes.keyTakeaways || data.notes.cheatSheet || [];
    if (takeaways.length > 0) {
      readText += `Key Takeaways: `;
      takeaways.forEach((k, idx) => {
        readText += `Point ${idx + 1}: ${k}. `;
      });
    }

    const utterance = new SpeechSynthesisUtterance(readText);
    utterance.rate = this.speechRate || 1.2;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.updateAudioUI(true);
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.updateAudioUI(false);
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.updateAudioUI(false);
    };

    window.speechSynthesis.speak(utterance);
  }

  updateAudioUI(speaking) {
    if (this.audioIcon) this.audioIcon.textContent = speaking ? '⏸️' : '🔊';
    if (this.audioLabel) this.audioLabel.textContent = speaking ? 'Pause Speech' : 'Listen to Revision Notes';
    if (this.audioWaveform) {
      this.audioWaveform.classList.toggle('hidden', !speaking);
    }
  }

  setSpeechRate(rate) {
    this.speechRate = parseFloat(rate) || 1.2;
    if (this.isSpeaking) {
      this.toggleSpeech();
      this.toggleSpeech();
    }
  }

  // --- EXPORT & SHARING HANDLERS ---

  togglePdfMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('pdfDropdownMenu');
    if (menu) menu.classList.toggle('hidden');
  }

  closePdfMenu() {
    const menu = document.getElementById('pdfDropdownMenu');
    if (menu) menu.classList.add('hidden');
  }

  downloadNotesPDF() {
    if (!this.state.synthesis) {
      this.showToast("Upload and synthesize a lecture first", "warning");
      return;
    }
    this.closePdfMenu();
    try {
      Exporter.downloadNotesPDF(this.state.synthesis);
      this.showToast("Downloaded Revision Notes PDF", "success");
    } catch (e) {
      console.error("Notes PDF generation error:", e);
      this.showToast("Failed to generate Notes PDF: " + e.message, "error");
    }
  }

  downloadQuizPDF() {
    if (!this.state.synthesis) {
      this.showToast("Upload and synthesize a lecture first", "warning");
      return;
    }
    this.closePdfMenu();
    try {
      Exporter.downloadQuizPDF(this.state.synthesis);
      this.showToast("Downloaded Practice Quiz PDF", "success");
    } catch (e) {
      console.error("Quiz PDF generation error:", e);
      this.showToast("Failed to generate Quiz PDF: " + e.message, "error");
    }
  }

  downloadCompletePackPDF() {
    if (!this.state.synthesis) {
      this.showToast("Upload and synthesize a lecture first", "warning");
      return;
    }
    this.closePdfMenu();
    try {
      Exporter.downloadCompletePackPDF(this.state.synthesis);
      this.showToast("Downloaded Complete Study Pack PDF", "success");
    } catch (e) {
      console.error("Pack PDF generation error:", e);
      this.showToast("Failed to generate Complete Pack PDF: " + e.message, "error");
    }
  }

  openShareModal(defaultTarget = 'notes') {
    if (!this.state.synthesis) {
      this.showToast("Upload and synthesize a lecture first", "warning");
      return;
    }
    this.closePdfMenu();
    this.currentShareTarget = defaultTarget;
    this.updateShareTargetUI();
    const modal = document.getElementById('shareModal');
    if (modal) modal.classList.add('open');
  }

  closeShareModal() {
    const modal = document.getElementById('shareModal');
    if (modal) modal.classList.remove('open');
  }

  setShareTarget(target) {
    this.currentShareTarget = target;
    this.updateShareTargetUI();
  }

  updateShareTargetUI() {
    const target = this.currentShareTarget || 'notes';
    const pills = {
      notes: document.getElementById('shareTargetNotes'),
      quiz: document.getElementById('shareTargetQuiz'),
      pack: document.getElementById('shareTargetPack')
    };

    Object.keys(pills).forEach(key => {
      if (pills[key]) {
        if (key === target) pills[key].classList.add('active');
        else pills[key].classList.remove('active');
      }
    });
  }

  async executeShare(action) {
    if (!this.state.synthesis) return;
    const target = this.currentShareTarget || 'notes';

    if (action === 'pdf') {
      if (target === 'quiz') this.downloadQuizPDF();
      else if (target === 'pack') this.downloadCompletePackPDF();
      else this.downloadNotesPDF();
      this.closeShareModal();
      return;
    }

    try {
      const res = await Exporter.shareContent({
        data: this.state.synthesis,
        type: target,
        method: action
      });

      if (res.aborted) {
        return; // User cancelled native share sheet
      }

      const label = target === 'quiz' ? 'Practice Quiz' : target === 'pack' ? 'Study Pack' : 'Revision Notes';
      if (action === 'clipboard' || res.method?.includes('clipboard')) {
        this.showToast(`Copied ${label} summary to clipboard!`, "success");
      } else if (action === 'whatsapp') {
        this.showToast(`Opening WhatsApp to share ${label}...`, "info");
      } else if (action === 'email') {
        this.showToast(`Opening email client with ${label}...`, "info");
      } else if (res.success) {
        this.showToast(`Shared ${label} successfully!`, "success");
      }
      this.closeShareModal();
    } catch (e) {
      console.error("Share execution error:", e);
      this.showToast("Sharing failed: " + e.message, "error");
    }
  }

  exportMarkdown() {
    if (!this.state.synthesis) return;
    Exporter.exportMarkdown(this.state.synthesis);
    this.showToast("Downloaded Markdown file (.md)", "success");
  }

  exportAnkiJSON() {
    if (!this.state.synthesis) return;
    Exporter.exportAnkiJSON(this.state.synthesis);
    this.showToast("Downloaded Anki/Flashcard JSON", "success");
  }

  triggerPrint() {
    this.closePdfMenu();
    Exporter.triggerPrintPDF();
  }

  async copySummary() {
    if (!this.state.synthesis) return;
    const ok = await Exporter.copyToClipboard(this.state.synthesis);
    if (ok) {
      this.showToast("Copied formatted revision summary to clipboard!", "success");
    }
  }

  openSettings() {
    if (this.settingsModal) this.settingsModal.classList.add('open');
  }

  closeSettings() {
    if (this.settingsModal) this.settingsModal.classList.remove('open');
  }

  saveApiKey() {
    if (this.apiKeyInput) {
      const key = this.apiKeyInput.value.trim();
      this.state.apiKey = key;
      localStorage.setItem("studypulse_api_key", key);
      this.showToast(key ? "Gemini API Key saved!" : "Cleared API key (using built-in engine)", "info");
      this.closeSettings();
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type} animate-slide-up`;
    
    let icon = "ℹ️";
    if (type === 'success') icon = "✅";
    if (type === 'error') icon = "❌";
    if (type === 'warning') icon = "⚠️";

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-text">${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  formatMarkdownInline(text) {
    if (!text) return "";
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
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

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new StudyPulseApp();
});
