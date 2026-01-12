import React, { useState, useMemo, FC, useEffect } from 'react';
import { db } from '../database';
import type { Teacher, EducandoEnFamilia, Institution, PefReport, Course } from '../database';
import { useLiveQuery } from 'dexie-react-hooks';
import { PlusCircle, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileDown, Download } from 'lucide-react';
import Card from '../components/shared/Card';
import EvaluationModal from '../components/educando/EvaluationModal';
import { Utils } from '../utils/helpers';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Modal from '../components/shared/Modal';
import { PdfGenerator } from '../utils/pdf';

type EligibleTeacher = Teacher & { unreportedHours: number; teacherEvals: EducandoEnFamilia[] };
type ExportFormat = 'csv' | 'pdf';

const ReportGenerationModal: FC<{
    isOpen: boolean;
    onClose: () => void;
    eligibleTeachers: EligibleTeacher[];
    onGenerate: (selectedTeachers: EligibleTeacher[], format: ExportFormat) => void;
}> = ({ isOpen, onClose, eligibleTeachers, onGenerate }) => {
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');

    useEffect(() => {
        if (isOpen) {
            setSelectedIds(eligibleTeachers.map(t => t.id!));
        }
    }, [isOpen, eligibleTeachers]);

    const handleToggle = (id: number) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]);
    };

    const handleGenerate = () => {
        const selected = eligibleTeachers.filter(t => selectedIds.includes(t.id!));
        onGenerate(selected, exportFormat);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Generar Reporte de Cumplimiento">
            <div className="space-y-4">
                <p>Docentes elegibles (30 horas cumplidas no reportadas):</p>
                <div className="max-h-60 overflow-y-auto border rounded p-2">
                    {eligibleTeachers.map(t => (
                        <div key={t.id} className="flex items-center gap-2 p-1">
                            <input type="checkbox" checked={selectedIds.includes(t.id!)} onChange={() => handleToggle(t.id!)} />
                            <span>{t.fullName} ({t.unreportedHours}h)</span>
                        </div>
                    ))}
                </div>
                <div>
                    <label>Formato de Exportación:</label>
                    <select value={exportFormat} onChange={e => setExportFormat(e.target.value as ExportFormat)} className="ml-2 p-1 border rounded dark:bg-gray-700">
                        <option value="csv">CSV (Excel)</option>
                        <option value="pdf">PDF</option>
                    </select>
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="btn-secondary">Cancelar</button>
                    <button onClick={handleGenerate} className="btn-primary" disabled={selectedIds.length === 0}>Generar</button>
                </div>
            </div>
        </Modal>
    );
};

