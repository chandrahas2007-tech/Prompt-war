// Automated Test Script: Direct PDF Generation & Sharing Engine Verification
global.self = global;
global.window = global;

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('./lib/jspdf.umd.min.js');

import { AIEngine } from './js/ai-engine.js';
import { PDFGenerator } from './js/pdf-generator.js';
import { Exporter } from './js/exporter.js';

async function runPdfAndShareTests() {
  console.log('=== Step 1: Synthesizing Lecture Data for PDF & Sharing Test ===');
  const lectureText = `
CS 301: Distributed Systems & Consensus
Lecture 8: Raft Consensus and Replicated State Machines

1. The Core Consensus Challenge
In a distributed architecture, independent nodes must agree on state transitions despite unreliable networks and crash failures.

2. Replicated State Machine Architecture
Identical replica servers execute deterministically. A consensus algorithm ensures all replicas receive the same commands in the same sequence.

3. Mathematical Quorum Thresholds
To tolerate F crash failures in a cluster of N nodes, the system requires a majority quorum:
Quorum = floor(N / 2) + 1
FaultTolerance = floor((N - 1) / 2)

4. Key Definitions
Consensus: Agreement on a single data value or command sequence among distributed processes.
Term: Monotonically increasing logical epoch number acting as a logical clock in Raft.
Heartbeat: Periodic AppendEntries RPC sent by the leader to suppress new election timeouts.

5. Exam Tips
Watch out for split votes: election timeouts must be randomized between 150ms and 300ms.
Remember that uncommitted log entries can be overwritten by a legitimate new leader.

6. Key Takeaways
1. Consensus provides linearizable consistency across unreliable distributed nodes.
2. Majority quorums prevent split-brain partition anomalies.
3. Raft decomposes consensus into leader election, log replication, and safety guarantees.
`;

  const synthesis = await AIEngine.synthesize(lectureText, {
    subject: 'cs',
    style: 'exam_cram',
    level: 'undergrad'
  });

  console.log('Synthesis Title:', synthesis.metadata.title);
  console.log('Concepts:', synthesis.notes.importantConcepts.length);
  console.log('Definitions:', synthesis.notes.keyDefinitions.length);
  console.log('Formulas:', synthesis.notes.importantFormulas.length);
  console.log('Exam Tips:', synthesis.notes.examTips.length);
  console.log('Key Takeaways:', synthesis.notes.keyTakeaways.length);
  console.log('Quiz Questions:', synthesis.quiz.length);

  console.log('\n=== Step 2: Testing AI-Generated Revision Notes PDF Generation ===');
  const notesDoc = PDFGenerator.generateNotesPDF(synthesis);
  const notesBuffer = PDFGenerator.toArrayBuffer(notesDoc);
  const notesMagic = Buffer.from(notesBuffer.slice(0, 5)).toString();
  console.log('Notes PDF Buffer Size:', notesBuffer.byteLength, 'bytes');
  console.log('Notes PDF Magic Bytes:', notesMagic);

  if (notesMagic !== '%PDF-') throw new Error('Invalid Notes PDF: missing %PDF- header');
  if (notesBuffer.byteLength < 4000) throw new Error('Notes PDF too small: ' + notesBuffer.byteLength);
  console.log('✓ AI Revision Notes PDF generated successfully!');

  console.log('\n=== Step 3: Testing 5-Question Practice Quiz PDF Generation ===');
  const quizDoc = PDFGenerator.generateQuizPDF(synthesis);
  const quizBuffer = PDFGenerator.toArrayBuffer(quizDoc);
  const quizMagic = Buffer.from(quizBuffer.slice(0, 5)).toString();
  console.log('Quiz PDF Buffer Size:', quizBuffer.byteLength, 'bytes');
  console.log('Quiz PDF Magic Bytes:', quizMagic);

  if (quizMagic !== '%PDF-') throw new Error('Invalid Quiz PDF: missing %PDF- header');
  if (quizBuffer.byteLength < 4000) throw new Error('Quiz PDF too small: ' + quizBuffer.byteLength);
  console.log('✓ 5-Question Practice Quiz PDF generated successfully!');

  console.log('\n=== Step 4: Testing Complete Study Pack PDF Generation (Notes + Quiz) ===');
  const packDoc = PDFGenerator.generateCompletePackPDF(synthesis);
  const packBuffer = PDFGenerator.toArrayBuffer(packDoc);
  const packMagic = Buffer.from(packBuffer.slice(0, 5)).toString();
  console.log('Complete Pack PDF Buffer Size:', packBuffer.byteLength, 'bytes');
  console.log('Complete Pack PDF Magic Bytes:', packMagic);

  if (packMagic !== '%PDF-') throw new Error('Invalid Pack PDF: missing %PDF- header');
  if (packBuffer.byteLength < 6000) throw new Error('Complete Pack PDF too small: ' + packBuffer.byteLength);
  console.log('✓ Complete Study Pack PDF generated successfully!');

  console.log('\n=== Step 5: Testing Multi-Channel Sharing Text Formats ===');
  
  // 5a. Notes Share Text
  const notesShareText = Exporter.getShareText(synthesis, 'notes');
  console.log('Notes Share Text Length:', notesShareText.length, 'chars');
  if (!notesShareText.includes("Revision Notes:") || !notesShareText.includes("QUICK SUMMARY") || !notesShareText.includes("IMPORTANT CONCEPTS")) {
    throw new Error('Notes share text missing essential revision sections');
  }
  console.log('✓ Notes Share Text verified!');

  // 5b. Quiz Share Text
  const quizShareText = Exporter.getShareText(synthesis, 'quiz');
  console.log('Quiz Share Text Length:', quizShareText.length, 'chars');
  if (!quizShareText.includes("Practice Quiz:") || !quizShareText.includes("Q1:") || !quizShareText.includes("A)")) {
    throw new Error('Quiz share text missing practice quiz questions or options');
  }
  console.log('✓ Quiz Share Text verified!');

  // 5c. Complete Pack Share Text
  const packShareText = Exporter.getShareText(synthesis, 'pack');
  console.log('Pack Share Text Length:', packShareText.length, 'chars');
  if (!packShareText.includes("Complete Study Pack:") || !packShareText.includes("QUICK SUMMARY") || !packShareText.includes("PRACTICE QUIZ")) {
    throw new Error('Complete pack share text missing study pack components');
  }
  console.log('✓ Complete Pack Share Text verified!');

  console.log('\n>>> ALL PDF GENERATION AND SHARING TESTS PASSED 100%! <<<');
}

runPdfAndShareTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
