
import React, { useState, FC } from 'react';
import { db } from '../../database';
import type { Student, Representative, CaseFile, FollowUp, Course } from '../../database';
import { useLiveQuery } from 'dexie-react-hooks';
import { User as UserIcon, FileDown, FileText, ClipboardList } from 'lucide-react';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';
import { Utils } from '../../utils/helpers';
import { PdfGenerator } from '../../utils/pdf';

interface StudentProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    studentId: number | null;
}

const StudentProfileModal: FC<StudentProfileModalProps> = ({ isOpen, onClose, studentId }) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isGeneratingHistory, setIsGeneratingHistory] = useState(false);
    const [isGeneratingFollowUpsPdf, setIsGeneratingFollowUpsPdf] = useState(false);

    const studentData = useLiveQuery(async () => {
        if (!studentId) return null;
        const student = await db.students.get(studentId);
        if (!student) return null;
        
        const representative = await db.representatives.get(student.representativeId);
        const cases = await db.caseFiles.where('studentId').equals(studentId).toArray();
        const caseIds = cases.map(c => c.id!);
        const followUps = await db.followUps.where('caseId').anyOf(caseIds).toArray();
        
        const followUpsMap = new Map<number, FollowUp[]>();
        const allFollowUps: FollowUp[] = [];

        followUps.forEach(f => {
            if (!followUpsMap.has(f.caseId)) {
                followUpsMap.set(f.caseId, []);
            }
            followUpsMap.get(f.caseId)!.push(f);
            allFollowUps.push(f);
        });
        allFollowUps.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const courseInfo = await db.courses.where({ name: student.course, parallel: student.parallel }).first();
        
        return { student, representative, cases, followUpsMap, allFollowUps, courseInfo };
    }, [studentId]);

    const handleExportProfile = async () => {
        if (!studentData) return;
        setIsGeneratingPdf(true);
        try {
            await PdfGenerator.generateStudentProfilePdf(studentData.student, studentData.representative, studentData.cases);
        } catch (error) {
            console.error("PDF Export failed:", error);
            alert(`No se pudo generar el PDF: ${error}`);
        } finally {
            setIsGeneratingPdf(false);
        }
    };
    
    const handleExportHistory = async () => {
        if (!studentData) return;
        setIsGeneratingHistory(true);
        try {
            await PdfGenerator.generateStudentHistoryPdf(studentData.student, studentData.representative, studentData.cases, studentData.followUpsMap);
        } catch (error) {
            console.error("PDF History Export failed:", error);
            alert(`No se pudo generar el historial: ${error}`);
        } finally {
            setIsGeneratingHistory(false);
        }
    };

    const handleExportFollowUps = async () => {
        if (!studentData || !studentData.allFollowUps) return;
        setIsGeneratingFollowUpsPdf(true);
        try {
            await PdfGenerator.generateStudentFollowUpsPdf(studentData.student, studentData.representative, studentData.allFollowUps, studentData.courseInfo);
        } catch (error) {
            console.error("Follow-ups PDF Export failed:", error);
            alert(`No se pudo generar el PDF de seguimientos: ${error}`);
        } finally {
            setIsGeneratingFollowUpsPdf(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Perfil del Estudiante" size="2xl">
            {!studentData ? <LoadingSpinner /> : (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row gap-6 items-start">
                        {studentData.student.photoBase64 
                            ? <img src={studentData.student.photoBase64} alt="Foto" className="w-32 h-32 object-cover rounded-full flex-shrink-0" /> 
                            : <div className="w-32 h-32 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0"><UserIcon size={64} className="text-gray-400" /></div>}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm w-full">
                            <div className="col-span-3 sm:col-span-3"><p className="font-bold text-gray-500 dark:text-gray-400">Nombre Completo</p><p className="text-lg font-semibold">{studentData.student.fullName}</p></div>
                            <div><p className="font-bold text-gray-500 dark:text-gray-400">Cédula</p><p>{studentData.student.cedula}</p></div>
                            <div><p className="font-bold text-gray-500 dark:text-gray-400">Edad</p><p>{Utils.calculateAge(studentData.student.birthDate).display}</p></div>
                             <div><p className="font-bold text-gray-500 dark:text-gray-400">Curso</p><p>{`${studentData.student.course} "${studentData.student.parallel}"`}</p></div>
                            {studentData.student.specialCondition && <div className="col-span-2 sm:col-span-3"><p className="font-bold text-gray-500 dark:text-gray-400">Condición Especial</p><p className="text-amber-700 dark:text-amber-400">{studentData.student.specialCondition}</p></div>}
                        </div>
                    </div>
                    
                    <div>
                        <h4 className="text-lg font-semibold mb-2 border-b pb-1">Representante Legal</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                            <div><p className="font-bold text-gray-500 dark:text-gray-400">Nombre</p><p>{studentData.representative?.fullName || 'N/A'}</p></div>
                            <div><p className="font-bold text-gray-500 dark:text-gray-400">Cédula</p><p>{studentData.representative?.cedula || 'N/A'}</p></div>
                            <div><p className="font-bold text-gray-500 dark:text-gray-400">Teléfono</p><p>{studentData.representative?.phone || 'N/A'}</p></div>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-lg font-semibold mb-2 border-b pb-1">Expedientes de Casos</h4>
                        {studentData.cases.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="p-2">Código</th><th className="p-2">Categoría</th><th className="p-2">Prioridad</th><th className="p-2">Estado</th><th className="p-2">Fecha</th></tr></thead>
                                    <tbody>{studentData.cases.map(c => (
                                        <tr key={c.id} className="border-b dark:border-gray-700">
                                            <td className="p-2 font-mono text-xs">{c.code}</td>
                                            <td className="p-2">{c.category}</td>
                                            <td className="p-2"><span className={`px-2 py-0.5 text-xs rounded-full ${Utils.getPriorityBadge(c.priority)}`}>{c.priority}</span></td>
                                            <td className="p-2">{c.status}</td>
                                            <td className="p-2">{Utils.formatDate(c.openingDate)}</td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                            </div>
                        ) : <p className="text-gray-500 text-sm">No hay casos registrados para este estudiante.</p>}
                    </div>
                    <div className="flex justify-end flex-wrap pt-4 gap-3 border-t dark:border-gray-700">
                        <button onClick={handleExportProfile} disabled={isGeneratingPdf} className="flex items-center gap-2 px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 font-semibold disabled:bg-gray-400">
                            <FileDown size={18} /> {isGeneratingPdf ? 'Generando...' : 'Ficha Simple PDF'}
                        </button>
                        <button onClick={handleExportHistory} disabled={isGeneratingHistory} className="flex items-center gap-2 px-4 py-2 rounded bg-dece-blue-600 text-white hover:bg-dece-blue-700 font-semibold disabled:bg-gray-400">
                             <FileText size={18} /> {isGeneratingHistory ? 'Generando...' : 'Historial Completo PDF'}
                        </button>
                         <button onClick={handleExportFollowUps} disabled={isGeneratingFollowUpsPdf} className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 font-semibold disabled:bg-gray-400">
                             <ClipboardList size={18} /> {isGeneratingFollowUpsPdf ? 'Generando...' : 'Reporte Seguimientos'}
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default StudentProfileModal;