const EducandoEnFamiliaPage: FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
    const [teacherToEvaluate, setTeacherToEvaluate] = useState<Teacher | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const data = useLiveQuery(async () => {
        const teachers = await db.teachers.orderBy('fullName').toArray();
        const evaluations = await db.educandoEnFamilia.toArray();
        const reports = await db.pefReports.orderBy('reportDate').reverse().toArray();
        
        // Explicitly type the map to fix type inference issues
        const evaluationMap = new Map<number, EducandoEnFamilia[]>();
        evaluations.forEach(ev => {
            const current = evaluationMap.get(ev.teacherId) || [];
            current.push(ev);
            evaluationMap.set(ev.teacherId, current);
        });

        const teachersWithStats = teachers.map(t => {
            const teacherEvals = evaluationMap.get(t.id!) || [];
            const totalHours = teacherEvals.reduce((sum, ev) => sum + ev.hours, 0);
            const unreportedHours = teacherEvals.filter(ev => !ev.reportId).reduce((sum, ev) => sum + ev.hours, 0);
            return { ...t, teacherEvals, totalHours, unreportedHours };
        });

        return { teachersWithStats, reports };
    }, []);

    const filteredTeachers = useMemo(() => {
        if (!data) return [];
        return data.teachersWithStats.filter(t => t.fullName.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [data, searchTerm]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredTeachers.length / itemsPerPage);
    const paginatedTeachers = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredTeachers.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredTeachers, currentPage]);

    const eligibleTeachers = useMemo(() => {
        return filteredTeachers.filter(t => t.unreportedHours >= 30);
    }, [filteredTeachers]);

    const handleOpenEvaluation = (teacher: Teacher) => {
        setTeacherToEvaluate(teacher);
        setIsEvaluationModalOpen(true);
    };

    const handleGenerateReport = async (selectedTeachers: EligibleTeacher[], format: ExportFormat) => {
        try {
            const reportDate = new Date().toISOString().split('T')[0];
            const reportId = await db.pefReports.add({ reportDate });

            const csvRows: any[] = [];
            
            for (const teacher of selectedTeachers) {
                // Find unreported evaluations to link to this report
                const evaluationsToUpdate = teacher.teacherEvals.filter((ev: EducandoEnFamilia) => !ev.reportId); // Explicit type
                
                // Get oldest start date and newest end date from these evaluations
                const dates = evaluationsToUpdate.map((ev: EducandoEnFamilia) => ({ start: new Date(ev.startDate), end: new Date(ev.endDate) }));
                if (dates.length > 0) {
                    const minDate = new Date(Math.min(...dates.map((d: any) => d.start.getTime()))).toISOString().split('T')[0];
                    const maxDate = new Date(Math.max(...dates.map((d: any) => d.end.getTime()))).toISOString().split('T')[0];
                    
                    csvRows.push([teacher.cedula, teacher.fullName, minDate, maxDate]);
                }

                // Update evaluations with reportId
                await Promise.all(evaluationsToUpdate.map((ev: EducandoEnFamilia) => db.educandoEnFamilia.update(ev.id!, { reportId })));
            }

            if (format === 'csv') {
                Utils.exportToCsv(`Reporte_PeF_${reportDate}.csv`, ['CÉDULA', 'APELLIDOS Y NOMBRES', 'FECHA INICIO', 'FECHA FIN'], csvRows);
            } else {
                await PdfGenerator.generatePefReportPdf(csvRows);
            }

            setIsReportModalOpen(false);
            alert("Reporte generado y evaluaciones actualizadas.");
        } catch (e) {
            console.error(e);
            alert("Error al generar reporte.");
        }
    };

    const handleDownloadEvaluationPdf = async (ev: EducandoEnFamilia, teacher: Teacher) => {
        try {
            await PdfGenerator.generateEvaluationPdf(ev, teacher);
        } catch (e) {
            alert(`Error al generar PDF: ${e}`);
        }
    };

    if (!data) return <LoadingSpinner />;

    return (
        <div>
            <h1 className="text-3xl font-bold text-dece-blue-800 dark:text-dece-blue-200 mb-6">Programa Educando en Familia</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <Card className="lg:col-span-2">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                        <div className="relative w-full sm:w-64">
                            <input type="text" placeholder="Buscar docente..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full p-2 pl-10 border rounded dark:bg-gray-700 dark:border-gray-600" />
                            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                        <button 
                            onClick={() => setIsReportModalOpen(true)} 
                            disabled={eligibleTeachers.length === 0}
                            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FileDown size={18} /> Generar Reporte ({eligibleTeachers.length})
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100 dark:bg-gray-700">
                                <tr>
                                    <th className="p-2 text-left">Docente</th>
                                    <th className="p-2 text-center">Módulos</th>
                                    <th className="p-2 text-center">Horas Acum.</th>
                                    <th className="p-2 text-center">Por Reportar</th>
                                    <th className="p-2 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedTeachers.map((t: any) => (
                                    <React.Fragment key={t.id}>
                                        <tr className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                                            <td className="p-2 font-medium">{t.fullName}</td>
                                            <td className="p-2 text-center">{t.teacherEvals.length}</td>
                                            <td className="p-2 text-center">{t.totalHours}</td>
                                            <td className="p-2 text-center font-bold text-orange-600">{t.unreportedHours}</td>
                                            <td className="p-2 text-right">
                                                <button onClick={() => handleOpenEvaluation(t)} className="text-dece-blue-600 hover:underline text-xs flex items-center justify-end gap-1 ml-auto">
                                                    <PlusCircle size={14}/> Evaluar
                                                </button>
                                            </td>
                                        </tr>
                                        {/* Sub-row for modules */}
                                        {t.teacherEvals.length > 0 && (
                                            <tr>
                                                <td colSpan={5} className="bg-gray-50 dark:bg-gray-800/50 p-2 pl-8">
                                                    <div className="text-xs space-y-1">
                                                        {t.teacherEvals.map((ev: EducandoEnFamilia) => (
                                                            <div key={ev.id} className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-1 last:border-0">
                                                                <span>{ev.moduleName} ({ev.score}/8) - {ev.hours}h</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`px-1.5 rounded text-[10px] ${ev.reportId ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                                        {ev.reportId ? 'Reportado' : 'Pendiente'}
                                                                    </span>
                                                                    <button onClick={() => handleDownloadEvaluationPdf(ev, t)} className="text-gray-500 hover:text-gray-700" title="Descargar Ficha"><Download size={12}/></button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex justify-between items-center mt-4 text-sm text-gray-600 dark:text-gray-400">
                            <span>Página {currentPage} de {totalPages}</span>
                            <div className="flex gap-1">
                                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"><ChevronsLeft size={18}/></button>
                                <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"><ChevronLeft size={18}/></button>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"><ChevronRight size={18}/></button>
                                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"><ChevronsRight size={18}/></button>
                            </div>
                        </div>
                    )}
                </Card>

                <Card>
                    <h3 className="font-semibold mb-4">Historial de Reportes Generados</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {data.reports.map((r: PefReport) => (
                            <div key={r.id} className="p-3 border rounded-md dark:border-gray-600 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                                <div>
                                    <p className="text-sm font-medium">Reporte #{r.id}</p>
                                    <p className="text-xs text-gray-500">{Utils.formatDate(r.reportDate)}</p>
                                </div>
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Completado</span>
                            </div>
                        ))}
                        {data.reports.length === 0 && <p className="text-sm text-gray-500 text-center">No hay reportes generados.</p>}
                    </div>
                </Card>
            </div>

            {isEvaluationModalOpen && teacherToEvaluate && (
                <EvaluationModal 
                    isOpen={isEvaluationModalOpen} 
                    onClose={() => setIsEvaluationModalOpen(false)} 
                    teacher={teacherToEvaluate} 
                />
            )}

            {isReportModalOpen && (
                <ReportGenerationModal
                    isOpen={isReportModalOpen}
                    onClose={() => setIsReportModalOpen(false)}
                    eligibleTeachers={eligibleTeachers}
                    onGenerate={handleGenerateReport}
                />
            )}
        </div>
    );
};

export default EducandoEnFamiliaPage;