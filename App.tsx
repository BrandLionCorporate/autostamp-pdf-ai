import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Stamp, 
  Download, 
  Loader2, 
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  Building2,
  FileCheck,
  MousePointer2,
  CalendarOff,
  Crosshair,
  AlertCircle,
  Type as TypeIcon,
  GripVertical,
  ChevronRight
} from 'lucide-react';
import { analyzeDocument } from './services/openaiService';
import { stampPDF, getFirstPageAsImage, getPageAsImage, getPDFContentText } from './services/pdfService';
import { CompanyInfo, ProcessingStatus, StampPosition, StampInstance, Position } from './types';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [stamps, setStamps] = useState<StampInstance[]>([]);
  const [activeStampId, setActiveStampId] = useState<string | null>(null);
  const [info, setInfo] = useState<CompanyInfo>({ companyName: '', cnpj: '', customTextLines: [] });
  const [includeDate, setIncludeDate] = useState(true);
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [resultPdfUrl, setResultPdfUrl] = useState<string | null>(null);
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const getStampPositionForPage = (stamp: StampInstance, pageNumber: number): Position =>
    stamp.pagePositions?.[pageNumber] || { x: stamp.customX, y: stamp.customY };

  const isStampVisibleOnPage = (stamp: StampInstance, pageNumber: number): boolean => {
    const target = stamp.targetPage || 'all';
    if (target === 'all') return true;
    if (target === 'first') return pageNumber === 1;
    if (target === 'last') return pageNumber === totalPages;
    return target === pageNumber;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const addStampToCurrentPage = (position: Position = { x: 0.5, y: 0.5 }) => {
    const newStamp: StampInstance = {
      id: crypto.randomUUID(),
      info,
      position: StampPosition.CUSTOM,
      dateText: includeDate ? formatDate(customDate) : null,
      customX: position.x,
      customY: position.y,
      scale: 1,
      targetPage: currentPage,
      pagePositions: { [currentPage]: position },
    };

    setStamps(prev => [...prev, newStamp]);
    setActiveStampId(newStamp.id);
  };

  const duplicateStampOnCurrentPage = (source: StampInstance) => {
    const sourcePosition = getStampPositionForPage(source, currentPage);
    const duplicatedPosition = {
      x: Math.min(0.92, sourcePosition.x + 0.04),
      y: Math.min(0.92, sourcePosition.y + 0.04),
    };
    const duplicate: StampInstance = {
      ...source,
      id: crypto.randomUUID(),
      targetPage: currentPage,
      pagePositions: { [currentPage]: duplicatedPosition },
    };

    setStamps(prev => [...prev, duplicate]);
    setActiveStampId(duplicate.id);
  };

  // Sync stamp info with general info whenever editing happens
  useEffect(() => {
    setStamps(prev => prev.map(s => ({
      ...s,
      info: { ...info },
      dateText: includeDate ? formatDate(customDate) : null
    })));
  }, [info, includeDate, customDate]);

  // Load page image when currentPage or file changes
  useEffect(() => {
    if (!file) return;
    const loadPreviewPage = async () => {
      try {
        const { base64, totalPages: pagesCount } = await getPageAsImage(file, currentPage);
        setPageImageUrl(`data:image/png;base64,${base64}`);
        setTotalPages(pagesCount);
      } catch (e) {
        console.error("Error loading preview page:", e);
      }
    };
    loadPreviewPage();
  }, [file, currentPage]);

  // Global mouse move and mouse up for smoother drag experience
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging || !activeStampId || !previewRef.current) return;
      const rect = previewRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      
      const nextPosition = {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
      };

      setStamps(prevStamps => prevStamps.map(s => s.id === activeStampId ? {
        ...s,
        pagePositions: {
          ...s.pagePositions,
          [currentPage]: nextPosition,
        },
      } : s));
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.cursor = 'grabbing';
    } else {
      document.body.style.cursor = 'default';
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, activeStampId, currentPage]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile || uploadedFile.type !== 'application/pdf') return;

    setFile(uploadedFile);
    setStatus('analyzing');
    setResultPdfUrl(null);
    setPageImageUrl(null);
    setAnalysisError(null);
    setStamps([]);

    let uploadedPagesCount = 1;

    try {
      const { base64: imageBase64, totalPages: pagesCount } = await getPageAsImage(uploadedFile, 99999);
      uploadedPagesCount = pagesCount;
      setPageImageUrl(`data:image/png;base64,${imageBase64}`);
      setTotalPages(pagesCount);
      setCurrentPage(pagesCount);
      
      // Extrair o texto das primeiras páginas (e última) para identificação perfeita de Razão Social e CNPJ
      const pdfText = await getPDFContentText(uploadedFile, 5);
      
      let firstPageBase64: string | null = null;
      if (pagesCount > 1) {
        try {
          const firstPageResult = await getPageAsImage(uploadedFile, 1);
          firstPageBase64 = firstPageResult.base64;
        } catch (e) {
          console.warn("Could not extract first page as image for OCR:", e);
        }
      }

      const extracted = await analyzeDocument(imageBase64, pdfText, firstPageBase64);
      
      const initialLines = [
        extracted.companyName || 'NOME DA EMPRESA',
        `CNPJ: ${extracted.cnpj || '00.000.000/0000-00'}`
      ];
      
      const newInfo = { ...extracted, customTextLines: initialLines };
      setInfo(newInfo);
      
      // Garante que detectedPositions seja um array válido e não esteja vazio
      let rawPositions = extracted.detectedPositions;
      if (!Array.isArray(rawPositions) || rawPositions.length === 0) {
        rawPositions = [{ x: 0.7, y: 0.82 }];
      }

      // Função de sanitização para manter as coordenadas dentro da margem útil do documento
      const sanitizeCoord = (val: any, defaultVal: number): number => {
        const num = parseFloat(val);
        if (isNaN(num)) return defaultVal;
        
        // Se o modelo retornou em formato de porcentagem (ex: 70 ao invés de 0.7)
        if (num > 1.0 && num <= 100.0) {
          return num / 100.0;
        }
        // Se o modelo retornou em formato de pixels (valores altos) ou fora do limite útil
        if (num > 100.0 || num < 0.0) {
          return defaultVal;
        }
        
        // Clampa mantendo uma pequena margem das bordas do contrato
        return Math.max(0.05, Math.min(0.95, num));
      };

      const positions = rawPositions.map(pos => ({
        x: sanitizeCoord(pos?.x, 0.7),
        y: sanitizeCoord(pos?.y, 0.82)
      }));

      const newStamps: StampInstance[] = positions.map(pos => ({
        id: crypto.randomUUID(),
        info: newInfo,
        position: StampPosition.CUSTOM,
        dateText: includeDate ? formatDate(customDate) : null,
        customX: pos.x,
        customY: pos.y,
        scale: 1,
        targetPage: 'all',
        pagePositions: Object.fromEntries(
          Array.from({ length: pagesCount }, (_, index) => [index + 1, { ...pos }]),
        ),
      }));

      setStamps(newStamps);
      if (newStamps.length > 0) setActiveStampId(newStamps[0].id);
      setStatus('idle');
    } catch (error: any) {
      console.error("Erro na análise via OpenAI:", error);
      setAnalysisError(error?.message || "Ocorreu uma falha de comunicação com o serviço inteligência artificial.");
      setStatus('idle');
      const fallbackLines = ['EMPRESA', 'CNPJ: 00.000.000/0000-00'];
      const defaultInfo = { companyName: 'EMPRESA', cnpj: '00.000.000/0000-00', customTextLines: fallbackLines };
      setInfo(defaultInfo);
      const fallbackStamp: StampInstance = {
        id: crypto.randomUUID(),
        info: defaultInfo,
        position: StampPosition.CUSTOM,
        dateText: includeDate ? formatDate(customDate) : null,
        customX: 0.7,
        customY: 0.82,
        scale: 1,
        targetPage: 'all',
        pagePositions: Object.fromEntries(
          Array.from({ length: uploadedPagesCount }, (_, index) => [index + 1, { x: 0.7, y: 0.82 }]),
        ),
      };
      setStamps([fallbackStamp]);
      setActiveStampId(fallbackStamp.id);
    }
  };

  const updateTextLine = (index: number, value: string) => {
    const newLines = [...(info.customTextLines || [])];
    newLines[index] = value;
    setInfo({ ...info, customTextLines: newLines });
  };

  const addTextLine = () => {
    setInfo({ ...info, customTextLines: [...(info.customTextLines || []), 'NOVA LINHA'] });
  };

  const removeTextLine = (index: number) => {
    const newLines = (info.customTextLines || []).filter((_, i) => i !== index);
    setInfo({ ...info, customTextLines: newLines });
  };

  const handleGenerate = async () => {
    if (!file || stamps.length === 0) return;
    setStatus('stamping');
    try {
      // Small artificial delay for visual feedback
      await new Promise(r => setTimeout(r, 800));
      const pdfBytes = await stampPDF(file, stamps);
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setResultPdfUrl(url);
      setStatus('done');
    } catch (error) {
      console.error(error);
      setStatus('error');
      alert("Ocorreu um erro ao gerar o PDF carimbado.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] py-10 px-6 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-3xl shadow-lg shadow-blue-100">
              <Stamp className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                AutoStamp <span className="text-blue-600">Smart</span>
              </h1>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Editor de Carimbos com IA</p>
            </div>
          </div>
          {file && status !== 'done' && (
             <div className="flex items-center gap-3">
                <button 
                  onClick={handleGenerate} 
                  disabled={status === 'stamping'}
                  className="flex items-center gap-2 bg-blue-600 text-white font-black px-8 py-3.5 rounded-[1.5rem] hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all disabled:opacity-50"
                >
                  {status === 'stamping' ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileCheck className="w-5 h-5" />}
                  Gerar PDF Final
                </button>
             </div>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Side Panel: Editing */}
          <div className="lg:col-span-4 space-y-6">
            {!file ? (
              <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border-2 border-dashed border-slate-200 text-center space-y-6 hover:border-blue-500 transition-all cursor-pointer relative group">
                <input aria-label="Carregar PDF" type="file" accept=".pdf" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                <div className="bg-blue-50 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                   <Upload className="w-12 h-12 text-blue-600" />
                </div>
                <div>
                   <h3 className="font-black text-2xl text-slate-800">Carregar PDF</h3>
                   <p className="text-sm text-slate-400 mt-1">Clique ou arraste o arquivo para análise</p>
                   <p className="text-xs text-slate-500 mt-3">Com a API configurada, a análise envia texto e imagens do PDF à OpenAI. Use documentos que você tem autorização para processar e revise os dados antes de gerar o arquivo.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-left duration-500">
                {/* Error Banner if AI analysis fails */}
                {analysisError && (
                  <div className="bg-amber-50 border border-amber-200 p-5 rounded-[2rem] space-y-2 text-amber-800 animate-in slide-in-from-top duration-300">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-black text-sm uppercase tracking-tight">Análise Automática Indisponível</h4>
                        <p className="text-xs text-amber-600/90 leading-relaxed mt-1">
                          Não conseguimos ler os dados automaticamente através da IA. 
                          {analysisError.toLowerCase().includes("api key") || analysisError.toLowerCase().includes("api_key") || analysisError.toLowerCase().includes("apikey") || analysisError.toLowerCase().includes("not defined") ? (
                            <span> A chave da OpenAI (<code>OPENAI_API_KEY</code>) não está configurada no servidor.</span>
                          ) : (
                            <span> Detalhes: {analysisError}</span>
                          )}
                        </p>
                        <p className="text-xs font-bold text-amber-700 mt-2">
                          Mas não se preocupe! Você pode preencher os campos do carimbo manualmente abaixo e arrastá-lo no documento ao lado!
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Text Lines Editor */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <TypeIcon className="w-4 h-4 text-blue-500" /> Conteúdo do Carimbo
                    </h2>
                    <button 
                      onClick={addTextLine} 
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black hover:bg-blue-100 transition-all"
                    >
                      <Plus className="w-3 h-3" /> ADICIONAR
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {(info.customTextLines || []).map((line, idx) => (
                      <div key={idx} className="group flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-slate-200 flex-shrink-0" />
                        <div className="relative flex-1">
                          <input 
                            type="text" 
                            value={line} 
                            onChange={(e) => updateTextLine(idx, e.target.value)}
                            placeholder={`Linha ${idx + 1}`}
                            className="w-full bg-slate-50 border-slate-100 border-2 rounded-2xl px-4 py-3 text-sm font-black focus:border-blue-500 focus:bg-white outline-none transition-all uppercase placeholder:text-slate-200"
                          />
                        </div>
                        <button 
                          onClick={() => removeTextLine(idx)} 
                          className="p-2.5 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {(!info.customTextLines || info.customTextLines.length === 0) && (
                      <div className="text-center py-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
                         <p className="text-xs font-bold text-slate-300">Nenhum texto adicionado</p>
                      </div>
                    )}
                  </div>

                  {/* Date Settings */}
                  <div className="pt-6 border-t border-slate-50 space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <span className="block text-[10px] font-black text-slate-400 uppercase">Data no Carimbo</span>
                        <span className="text-xs font-bold text-slate-700">{includeDate ? 'Exibir' : 'Ocultar'}</span>
                      </div>
                      <button 
                        onClick={() => setIncludeDate(!includeDate)}
                        className={`w-12 h-6 rounded-full transition-all relative ${includeDate ? 'bg-blue-600' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${includeDate ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    {includeDate && (
                       <input 
                         type="date" 
                         value={customDate} 
                         onChange={(e) => setCustomDate(e.target.value)} 
                         className="w-full bg-slate-50 border-slate-100 border-2 rounded-2xl px-4 py-3 text-sm font-black outline-none focus:border-blue-500" 
                       />
                    )}
                  </div>
                </div>

                {/* Positions Management */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Pontos de Assinatura</h3>
                   <div className="space-y-4">
                     {stamps.map((s, idx) => (
                       <div key={s.id} className="space-y-2">
                         <div 
                          onClick={() => setActiveStampId(s.id)} 
                          className={`p-4 border-2 rounded-[1.5rem] flex items-center justify-between cursor-pointer transition-all ${activeStampId === s.id ? 'border-blue-600 bg-blue-50/30' : 'border-slate-50 hover:bg-slate-50 opacity-85'}`}
                         >
                            <div className="flex items-center gap-3">
                               <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${activeStampId === s.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                                 {idx + 1}
                               </div>
                               <div>
                                 <span className="block font-black text-xs text-slate-700">Carimbo #{idx + 1}</span>
                                 <span className="block text-[10px] text-slate-400">
                                   {s.targetPage === 'all'
                                     ? 'Posição independente por página'
                                     : typeof s.targetPage === 'number'
                                       ? `Somente na página ${s.targetPage}`
                                       : s.targetPage === 'first' ? 'Somente na primeira página' : 'Somente na última página'}
                                 </span>
                               </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); duplicateStampOnCurrentPage(s); }}
                                className="text-slate-300 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-xl transition-all"
                                title={`Duplicar na página ${currentPage}`}
                                aria-label={`Duplicar carimbo na página ${currentPage}`}
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setStamps(stamps.filter(x => x.id !== s.id)); }} 
                                className="text-slate-200 hover:text-red-500 p-2 hover:bg-red-50 rounded-xl transition-all"
                                title="Excluir carimbo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                         </div>
                         
                         {activeStampId === s.id && (
                           <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl space-y-2 animate-in slide-in-from-top-1 duration-150">
                             <span className="block text-[9px] font-black text-slate-450 uppercase mb-1">Aplicar em:</span>
                             <div className="grid grid-cols-2 gap-1">
                               {[
                                 { value: 'all' as const, label: 'Todas' },
                                 { value: currentPage, label: `Pág. ${currentPage}` },
                                 { value: 'first' as const, label: 'Primeira' },
                                 { value: 'last' as const, label: 'Última' },
                               ].map((pageOption) => (
                                 <button
                                   key={`${pageOption.value}`}
                                   onClick={() => {
                                     setStamps(prev => prev.map(item => item.id === s.id ? {
                                       ...item,
                                       targetPage: pageOption.value,
                                       pagePositions: {
                                         ...item.pagePositions,
                                         [currentPage]: getStampPositionForPage(item, currentPage),
                                       },
                                     } : item));
                                   }}
                                   className={`py-1.5 px-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                                     s.targetPage === pageOption.value || (!s.targetPage && pageOption.value === 'all')
                                       ? 'bg-blue-600 text-white shadow-sm shadow-blue-100'
                                       : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
                                   }`}
                                 >
                                   {pageOption.label}
                                 </button>
                               ))}
                             </div>
                             <p className="text-[9px] text-slate-400 font-bold leading-relaxed pt-1">
                               Em “Todas”, arraste o carimbo separadamente em cada página.
                             </p>
                             <div className="pt-3 mt-2 border-t border-slate-200 space-y-2">
                               <div className="flex items-center justify-between">
                                 <span className="text-[9px] font-black text-slate-450 uppercase">Tamanho do carimbo</span>
                                 <button
                                   onClick={() => setStamps(prev => prev.map(item => item.id === s.id ? { ...item, scale: 1 } : item))}
                                   className="text-[10px] font-black text-blue-600 hover:text-blue-800"
                                   title="Restaurar tamanho padrão"
                                 >
                                   {Math.round((s.scale || 1) * 100)}%
                                 </button>
                               </div>
                               <div className="flex items-center gap-2">
                                 <button
                                   onClick={() => setStamps(prev => prev.map(item => item.id === s.id ? { ...item, scale: Math.max(0.5, (item.scale || 1) - 0.1) } : item))}
                                   className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-600 font-black hover:border-blue-300 hover:text-blue-600"
                                   aria-label="Diminuir carimbo"
                                 >
                                   −
                                 </button>
                                 <input
                                   type="range"
                                   min="0.5"
                                   max="1.8"
                                   step="0.05"
                                   value={s.scale || 1}
                                   onChange={(e) => {
                                     const scale = Number(e.target.value);
                                     setStamps(prev => prev.map(item => item.id === s.id ? { ...item, scale } : item));
                                   }}
                                   className="flex-1 accent-blue-600 cursor-pointer"
                                   aria-label="Tamanho do carimbo"
                                 />
                                 <button
                                   onClick={() => setStamps(prev => prev.map(item => item.id === s.id ? { ...item, scale: Math.min(1.8, (item.scale || 1) + 0.1) } : item))}
                                   className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-600 font-black hover:border-blue-300 hover:text-blue-600"
                                   aria-label="Aumentar carimbo"
                                 >
                                   +
                                 </button>
                               </div>
                               <p className="text-[9px] text-slate-400 font-bold">Use −, + ou arraste a barra. Clique na porcentagem para voltar a 100%.</p>
                             </div>
                           </div>
                         )}
                       </div>
                     ))}
                     <button 
                        onClick={() => addStampToCurrentPage()}
                        className="w-full py-4 border-2 border-dashed border-slate-100 rounded-[1.5rem] text-slate-400 hover:text-blue-500 hover:border-blue-200 transition-all text-[10px] font-black flex items-center justify-center gap-2 uppercase"
                      >
                       <Plus className="w-4 h-4" /> Adicionar outro na Página {currentPage}
                     </button>
                   </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Preview Area */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-[3.5rem] p-8 min-h-[800px] flex items-center justify-center relative shadow-sm border border-slate-200 overflow-hidden">
               {status === 'done' && resultPdfUrl ? (
                 <div className="w-full h-full flex flex-col items-center animate-in zoom-in duration-500">
                    <div className="w-full h-[650px] rounded-[3rem] border-8 border-slate-50 shadow-2xl overflow-hidden relative">
                      <iframe src={`${resultPdfUrl}#toolbar=0`} className="w-full h-full" title="PDF Final" />
                    </div>
                    <div className="mt-10 flex flex-col items-center gap-6">
                      <div className="text-center">
                        <h2 className="text-3xl font-black tracking-tight">PDF Carimbado!</h2>
                        <p className="text-slate-400 font-medium">O carimbo foi aplicado em todas as páginas.</p>
                      </div>
                      <div className="flex gap-4">
                        <a 
                          href={resultPdfUrl} 
                          download="documento_carimbado.pdf" 
                          className="bg-green-600 text-white font-black px-12 py-5 rounded-[2rem] shadow-2xl shadow-green-100 hover:bg-green-700 transition-all flex items-center gap-4 group"
                        >
                          <Download className="w-6 h-6 group-hover:animate-bounce" /> BAIXAR DOCUMENTO
                        </a>
                        <button 
                          onClick={() => { setFile(null); setResultPdfUrl(null); setStatus('idle'); }} 
                          className="bg-slate-100 text-slate-600 font-black px-10 py-5 rounded-[2rem] hover:bg-slate-200 transition-all"
                        >
                          Novo Envio
                        </button>
                      </div>
                    </div>
                 </div>
               ) : file ? (
                 <div 
                   ref={previewRef} 
                   className={`bg-white w-full max-w-xl aspect-[1/1.41] shadow-[0_60px_100px_-20px_rgba(0,0,0,0.12)] relative border border-slate-150 select-none overflow-hidden transition-opacity ${isDragging ? 'opacity-90' : 'opacity-100'}`}
                 >
                    {/* Real PDF Page background image */}
                    {pageImageUrl ? (
                      <img 
                        src={pageImageUrl} 
                        alt="PDF Signature Page" 
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      /* Visual watermark fallback */
                      <div className="absolute inset-0 p-12 flex flex-col gap-6 opacity-[0.03] pointer-events-none">
                         <div className="h-4 bg-slate-900 w-1/4 rounded-full" />
                         <div className="h-4 bg-slate-900 w-full rounded-full" />
                         <div className="h-4 bg-slate-900 w-5/6 rounded-full" />
                         <div className="h-4 bg-slate-900 w-full rounded-full" />
                         <div className="mt-auto flex justify-between">
                           <div className="h-16 w-48 bg-slate-900 rounded-2xl" />
                           <div className="h-16 w-48 bg-slate-900 rounded-2xl" />
                         </div>
                      </div>
                    )}

                    {status === 'analyzing' && (
                       <div className="absolute inset-0 bg-white/98 z-50 flex flex-col items-center justify-center text-center p-12 backdrop-blur-xl animate-in fade-in duration-300">
                          <div className="relative mb-8">
                            <Loader2 className="w-20 h-20 text-blue-600 animate-spin" />
                            <Sparkles className="absolute -top-4 -right-4 w-10 h-10 text-blue-400 animate-pulse" />
                          </div>
                          <h4 className="font-black text-slate-900 text-3xl tracking-tighter">PROCESSANDO...</h4>
                          <p className="text-slate-400 mt-2 font-black uppercase text-[10px] tracking-[0.3em]">A IA está mapeando o documento</p>
                       </div>
                    )}

                    {status === 'stamping' && (
                       <div className="absolute inset-0 bg-blue-600/5 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center p-12">
                          <div className="bg-white p-10 rounded-[3rem] shadow-2xl space-y-6">
                            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto" />
                            <div className="space-y-1">
                              <p className="font-black text-slate-800 text-xl tracking-tight">CRIANDO PDF</p>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Renderizando todas as páginas</p>
                            </div>
                          </div>
                       </div>
                    )}

                    {stamps.filter(s => isStampVisibleOnPage(s, currentPage)).map(s => {
                      const pagePosition = getStampPositionForPage(s, currentPage);
                      return (
                        <div
                          key={`${s.id}-${currentPage}`}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setActiveStampId(s.id);
                            setIsDragging(true);
                          }}
                          className={`absolute bg-white border-[6px] border-blue-900 rounded-sm p-4 flex flex-col items-center text-center transition-all ${activeStampId === s.id ? 'z-10 shadow-2xl ring-8 ring-blue-500/10' : 'opacity-80 shadow-md hover:opacity-100 cursor-pointer'}`}
                          style={{
                          left: `${pagePosition.x * 100}%`,
                          top: `${pagePosition.y * 100}%`,
                          transform: `translate(-50%, -50%) rotate(-0.5deg) scale(${(s.scale || 1) * (activeStampId === s.id ? 1.03 : 1)})`,
                          transformOrigin: 'center',
                          mixBlendMode: 'multiply',
                          width: '210px',
                          minHeight: '100px',
                          cursor: isDragging && activeStampId === s.id ? 'grabbing' : 'grab'
                        }}
                        >
                         <div className="absolute -top-4 -left-4 text-blue-500 opacity-60">
                           <Crosshair className="w-8 h-8" />
                         </div>
                         <div className="flex flex-col gap-1.5 w-full">
                           {(info.customTextLines || []).map((line, lidx) => (
                             <div key={lidx} className="text-[14px] font-black text-blue-900 uppercase leading-[0.9] break-all">
                               {line || 'TEXTO VAZIO'}
                               {lidx < (info.customTextLines || []).length - 1 && (
                                 <div className="h-[1px] w-full bg-blue-900/10 mt-1" />
                               )}
                             </div>
                           ))}
                         </div>
                         {includeDate && (
                           <div className="text-[11px] font-bold text-blue-800/60 mt-3 italic border-t-2 border-blue-900/5 pt-2 w-full">
                             {formatDate(customDate)}
                           </div>
                         )}
                         {activeStampId === s.id && !isDragging && (
                           <div className="absolute -bottom-12 bg-slate-900 text-white text-[8px] font-black px-4 py-2 rounded-full flex items-center gap-2 shadow-2xl whitespace-nowrap animate-bounce">
                             <MousePointer2 className="w-3 h-3" /> ARRASTE PARA REPOSICIONAR
                           </div>
                         )}
                        </div>
                      );
                    })}

                    <button
                      onClick={(e) => { e.stopPropagation(); addStampToCurrentPage(); }}
                      className="absolute bottom-6 left-6 z-20 flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-full text-[10px] font-black uppercase shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all"
                      title={`Adicionar mais um carimbo na página ${currentPage}`}
                    >
                      <Plus className="w-4 h-4" /> Novo carimbo nesta página
                      <span className="bg-white/20 px-2 py-0.5 rounded-full">
                        {stamps.filter(s => isStampVisibleOnPage(s, currentPage)).length}
                      </span>
                    </button>
                    
                    <div className="absolute top-6 right-6 flex items-center gap-3 bg-slate-950/85 text-white font-black px-4 py-2.5 rounded-full text-xs shadow-xl backdrop-blur-md border border-white/10 select-none z-20">
                      <button 
                        disabled={currentPage <= 1}
                        onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.max(1, prev - 1)); }}
                        className="p-1 hover:text-blue-400 disabled:opacity-30 disabled:hover:text-white transition-colors"
                        title="Página Anterior"
                      >
                        <ChevronRight className="w-4 h-4 rotate-180" />
                      </button>
                      <span className="text-[10px] uppercase tracking-widest min-w-[75px] text-center">
                        Pág. {currentPage} / {totalPages}
                      </span>
                      <button 
                        disabled={currentPage >= totalPages}
                        onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.min(totalPages, prev + 1)); }}
                        className="p-1 hover:text-blue-400 disabled:opacity-30 disabled:hover:text-white transition-colors"
                        title="Próxima Página"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                 </div>
               ) : (
                 <div className="text-center space-y-10 group opacity-40">
                    <div className="bg-slate-50 w-40 h-40 rounded-[3.5rem] flex items-center justify-center mx-auto transform rotate-12 transition-all group-hover:rotate-0 border border-slate-100">
                      <FileText className="w-20 h-20 text-slate-200" />
                    </div>
                    <div className="space-y-3 px-10">
                      <p className="font-black text-slate-300 text-3xl tracking-tighter uppercase">Nenhum Documento</p>
                      <p className="text-slate-300/80 text-sm font-bold max-w-sm mx-auto uppercase tracking-widest leading-relaxed">
                        Arraste um contrato para começar. A IA preencherá o carimbo automaticamente.
                      </p>
                    </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
