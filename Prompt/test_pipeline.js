import { LectureParser } from './js/parser.js';
import { AIEngine } from './js/ai-engine.js';
import { Exporter } from './js/exporter.js';
import fs from 'fs';

async function runTest() {
  console.log('=== Step 1 & 2: PDF Parsing & Content Extraction ===');
  const pdfBuffer = fs.readFileSync('sample_lecture.pdf');
  const mockFile = {
    name: 'sample_lecture.pdf',
    arrayBuffer: async () => pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength)
  };
  
  const parsed = await LectureParser.parseFile(mockFile);
  console.log('File:', parsed.filename);
  console.log('Words:', parsed.stats.words);
  console.log('Pages:', parsed.stats.pageCount);
  console.log('Est Lecture Mins:', parsed.stats.estMins);
  console.log('Text preview:', parsed.text.substring(0, 150).replace(/\n/g, ' ') + '...');
  
  if (parsed.stats.words < 20) throw new Error('PDF extraction failed: insufficient words');
  
  console.log('\n=== Step 3: Concise Revision Notes Generation (6 Sections) ===');
  const synthesis = await AIEngine.synthesize(parsed.text, {
    subject: 'cs',
    style: 'exam_cram',
    level: 'undergrad'
  }, (progress) => {
    console.log(`[Progress ${progress.percent}%] ${progress.message}`);
  });
  
  console.log('\nTitle:', synthesis.metadata.title);

  // Assert Section 1: Quick Summary
  if (!synthesis.notes.quickSummary || typeof synthesis.notes.quickSummary !== 'string') {
    throw new Error('Section 1 failed: quickSummary is missing or invalid');
  }
  console.log('1. Quick Summary:', synthesis.notes.quickSummary.substring(0, 100) + '...');

  // Assert Section 2: Important Concepts
  if (!Array.isArray(synthesis.notes.importantConcepts) || synthesis.notes.importantConcepts.length === 0) {
    throw new Error('Section 2 failed: importantConcepts is missing or empty');
  }
  console.log('2. Important Concepts count:', synthesis.notes.importantConcepts.length);
  synthesis.notes.importantConcepts.forEach((c, idx) => {
    console.log(`   [Concept ${idx+1}] ${c.concept}: ${c.explanation.substring(0, 60)}...`);
  });

  // Assert Section 3: Key Definitions
  if (!Array.isArray(synthesis.notes.keyDefinitions) || synthesis.notes.keyDefinitions.length === 0) {
    throw new Error('Section 3 failed: keyDefinitions is missing or empty');
  }
  console.log('3. Key Definitions count:', synthesis.notes.keyDefinitions.length);
  synthesis.notes.keyDefinitions.forEach((d, idx) => {
    console.log(`   [Def ${idx+1}] ${d.term}: ${d.definition.substring(0, 60)}...`);
  });

  // Assert Section 4: Important Formulas
  if (!Array.isArray(synthesis.notes.importantFormulas)) {
    throw new Error('Section 4 failed: importantFormulas must be an array');
  }
  console.log('4. Important Formulas count:', synthesis.notes.importantFormulas.length);
  synthesis.notes.importantFormulas.forEach((f, idx) => {
    console.log(`   [Formula ${idx+1}] ${f.name} -> ${f.formula}`);
  });

  // Assert Section 5: Exam Tips
  if (!Array.isArray(synthesis.notes.examTips) || synthesis.notes.examTips.length === 0) {
    throw new Error('Section 5 failed: examTips is missing or empty');
  }
  console.log('5. Exam Tips count:', synthesis.notes.examTips.length);
  synthesis.notes.examTips.forEach((t, idx) => {
    console.log(`   [Tip ${idx+1}] ${t.substring(0, 70)}...`);
  });

  // Assert Section 6: Key Takeaways
  if (!Array.isArray(synthesis.notes.keyTakeaways) || synthesis.notes.keyTakeaways.length === 0) {
    throw new Error('Section 6 failed: keyTakeaways is missing or empty');
  }
  console.log('6. Key Takeaways count:', synthesis.notes.keyTakeaways.length);
  synthesis.notes.keyTakeaways.forEach((k, idx) => {
    console.log(`   [Takeaway ${idx+1}] ${k.substring(0, 70)}...`);
  });

  console.log('\n=== Step 3b: Verify "No important formulas found." with Non-Formula Material (HIST 205) ===');
  const histText = "Lecture on Industrial Revolution in Britain. The Factory Acts (1833) restricted child labor. Luddism was an organized protest against wage cuts.";
  const histSynthesis = await AIEngine.synthesize(histText, {
    subject: 'humanities',
    style: 'exam_cram',
    level: 'undergrad'
  });
  console.log('HIST formulas count:', histSynthesis.notes.importantFormulas.length);
  const histMd = Exporter.generateMarkdown(histSynthesis);
  if (!histMd.includes("No important formulas found.")) {
    throw new Error('Expected "No important formulas found." in markdown for non-formula lecture');
  }
  console.log('Verified "No important formulas found." is correctly formatted when no formulas exist!');

  console.log('\n=== Step 4: 5-Question Practice Quiz ===');
  console.log('Quiz questions count:', synthesis.quiz.length);
  synthesis.quiz.forEach((q, idx) => {
    console.log(`Q${idx+1}: [${q.citation}] ${q.question.substring(0, 70)}...`);
    console.log(`   Correct: Option ${q.correctIndex} (${q.options[q.correctIndex]})`);
  });
  
  if (synthesis.quiz.length !== 5) {
    throw new Error('Expected exactly 5 quiz questions, got ' + synthesis.quiz.length);
  }
  
  console.log('\n=== Export Formats Verification ===');
  const md = Exporter.generateMarkdown(synthesis);
  console.log('Markdown generated length:', md.length, 'chars');
  if (!md.includes("## 📋 Quick Summary") || !md.includes("## 💡 Important Concepts") ||
      !md.includes("## 🔑 Key Definitions") || !md.includes("## 📐 Important Formulas") ||
      !md.includes("## 🎯 Exam Tips") || !md.includes("## 🚀 Key Takeaways")) {
    throw new Error('Exported markdown missing one or more of the 6 section headings');
  }
  console.log('All 6 section headings verified in exported Markdown!');

  const anki = Exporter.generateAnkiJSON(synthesis);
  console.log('Anki JSON generated length:', anki.length, 'chars');
  
  console.log('\n>>> ALL 6 REVISION SECTIONS & PRACTICE QUIZ VERIFIED SUCCESSFULLY! <<<');
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
