
import React, { useState, FC } from 'react';
import { db } from '../database';
import type { PregnancyCase, Student, CaseFile, AssistedClass, Teacher, User } from '../database';
import { useLiveQuery } from 'dexie-react-hooks';
import { PlusCircle, Printer, Edit, Trash2, FolderOpen, FileText, FileSignature, FileBarChart2 } from 'lucide-react';
import Card from '../components/shared/Card';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { PdfGenerator } from '../utils/pdf';
import { ExcelGenerator } from '../utils/excel';
import { Utils } from '../utils/helpers';
import PregnancyCaseFormModal from '../components/embarazos/PregnancyCaseFormModal';
import CaseDetailModal from '../components/casos/CaseDetailModal';
import Modal from '../components/shared/Modal';
import AssistedClassFormModal from '../components/asistidas/AssistedClassFormModal';

type PregnancyCaseWithDetails = PregnancyCase & {
  student?: Student;
  caseCode?: string;
  tutor?: Teacher;
};

const PermissionNotificationModal: FC<{
    isOpen: boolean;
    onClose: () => void;
    pCase: PregnancyCaseWithDetails;
}> = ({ isOpen, onClose, pCase }) => {
    
    const handleGenerate = async (type: 'Maternidad' | 'Lactancia') => {
        if (!pCase.student) {
            alert("No se encontró la información del estudiante.");
            return;
        }
        try {
            await PdfGenerator.generatePermissionSlipPdf(type, pCase, pCase.student);
            onClose();
        } catch (e) {
            alert(`Error al generar PDF: ${e}`);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Generar Notificación de Permiso">
            <div className="space-y-4">
                <p>Seleccione el tipo de permiso para generar la notificación en PDF.</p>
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={() => handleGenerate('Maternidad')} 
                        disabled={!pCase.maternityLeaveStartDate}
                        className="btn-primary w-full"
                    >
                        Permiso de Maternidad
                    </button>
                    <button 
                        onClick={() => handleGenerate('Lactancia')} 
                        disabled={!pCase.lactationLeaveStartDate}
                        className="btn-primary w-full"
                    >
                        Permiso de Lactancia
                    </button>
                </div>
                {!pCase.maternityLeaveStartDate && !pCase.lactationLeaveStartDate &&
                    <p className="text-sm text-center text-gray-500">No hay fechas de inicio de permiso registradas para este caso.</p>
                }
            </div>
        </Modal>
    );
};


const EmbarazosPage: FC<{ currentUser: User }> = ({ currentUser }) => {
    const data = useLiveQuery(async (): Promise<{ cases: PregnancyCaseWithDetails[], students: Student[], caseFiles: CaseFile[] }> => {
        const pregnancyCases = await db.pregnancyCases.toArray();
        const studentIds = [...new Set(pregnancyCases.map(p => p.studentId))];
        const caseIds = [...new Set(pregnancyCases.map(p => p.relatedCaseId).filter(Boolean) as number[])];

        const allStudents: Student[] = await db.students.orderBy('fullName').toArray();
        const studentMap = new Map(allStudents.map(s => [s.id, s]));

        // FIX: Explicitly typing the `map` function's parameter ensures TypeScript correctly infers `s` as type `Student`.
        const tutorIds = [...new Set(allStudents.map((s: Student) => s.tutorId).filter(Boolean) as number[])];
        const allTutors = await db.teachers.where('id').anyOf(tutorIds).toArray();
        const tutorMap = new Map(allTutors.map(t => [t.id, t]));

        const caseFiles = await db.caseFiles.where('id').anyOf(caseIds).toArray();
        const caseMap = new Map(caseFiles.map(c => [c.id, c.code]));
        
        const cases = pregnancyCases.map(p => {
            const student = studentMap.get(p.studentId);
            const tutor = student?.tutorId ? tutorMap.get(student.tutorId) : undefined;
            return {
                ...p,
                student: student,
                tutor: tutor,
                caseCode: p.relatedCaseId ? caseMap.get(p.relatedCaseId) : undefined,
            };
        });
        
        return { cases, students: allStudents, caseFiles };
    }, []);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [itemToEdit, setItemToEdit] = useState<PregnancyCase | null>(null);
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const [isExcelLoading, setIsExcelLoading] = useState(false);
    const [isCaseDetailModalOpen, setCaseDetailModalOpen] = useState(false);
    const [detailCaseId, setDetailCaseId] = useState<number | null>(null);
    const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
    const [caseForPermission, setCaseForPermission] = useState<PregnancyCaseWithDetails | null>(null);
    const [isAssistedClassModalOpen, setIsAssistedClassModalOpen] = useState(false);
    const [initialAssistedData, setInitialAssistedData] = useState<Partial<AssistedClass> | null>(null);

    const handleDelete = async (id: number) => {
        if(window.confirm('¿Está seguro de que desea eliminar este registro?')) {
            try {
                await db.pregnancyCases.delete(id);
                alert('Registro eliminado con éxito.');
            } catch (error) {
                console.error('Error al eliminar registro:', error);
                alert(`No se pudo eliminar el registro. Error: ${error}`);
            }
        }
    };

    const handleGenerateReport = async () => {
        if (!data?.cases) return;
        setIsPdfLoading(true);
        try {
            await PdfGenerator.generatePregnancyCasesReportPdf(data.cases);
        } catch (e) {
            alert(`Error al generar PDF: ${e}`);
        } finally {
            setIsPdfLoading(false);
        }
    };

    const handleExportExcel = async () => {
        if (!data?.cases) return;
        setIsExcelLoading(true);
        try {
            await ExcelGenerator.exportPregnancyCases(data.cases);
        } catch (e) {
            alert(`Error al generar Excel: ${e}`);
        } finally {
            setIsExcelLoading(false);
        }
    };

    const openCaseDetail = (caseId: number) => {
        setDetailCaseId(caseId);
        setCaseDetailModalOpen(true);
    };

    const openPermissionModal = (pCase: PregnancyCaseWithDetails) => {
        setCaseForPermission(pCase);
        setIsPermissionModalOpen(true);
    };

    const handleSaveAndContinue = (data: { studentId: number; reason: string }) => {
        setIsModalOpen(false); // Close pregnancy modal
        setInitialAssistedData(data);
        setIsAssistedClassModalOpen(true);
    };
    
    const handleGenerateFlexibilityNotification = async (item: PregnancyCaseWithDetails) => {
        if (!item.student) return;
        setIsPdfLoading(true);
        try {
            await PdfGenerator.generateFlexibilityNotificationPdf(item, item.student, item.tutor);
        } catch (e) {
            alert(`Error al generar PDF: ${e}`);
        } finally {
            setIsPdfLoading(false);
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-dece-blue-800 dark:text-dece-blue-200 mb-6">Embarazo / Maternidad / Paternidad</h1>
            <Card>
                <div className="flex justify-end gap-2 mb-4">
                    <button onClick={handleExportExcel} disabled={isExcelLoading || !data?.cases.length} className="btn-secondary flex items-center gap-2">
                       <FileBarChart2 size={18} /> {isExcelLoading ? 'Generando...' : 'Exportar a Excel'}
                    </button>
                     <button onClick={handleGenerateReport} disabled={isPdfLoading || !data?.cases.length} className="btn-secondary flex items-center gap-2">
                       <Printer size={18} /> {isPdfLoading ? 'Generando...' : 'Generar Reporte'}
                    </button>
                    <button onClick={() => { setItemToEdit(null); setIsModalOpen(true); }} className="btn-primary flex items-center gap-2">
                        <PlusCircle size={18} /> Nuevo Registro
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="p-3 text-left">Estudiante</th>
                                <th className="p-3 text-left">Estado</th>
                                <th className="p-3 text-left hidden sm:table-cell">F.P.P / Nacimiento</th>
                                <th className="p-3 text-center">Riesgo</th>
                                <th className="p-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!data ? (<tr><td colSpan={5}><LoadingSpinner/></td></tr>) : data.cases.map(item => {
                                const status = Utils.getPregnancyStatus(item);
                                return (
                                <tr key={item.id} className="border-b dark:border-gray-700">
                                    <td className="p-3 font-medium">{item.student?.fullName || 'N/A'}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${status.color}`}>{status.text}</span>
                                    </td>
                                    <td className="p-3 hidden sm:table-cell">{Utils.formatDate(item.birthDate || item.estimatedDueDate)}</td>
                                    <td className="p-3 text-center">
                                        {item.isHighRisk && <span className="text-red-500 font-bold" title="Embarazo de Alto Riesgo">Sí</span>}
                                    </td>
                                    <td className="p-3 text-right">
                                        {item.alternativeEducationType === 'flexible' && (
                                            <button onClick={() => handleGenerateFlexibilityNotification(item)} className="p-1 text-green-500 hover:text-green-700" title="Generar Notificación de Flexibilidad"><FileSignature size={18} /></button>
                                        )}
                                        <button onClick={() => openPermissionModal(item)} className="p-1 text-purple-500 hover:text-purple-700" title="Generar Notificación de Permiso"><FileText size={18} /></button>
                                        {item.relatedCaseId && (
                                            <button onClick={() => openCaseDetail(item.relatedCaseId!)} className="p-1 text-blue-500 hover:text-blue-700" title={`Ver Expediente: ${item.caseCode}`}>
                                                <FolderOpen size={18} />
                                            </button>
                                        )}
                                        <button onClick={() => { setItemToEdit(item); setIsModalOpen(true); }} className="p-1 text-yellow-500 hover:text-yellow-700" title="Editar"><Edit size={18} /></button>
                                        <button onClick={() => handleDelete(item.id!)} className="p-1 text-red-500 hover:text-red-700" title="Eliminar"><Trash2 size={18} /></button>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                     {data && data.cases.length === 0 && <p className="text-center text-gray-500 py-4">No hay registros.</p>}
                </div>
            </Card>
            {isModalOpen && <PregnancyCaseFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSaveAndContinue={handleSaveAndContinue} itemToEdit={itemToEdit} students={data?.students || []} allCases={data?.caseFiles || []} />}
            {isAssistedClassModalOpen && <AssistedClassFormModal isOpen={isAssistedClassModalOpen} onClose={() => setIsAssistedClassModalOpen(false)} itemToEdit={null} initialData={initialAssistedData} />}
            {isCaseDetailModalOpen && <CaseDetailModal isOpen={isCaseDetailModalOpen} onClose={() => setCaseDetailModalOpen(false)} caseId={detailCaseId} currentUser={currentUser} />}
            {isPermissionModalOpen && caseForPermission && <PermissionNotificationModal isOpen={isPermissionModalOpen} onClose={() => setIsPermissionModalOpen(false)} pCase={caseForPermission} />}
        </div>
    );
};

export default EmbarazosPage;
