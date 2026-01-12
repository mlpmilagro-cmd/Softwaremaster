import React, { FC, useState } from 'react';
import { db } from '../database';
import type { FollowUp, CaseFile, Student, User } from '../database';
import { useLiveQuery } from 'dexie-react-hooks';
import Card from '../components/shared/Card';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { Utils } from '../utils/helpers';
import { Eye } from 'lucide-react';
import CaseDetailModal from '../components/casos/CaseDetailModal';


type FollowUpWithDetails = FollowUp & {
    caseInfo?: CaseFile;
    studentName?: string;
}

const FollowUpsPage: FC<{ currentUser: User }> = ({ currentUser }) => {
    const data = useLiveQuery(async () => {
        const followUps = await db.followUps.orderBy('date').reverse().toArray();
        const caseIds = [...new Set(followUps.map(f => f.caseId))];
        const cases = await db.caseFiles.where('id').anyOf(caseIds).toArray();
        const studentIds = [...new Set(cases.map(c => c.studentId))];
        const students = await db.students.where('id').anyOf(studentIds).toArray();

        // FIX: Explicitly typed Map constructor and filtered for non-null IDs to ensure type safety.
        const caseMap = new Map<number, CaseFile>(cases.filter(c => c.id != null).map(c => [c.id!, c]));
        const studentMap = new Map<number, Student>(students.filter(s => s.id != null).map(s => [s.id!, s]));
        
        return followUps.map(f => {
            const caseFile = caseMap.get(f.caseId);
            return {
                ...f,
                caseInfo: caseFile,
                studentName: caseFile ? studentMap.get(caseFile.studentId)?.fullName : 'N/A'
            };
        });
    }, []);

    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [detailCaseId, setDetailCaseId] = useState<number | null>(null);

    const openCaseDetail = (caseId: number) => {
        setDetailCaseId(caseId);
        setIsDetailModalOpen(true);
    };

    if (!data) return <LoadingSpinner />;
    
    return (
        <div>
            <h1 className="text-3xl font-bold text-dece-blue-800 dark:text-dece-blue-200 mb-6">Historial de Seguimientos</h1>
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="p-3 text-left">Fecha Seguimiento</th>
                                <th className="p-3 text-left">Estudiante</th>
                                <th className="p-3 text-left">Descripción</th>
                                <th className="p-3 text-left">Vencimiento Caso</th>
                                <th className="p-3 text-left hidden sm:table-cell">Responsable</th>
                                <th className="p-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((f: FollowUpWithDetails) => {
                                const semaforo = f.caseInfo ? Utils.getSemaforoColor(f.caseInfo.dueDate) : {bg: 'bg-gray-400', label: 'N/A'};
                                return (
                                    <tr key={f.id} className="border-b dark:border-gray-700">
                                        <td className="p-3">{Utils.formatDate(f.date)}</td>
                                        <td className="p-3 font-medium">{f.studentName}</td>
                                        <td className="p-3">{f.description}</td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full ${semaforo.bg}`}></div>
                                                <span>{f.caseInfo ? Utils.formatDate(f.caseInfo.dueDate) : 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 hidden sm:table-cell">{f.responsible}</td>
                                        <td className="p-3 text-right">
                                            {f.caseInfo && (
                                                <button onClick={() => openCaseDetail(f.caseInfo.id!)} className="p-1 text-blue-500 hover:text-blue-700" title="Ver Expediente del Caso">
                                                    <Eye size={18} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
             {isDetailModalOpen && <CaseDetailModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} caseId={detailCaseId} currentUser={currentUser} />}
        </div>
    );
};

export default FollowUpsPage;