import React, { useState, useMemo, FC } from 'react';
import { db } from '../database';
import type { CaseFile, Student, Teacher, CaseCategoryItem, PregnancyCase, FollowUp, User } from '../database';
import { useLiveQuery } from 'dexie-react-hooks';
import { PlusCircle, Printer, Eye, FileBarChart2 } from 'lucide-react';
import { CASE_PRIORITIES, CASE_STATUSES } from '../utils/constants';
import { Utils } from '../utils/helpers';
import { ExcelGenerator } from '../utils/excel';
import { PdfGenerator } from '../utils/pdf';
import Card from '../components/shared/Card';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import CaseFormModal from '../components/casos/CaseFormModal';
import CaseDetailModal from '../components/casos/CaseDetailModal';
import StudentProfileModal from '../components/shared/StudentProfileModal';
import PregnancyCaseFormModal from '../components/embarazos/PregnancyCaseFormModal';

const CasosPage: FC<{ currentUser: User }> = ({ currentUser }) => {
    const data = useLiveQuery(async () => {
        const cases = await db.caseFiles.orderBy('openingDate').reverse().toArray();
        const students = await db.students.toArray();
        const categories = await db.caseCategories.toArray();
        const teachers = await db.teachers.toArray();
        const followUps = await db.followUps.orderBy('date').toArray();

        // FIX: Add explicit type arguments to Map constructors for correct type inference.
        const studentMap = new Map<number, Student>(students.filter(s => s.id != null).map(s => [s.id!, s]));
        const teacherMap = new Map<number, Teacher>(teachers.filter(t => t.id != null).map(t => [t.id!, t]));
        
        const lastFollowUpMap = new Map<number, string>();
        followUps.forEach(f => {
            lastFollowUpMap.set(f.caseId, f.date);
        });

        const casesWithDetails = cases.map(c => {
            const student = studentMap.get(c.studentId);
            const tutor = student?.tutorId ? teacherMap.get(student.tutorId) : undefined;
            return {
                ...c, 
                student,
                tutor,
                lastFollowUpDate: lastFollowUpMap.get(c.id!)
            };
        });
        return { cases: casesWithDetails, students, categories };
    }, []);

    const [filters, setFilters] = useState({ studentId: '', status: '', priority: '', category: '' });
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const [isExcelLoading, setIsExcelLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [caseToEdit, setCaseToEdit] = useState<CaseFile | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] =useState(false);
    const [profileStudentId, setProfileStudentId] = useState<number | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [detailCaseId, setDetailCaseId] = useState<number | null>(null);
    
    // State for the new workflow
    const [isPregnancyModalOpen, setIsPregnancyModalOpen] = useState(false);
    const [newPregnancyData, setNewPregnancyData] = useState<Partial<PregnancyCase> | null>(null);

    const filteredCases = useMemo(() => {
        if (!data) return [];
        return data.cases.filter(c => {
            return (filters.studentId ? c.studentId === Number(filters.studentId) : true) &&
                   (filters.status ? c.status === filters.status : true) &&
                   (filters.priority ? c.priority === filters.priority : true) &&
                   (filters.category ? c.category === filters.category : true);
        });
    }, [data, filters]);
    
    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilters(prev => ({...prev, [e.target.name]: e.target.value }));
    };

    const handlePrint = async () => {
        setIsPdfLoading(true);
        try {
            const title = "Reporte de Expedientes de Casos";
            const columns = ["Código", "Estudiante", "Categoría", "Prioridad", "Estado", "Fecha Apertura", "Próx. Seguimiento"];
            const body = filteredCases.map(c => [
                c.code, c.student?.fullName || 'N/A', Utils.getSafeCategoryName(c.category), c.priority, c.status, 
                Utils.formatDate(c.openingDate), Utils.formatDate(c.dueDate)
            ]);
            const filterText = Object.entries(filters).map(([k,v]) => v ? `${k}:${v}`: null).filter(Boolean).join(', ') || "Ninguno";
            await PdfGenerator.generateReportPdf(title, columns, body, filterText);
        } catch (error) {
            console.error("PDF Export failed:", error);
            alert(`No se pudo generar el PDF: ${error}`);
        } finally {
            setIsPdfLoading(false);
        }
    };

    const handleExportExcel = async () => {
        if (!data) return;
        setIsExcelLoading(true);
        try {
            const exportData = filteredCases.map((c, index) => ({
                n: index + 1,
                student: c.student?.fullName || 'N/A',
                category: c.category,
                priority: c.priority,
                status: c.status,
                tutor: c.tutor?.fullName || 'N/A',
                lastFollowUp: c.lastFollowUpDate ? Utils.formatDate(c.lastFollowUpDate) : 'N/A',
            }));
            await ExcelGenerator.exportCasesMatrix(exportData);
        } catch (error) {
            console.error("Excel Export failed:", error);
            alert(`No se pudo generar el Excel: ${error}`);
        } finally {
            setIsExcelLoading(false);
        }
    };
    
    const openCaseDetail = (caseId: number) => {
        setDetailCaseId(caseId);
        setIsDetailModalOpen(true);
    };

    const openStudentProfile = (studentId: number) => {
        setProfileStudentId(studentId);
        setIsProfileModalOpen(true);
    };

    const handlePregnancyCaseTrigger = (studentId: number, caseId: number) => {
        setNewPregnancyData({ studentId, relatedCaseId: caseId });
        setIsModalOpen(false); // Close the case form modal
        setIsPregnancyModalOpen(true); // Open the pregnancy form modal
    };
    
    return (
        <div>
            <h1 className="text-3xl font-bold text-dece-blue-800 dark:text-dece-blue-200 mb-6">Expedientes de Casos</h1>
            
            <Card>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4 p-4 border rounded-md">
                    <select name="studentId" value={filters.studentId} onChange={handleFilterChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 col-span-2"><option value="">Todos los Estudiantes</option>{data?.students.map((s: Student) => <option key={s.id} value={s.id!}>{s.fullName}</option>)}</select>
                    <select name="status" value={filters.status} onChange={handleFilterChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"><option value="">Todos los Estados</option>{CASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
                    <select name="priority" value={filters.priority} onChange={handleFilterChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"><option value="">Todas las Prioridades</option>{CASE_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select>
                    <select name="category" value={filters.category} onChange={handleFilterChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 col-span-2">
                        <option value="">Todas las Categorías</option>
                        {data?.categories?.map(cat => (
                           <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex justify-end gap-2 mb-4">
                     <button onClick={handleExportExcel} disabled={isExcelLoading} className="btn-secondary flex items-center gap-2">
                       <FileBarChart2 size={18} /> {isExcelLoading ? 'Generando...' : 'Exportar a Excel'}
                    </button>
                     <button onClick={handlePrint} disabled={isPdfLoading} className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 font-semibold disabled:bg-gray-400">
                       <Printer size={18} /> {isPdfLoading ? '...' : ''}
                    </button>
                    <button onClick={() => { setCaseToEdit(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-dece-blue-600 text-white px-4 py-2 rounded-md hover:bg-dece-blue-700 font-semibold">
                        <PlusCircle size={18} /> Nuevo Caso
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {!data ? <LoadingSpinner /> : filteredCases.map(c => {
                        const semaforo = Utils.getSemaforoColor(c.dueDate);
                        return (
                            <Card key={c.id} className="cursor-pointer hover:shadow-xl transition-shadow" onClick={() => openCaseDetail(c.id!)}>
                                <div className="flex justify-between items-start">
                                    <div className="flex-grow">
                                        <p className="font-bold">{c.student?.fullName || 'Estudiante no encontrado'}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{c.category}</p>
                                        <p className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-1">{c.code}</p>
                                    </div>
                                    <div className="flex-shrink-0 flex items-center gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); openStudentProfile(c.studentId); }} className="p-1 text-blue-500 hover:text-blue-700"><Eye size={18} /></button>
                                        <div className={`w-3 h-3 rounded-full ${semaforo.bg}`}></div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center mt-4 text-xs">
                                    <span className={`px-2 py-0.5 rounded-full ${Utils.getPriorityBadge(c.priority)}`}>{c.priority}</span>
                                    <span>{c.status}</span>
                                    <span>Vence: {Utils.formatDate(c.dueDate)}</span>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </Card>

            {isModalOpen && <CaseFormModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                caseToEdit={caseToEdit} 
                students={data?.students || []} 
                categories={data?.categories || []}
                onPregnancyCaseCreated={handlePregnancyCaseTrigger}
            />}
            {isProfileModalOpen && <StudentProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} studentId={profileStudentId} />}
            {isDetailModalOpen && <CaseDetailModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} caseId={detailCaseId} currentUser={currentUser} />}
            {isPregnancyModalOpen && <PregnancyCaseFormModal 
                isOpen={isPregnancyModalOpen}
                onClose={() => setIsPregnancyModalOpen(false)}
                itemToEdit={newPregnancyData}
                students={data?.students || []}
                allCases={data?.caseFiles || []}
            />}
        </div>
    );
};

export default CasosPage;