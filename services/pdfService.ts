import { PDFDocument, degrees } from 'pdf-lib';
import { CompanyInfo, StampInstance } from '../types';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const getPdfJs = (): any => {
  return pdfjsLib;
};

export const getPageAsImage = async (file: File, pageNumber: number): Promise<{ base64: string, totalPages: number }> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjs = getPdfJs();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    
    const targetPage = Math.max(1, Math.min(pageNumber, totalPages));
    const page = await pdf.getPage(targetPage);
    
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) throw new Error("Could not create canvas context");

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    const dataUrl = canvas.toDataURL('image/png');
    return {
      base64: dataUrl.split(',')[1],
      totalPages
    };
  } catch (error) {
    console.error("Error generating page image:", error);
    throw error;
  }
};

export const getPDFContentText = async (file: File, maxPagesToRead = 5): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjs = getPdfJs();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    const pagesToRead = Math.min(totalPages, maxPagesToRead);
    
    let fullText = "";
    for (let i = 1; i <= pagesToRead; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        fullText += `[Pág ${i}] ${pageText}\n`;
      } catch (e) {
        console.warn(`Erro ao extrair texto da página ${i}:`, e);
      }
    }
    
    if (totalPages > pagesToRead) {
      try {
        const lastPage = await pdf.getPage(totalPages);
        const textContent = await lastPage.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        fullText += `[Pág ${totalPages}] ${pageText}\n`;
      } catch (e) {
        console.warn("Erro ao extrair texto da última página:", e);
      }
    }

    return fullText.trim();
  } catch (error) {
    console.error("Erro na extração de texto do PDF:", error);
    return "";
  }
};

export const getFirstPageAsImage = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjs = getPdfJs();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const pageCount = pdf.numPages;
    const page = await pdf.getPage(pageCount);
    
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) throw new Error("Could not create canvas context");

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.split(',')[1];
  } catch (error) {
    console.error("Error generating preview image:", error);
    throw error;
  }
};

export const generateStampImage = async (
  info: CompanyInfo, 
  dateText: string | null
): Promise<Uint8Array> => {
  const canvas = document.createElement('canvas');
  const width = 600;
  const height = 300; 
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error("No canvas context");

  const inkRGBA = 'rgba(30, 58, 138, 0.92)';
  
  ctx.clearRect(0, 0, width, height);
  ctx.filter = 'blur(0.4px)';
  ctx.shadowColor = inkRGBA;
  ctx.shadowBlur = 1;
  ctx.strokeStyle = inkRGBA;

  // Outer and Inner Borders
  ctx.lineWidth = 12;
  ctx.strokeRect(15, 15, width - 30, height - 30);
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, width - 80, height - 80);

  ctx.fillStyle = inkRGBA;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Use customTextLines if available, otherwise fallback to basic info
  const lines = info.customTextLines && info.customTextLines.length > 0 
    ? info.customTextLines 
    : [info.companyName || 'EMPRESA', `CNPJ: ${info.cnpj || '00.000.000/0000-00'}`];

  // Logic to center multiple lines of text
  const totalContentHeight = dateText ? (height - 140) : (height - 100);
  const startY = 60;
  const availableHeight = height - 120;
  const lineHeight = availableHeight / (lines.length + (dateText ? 1 : 0));
  
  lines.forEach((line, index) => {
    const text = line.toUpperCase();
    let fontSize = Math.max(20, Math.min(48, 800 / Math.max(text.length, 1)));
    ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    
    const y = 50 + (lineHeight * (index + 0.5));
    ctx.fillText(text, width / 2, y);
  });

  if (dateText) {
    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.fillText(dateText, width / 2, height - 75);
  }

  // Realism Effects
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'destination-out';
  for(let i = 0; i < 7000; i++) {
     const x = Math.random() * width;
     const y = Math.random() * height;
     if (Math.random() > 0.5) ctx.fillRect(x, y, 1.2, 1.2);
  }
  
  ctx.lineWidth = 0.5;
  for(let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.lineTo(Math.random() * width, Math.random() * height);
    ctx.stroke();
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("Failed to create blob"));
        return;
      }
      const buffer = await blob.arrayBuffer();
      resolve(new Uint8Array(buffer));
    }, 'image/png');
  });
};

export const stampPDF = async (
  originalFile: File,
  stamps: StampInstance[]
): Promise<Uint8Array> => {
  try {
    const arrayBuffer = await originalFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pages = pdfDoc.getPages();

    for (const stampConfig of stamps) {
      const stampImageBytes = await generateStampImage(stampConfig.info, stampConfig.dateText);
      const stampImage = await pdfDoc.embedPng(stampImageBytes);
      const stampScale = Math.max(0.5, Math.min(1.8, stampConfig.scale || 1));
      const stampDims = stampImage.scale(0.28 * stampScale);

      // Cada página usa sua própria coordenada, sem alterar as demais.
      let targetPageIndexes = pages.map((_, index) => index);
      const targetOption = stampConfig.targetPage || 'all';
      if (targetOption === 'last') {
        targetPageIndexes = [pages.length - 1];
      } else if (targetOption === 'first') {
        targetPageIndexes = [0];
      } else if (typeof targetOption === 'number') {
        const requestedIndex = targetOption - 1;
        targetPageIndexes = requestedIndex >= 0 && requestedIndex < pages.length ? [requestedIndex] : [];
      }

      for (const pageIndex of targetPageIndexes) {
        const page = pages[pageIndex];
        const pageNumber = pageIndex + 1;
        const pagePosition = stampConfig.pagePositions?.[pageNumber] || {
          x: stampConfig.customX,
          y: stampConfig.customY,
        };
        const { width, height } = page.getSize();
        const targetX = width * pagePosition.x;
        const targetY = height * (1 - pagePosition.y);

        const x = targetX - (stampDims.width / 2);
        const y = targetY - (stampDims.height / 2);

        page.drawImage(stampImage, {
          x: Math.max(2, Math.min(x, width - stampDims.width - 2)),
          y: Math.max(2, Math.min(y, height - stampDims.height - 2)),
          width: stampDims.width,
          height: stampDims.height,
          opacity: 0.94,
          rotate: degrees((Math.random() - 0.5) * 4),
        });
      }
    }
    return await pdfDoc.save();
  } catch (error) {
    console.error("Error in stampPDF:", error);
    throw error;
  }
};
