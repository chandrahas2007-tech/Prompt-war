// Multi-format document parser supporting PDF, DOCX, TXT, MD, and Raw Lecture Text

export class LectureParser {
  /**
   * Parse an uploaded File object and return clean extracted text
   * @param {File} file
   * @returns {Promise<{ text: string, filename: string, type: string, stats: { words: number, chars: number, estMins: number } }>}
   */
  static async parseFile(file) {
    const filename = file.name;
    const ext = filename.split('.').pop().toLowerCase();
    let text = "";
    let pages = [];

    try {
      if (ext === 'pdf') {
        const res = await this.parsePdf(file);
        text = res.text;
        pages = res.pages;
      } else if (ext === 'docx') {
        text = await this.parseDocx(file);
        pages = [{ pageNum: 1, text }];
      } else if (ext === 'txt' || ext === 'md' || ext === 'text') {
        text = await this.parsePlainText(file);
        pages = this.chunkTextIntoPages(text);
      } else {
        // Fallback generic text reader
        text = await this.parsePlainText(file);
        pages = this.chunkTextIntoPages(text);
      }
    } catch (err) {
      console.warn("Specialized parser failed, attempting plain text fallback:", err);
      text = await this.parsePlainText(file);
      pages = this.chunkTextIntoPages(text);
    }

    // Clean up text
    const clean = this.cleanText(text);
    const words = clean.trim() ? clean.trim().split(/\s+/).length : 0;
    const chars = clean.length;
    const estMins = Math.max(1, Math.round(words / 130)); // Average speaking rate ~130 wpm
    const pageCount = pages.length > 0 ? pages.length : Math.max(1, Math.ceil(words / 350));

    return {
      text: clean,
      pages,
      filename,
      type: ext.toUpperCase(),
      stats: { words, chars, estMins, pageCount }
    };
  }

  /**
   * Helper to partition arbitrary long text into logical slides/pages
   */
  static chunkTextIntoPages(text) {
    const parts = text.split(/(?:--- Page \d+ ---|\n\s*#{1,2}\s+|\n---{3,}\n)/i).filter(p => p && p.trim());
    if (parts.length > 1) {
      return parts.map((chunk, i) => ({ pageNum: i + 1, text: chunk.trim() }));
    }
    // Chunk by ~300-400 words if very long
    const paras = text.split(/\n\s*\n/);
    const pages = [];
    let current = [];
    let curWords = 0;

    for (const p of paras) {
      const pWords = p.trim().split(/\s+/).length;
      if (curWords + pWords > 350 && current.length > 0) {
        pages.push({ pageNum: pages.length + 1, text: current.join("\n\n") });
        current = [p];
        curWords = pWords;
      } else {
        current.push(p);
        curWords += pWords;
      }
    }
    if (current.length > 0) {
      pages.push({ pageNum: pages.length + 1, text: current.join("\n\n") });
    }
    return pages.length ? pages : [{ pageNum: 1, text }];
  }

  /**
   * Read plain text or markdown
   */
  static async parsePlainText(file) {
    if (typeof file.text === 'function') {
      return await file.text();
    }
    if (typeof FileReader !== 'undefined') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result || "");
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
      });
    }
    return "";
  }

  /**
   * Parse PDF file using window.pdfjsLib if available, or regex-based text stream extractor
   */
  static async parsePdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pages = [];

    // Check if pdf.js is loaded in the window
    if (typeof window !== 'undefined' && window.pdfjsLib) {
      try {
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const tokenizedText = await page.getTextContent();
          const pageStrings = tokenizedText.items.map(item => item.str);
          const pageContent = pageStrings.join(" ").trim();
          pages.push({ pageNum: i, text: pageContent });
          fullText += `--- Page ${i} ---\n` + pageContent + "\n\n";
        }
        if (fullText.trim().length > 30) {
          return { text: fullText, pages };
        }
      } catch (pdfJsErr) {
        console.warn("PDF.js parsing had an error, using native fallback extractor:", pdfJsErr);
      }
    }

    // High-performance binary stream string extractor fallback for PDF text streams
    const uint8 = new Uint8Array(arrayBuffer);
    let binaryString = "";
    const len = Math.min(uint8.length, 5000000); // 5MB cap for safety
    for (let i = 0; i < len; i++) {
      binaryString += String.fromCharCode(uint8[i]);
    }

    // Match text blocks inside BT ... ET operators or (strings)
    const textMatches = [];
    const streamRegex = /\(([^)]+)\)\s*T[jJ]/g;
    let match;
    while ((match = streamRegex.exec(binaryString)) !== null) {
      // Decode escaped characters
      const str = match[1].replace(/\\([0-9]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
                           .replace(/\\[rntbf]/g, ' ')
                           .replace(/\\/g, '');
      if (str.trim().length > 1) {
        textMatches.push(str);
      }
    }

    if (textMatches.length > 5) {
      const extracted = textMatches.join(" ");
      return {
        text: extracted,
        pages: [{ pageNum: 1, text: extracted }]
      };
    }

    // If completely unable to extract text stream, notify user gracefully
    const fallbackNotice = `[PDF Document: ${file.name}]\n` +
      `Note: This PDF appears to be a scanned document or utilizes custom font encodings. ` +
      `For highest accuracy, please paste the lecture transcript or select a sample lecture above.`;
    return {
      text: fallbackNotice,
      pages: [{ pageNum: 1, text: fallbackNotice }]
    };
  }

  /**
   * Parse DOCX file by reading the internal word/document.xml if JSZip or native unpack is present
   */
  static async parseDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    
    // Quick extraction: find ASCII text strings within docx container
    let binary = "";
    for (let i = 0; i < Math.min(uint8.length, 2000000); i++) {
      binary += String.fromCharCode(uint8[i]);
    }

    // Search for XML text nodes <w:t>...</w:t>
    const xmlMatches = [];
    const xmlRegex = /<w:t[^>]*>([^<]+)<\/w:t>/g;
    let match;
    while ((match = xmlRegex.exec(binary)) !== null) {
      xmlMatches.push(match[1]);
    }

    if (xmlMatches.length > 5) {
      return xmlMatches.join(" ");
    }

    // Fallback to plain text
    return await this.parsePlainText(file);
  }

  /**
   * Clean and normalize raw extracted text
   */
  static cleanText(text) {
    if (!text) return "";
    return text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /**
   * Calculate stats for text
   */
  static getStats(text) {
    const clean = this.cleanText(text);
    const words = clean.trim() ? clean.trim().split(/\s+/).length : 0;
    const chars = clean.length;
    const estMins = Math.max(1, Math.round(words / 130));
    const pageCount = Math.max(1, Math.ceil(words / 350));
    return { words, chars, estMins, pageCount };
  }
}
