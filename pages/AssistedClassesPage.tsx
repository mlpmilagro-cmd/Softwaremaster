import React, { useState, useEffect, FC } from 'react';
import { db } from '../database';
import type { AssistedClass, Student, Teacher, User } from '../database';
import { useLiveQuery } from 'dexie-react-hooks';
import { PlusCircle, Printer, FileText, Edit, Trash2, FileBarChart2, MessageSquare } from 'lucide-react';
import Card from '../components/shared/Card';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import AssistedClassFormModal from '../components/asistidas/AssistedClassFormModal';
import { Utils } from '../utils/helpers';
import { PdfGenerator } from '../utils/pdf';
import { ExcelGenerator } from '../utils/excel';

type AssistedClassWithDetails = AssistedClass & {
  student?: Student;
  tutor?: Teacher;
};

const AssistedClassesPage: FC<{ currentUser: User }> = ({ currentUser }) => {
    const data = useLiveQuery(async (): Promise<AssistedClassWithDetails[]> => {
        const assisted: AssistedClass[] = await db.assistedClasses.orderBy('tentativeReturnDate').toArray();
        const students: Student[] = await db.students.where('id').anyOf(assisted.map(a => a.studentId)).toArray();
        const studentMap = new Map(students.map(s => [s.id, s]));
        const tutors: Teacher[] = await db.teachers.where('id').anyOf(students.map(s => s.tutorId).filter(Boolean) as number[]).toArray();
        const tutorMap = new Map(tutors.map(t => [t.id, t]));
        
        return assisted.map(a => {
            const student: Student | undefined = studentMap.get(a.studentId);
            const tutor: Teacher | undefined = student?.tutorId ? tutorMap.get(student.tutorId) : undefined;
            return {
                ...a,
                student,
                tutor
            };
        });
    }, []);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [itemToEdit, setItemToEdit] = useState<AssistedClass | null>(null);
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const [isExcelLoading, setIsExcelLoading] = useState(false);
    
    const handleDelete = async (id: number) => {
        if(window.confirm('¿Está seguro de que desea eliminar este registro?')) {
            await db.assistedClasses.delete(id);
        }
    };
    
    const handleGenerateGeneralReport = async () => {
        if (!data) return;
        setIsPdfLoading(true);
        try {
            const reportData = data.map(item => ({
                studentName: item.student?.fullName || 'N/A',
                studentCourse: item.student?.course || 'N/A',
                studentParallel: item.student?.parallel || 'N/A',
                tutorName: item.tutor?.fullName || 'N/A',
                reason: item.reason,
                tentativeReturnDate: item.tentativeReturnDate
            }));
            await PdfGenerator.generateAssistedClassesReportPdf(reportData, "Ninguno");
        } catch (e) {
            alert(`Error al generar PDF: ${e}`);
        } finally {
            setIsPdfLoading(false);
        }
    };
    
    const handleExportExcel = async () => {
        if (!data) return;
        setIsExcelLoading(true);
        try {
            await ExcelGenerator.exportAssistedClasses(data);
        } catch (e) {
            alert(`Error al generar Excel: ${e}`);
        } finally {
            setIsExcelLoading(false);
        }
    };

    const handleGenerateTutorNotification = async (item: AssistedClassWithDetails) => {
        if (!item.student || !item.tutor) {
            alert("La información del estudiante o del tutor no está completa para generar la notificación.");
            return;
        }
        setIsPdfLoading(true);
        try {
            await PdfGenerator.generateTutorNotificationPdf(item, item.student, item.tutor, currentUser);
        } catch (e) {
            alert(`Error al generar PDF: ${e}`);
        } finally {
            setIsPdfLoading(false);
        }
    };

    const handleNotifyWhatsApp = async (item: AssistedClassWithDetails) => {
        if (!item.student) return;
        const representative = await db.representatives.get(item.student.representativeId);
        if (!representative || !representative.phone) {
            alert('El representante no tiene un número de teléfono registrado.');
            return;
        }

        let phoneNumber = representative.phone.trim();
        if (phoneNumber.startsWith('0')) {
            phoneNumber = phoneNumber.substring(1);
        }
        const fullPhoneNumber = `593${phoneNumber}`;
        
        const message = `Estimado/a ${representative.fullName}, le recordamos que el periodo de clases asistidas para el/la estudiante ${item.student.fullName} está por finalizar. Su fecha de retorno es el ${Utils.formatDate(item.tentativeReturnDate)}. Es importante que se acerque a la institución para coordinar la entrega de actividades pendientes.\n\nSaludos cordiales,\nDECE.`;
        const encodedMessage = encodeURIComponent(message);
        const url = `https://wa.me/${fullPhoneNumber}?text=${encodedMessage}`;
        window.open(url, '_blank');
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-dece-blue-800 dark:text-dece-blue-200 mb-6">Gestión de Clases Asistidas</h1>
            <Card>
                <div className="flex justify-end gap-2 mb-4">
                     <button onClick={handleExportExcel} disabled={isExcelLoading} className="btn-secondary flex items-center gap-2">
                       <FileBarChart2 size={18} /> {isExcelLoading ? 'Generando...' : 'Exportar a Excel'}
                    </button>
                     <button onClick={handleGenerateGeneralReport} disabled={isPdfLoading} className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 font-semibold disabled:bg-gray-400">
                       <Printer size={18} /> {isPdfLoading ? 'Generando...' : 'Generar Reporte'}
                    </button>
                    <button onClick={() => { setItemToEdit(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-dece-blue-600 text-white px-4 py-2 rounded-md hover:bg-dece-blue-700 font-semibold">
                        <PlusCircle size={18} /> Nuevo Registro
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="p-3 text-left">Estudiante</th>
                                <th className="p-3 text-left hidden md:table-cell">Curso</th>
                                <th className="p-3 text-left hidden lg:table-cell">Motivo</th>
                                <th className="p-3 text-left">Fecha de Retorno</th>
                                <th className="p-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!data ? (<tr><td colSpan={5}><LoadingSpinner/></td></tr>) : data.map(item => {
                                const semaforo = Utils.getAssistedClassSemaforo(item.tentativeReturnDate);
                                const diffDays = Utils.getDaysUntil(item.tentativeReturnDate);
                                const canNotify = diffDays >= 0 && diffDays <= 4;

                                return (
                                    <tr key={item.id} className="border-b dark:border-gray-700">
                                        <td className="p-3 font-medium">{item.student?.fullName || 'N/A'}</td>
                                        <td className="p-3 hidden md:table-cell">{item.student ? `${item.student.course} "${item.student.parallel}"` : 'N/A'}</td>
                                        <td className="p-3 hidden lg:table-cell" style={{maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={item.reason}>{item.reason}</td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full ${semaforo.bg}`}></div>
                                                <span>{Utils.formatDate(item.tentativeReturnDate)}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <button onClick={() => handleNotifyWhatsApp(item)} disabled={!canNotify} className="p-1 text-green-500 hover:text-green-700 disabled:text-gray-400 disabled:cursor-not-allowed" title="Notificar Retorno por WhatsApp"><MessageSquare size={18} /></button>
                                            <button onClick={() => handleGenerateTutorNotification(item)} className="p-1 text-purple-500 hover:text-purple-700" title="Generar Notificación para Tutor"><FileText size={18} /></button>
                                            <button onClick={() => { setItemToEdit(item); setIsModalOpen(true); }} className="p-1 text-yellow-500 hover:text-yellow-700" title="Editar"><Edit size={18} /></button>
                                            <button onClick={() => handleDelete(item.id!)} className="p-1 text-red-500 hover:text-red-700" title="Eliminar"><Trash2 size={18} /></button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
            {isModalOpen && <AssistedClassFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} itemToEdit={itemToEdit} />}
        </div>
    );
};

export default AssistedClassesPage;