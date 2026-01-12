import React, { useState, useMemo, FC } from 'react';
import { db } from '../database';
import type { CaseFile, Student, SexualViolenceCaseDetails, FollowUp } from '../database';
import type Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { PlusCircle, Search, FileBarChart, Activity, FileText } from 'lucide-react';
import Card from '../components/shared/Card';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { Utils } from '../utils/helpers';
import { PdfGenerator } from '../utils/pdf';
import SexualViolenceCaseFormModal from '../components/violencia/SexualViolenceCaseFormModal';
import SexualViolenceFollowUpModal from '../components/violencia/SexualViolenceFollowUpModal';

type CaseWithDetails = CaseFile & { 
    student?: Student;
    details?: SexualViolenceCaseDetails;
    lastFollowUpDate?: string;
};

const SexualViolenceCasesPage: FC = () => {
    const data = useLiveQuery(async () => {
        const cases: CaseFile[] = await db.caseFiles.where('category').equals('Violencia Sexual').toArray();
        const caseIds = cases.map(c => c.id!);
        
        const students = await db.students.where('id').anyOf(cases.map(c => c.studentId)).toArray();
        const studentMap = new Map<number, Student>(students.filter(s => s.id).map(s => [s.id!, s]));

        const details = await db.sexualViolenceCaseDetails.where('caseFileId').anyOf(caseIds).toArray();
        const detailsMap = new Map<number, SexualViolenceCaseDetails>(details.map(d => [d.caseFileId, d]));
        
        const followUps = await db.followUps.where('caseId').anyOf(caseIds).toArray();
        const lastFollowUpMap = new Map<number, string>();
        followUps.forEach(f => {
            const existing = lastFollowUpMap.get(f.caseId);
            if (!existing || new Date(f.date) > new Date(existing)) {
                lastFollowUpMap.set(f.caseId, f.date);
            }
        });

        const casesWithDetails: CaseWithDetails[] = cases.map(c => ({
            ...c,
            student: studentMap.get(c.studentId),
            details: detailsMap.get(c.id!),
            lastFollowUpDate: lastFollowUpMap.get(c.id!)
        }));

        return casesWithDetails.sort((a,b) => new Date(b.openingDate).getTime() - new Date(a.openingDate).getTime());
    }, []);

    const [searchTerm, setSearchTerm] = useState('');
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
    const [selectedCase, setSelectedCase] = useState<CaseWithDetails | null>(null);

    const filteredData = useMemo(() => {
        if (!data) return [];
        const lowerSearch = searchTerm.toLowerCase();
        return data.filter(c => c.student?.fullName.toLowerCase().includes(lowerSearch));
    }, [data, searchTerm]);

    const handleOpenFollowUp = (caseItem: CaseWithDetails) => {
        setSelectedCase(caseItem);
        setIsFollowUpModalOpen(true);
    };

    const handleGenerateDecePdf = async (caseId: number) => {
        try {
            await PdfGenerator.generateDeceFormPdf(caseId);
        } catch (e) {
            alert(`Error al generar PDF: ${e}`);
            console.error(e);
        }
    };
    
    const handleGenerateMatrix = async () => {
        if (!data) return;
        try {
            await PdfGenerator.generateSexualViolenceMatrixPdf(data);
        } catch (e) {
            alert(`Error al generar matriz: ${e}`);
            console.error(e);
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-dece-blue-800 dark:text-dece-blue-200 mb-6">Casos de Violencia Sexual</h1>
            <Card>
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                    <div className="relative w-full sm:w-72">
                        <input type="text" placeholder="Buscar por nombre de estudiante..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-2 pl-10 border rounded dark:bg-gray-700 dark:border-gray-600" />
                        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={handleGenerateMatrix} className="px-4 py-2 text-sm bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2">
                            <FileBarChart size={18} /> Generar Matriz
                        </button>
                        <button onClick={() => setIsFormModalOpen(true)} className="px-4 py-2 text-sm bg-dece-blue-600 text-white font-semibold rounded-md hover:bg-dece-blue-700 transition-colors flex items-center gap-2">
                            <PlusCircle size={18} /> Nuevo Caso de V.S.
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                       <thead className="bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="p-3 text-left">Alerta</th>
                                <th className="p-3 text-left">Último Seg.</th>
                                <th className="p-3 text-left">Víctima</th>
                                <th className="p-3 text-left hidden md:table-cell">Curso</th>
                                <th className="p-3 text-left hidden lg:table-cell">Infractor</th>
                                <th className="p-3 text-left hidden lg:table-cell">Delito</th>
                                <th className="p-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                       <tbody>
                            {!data ? (<tr><td colSpan={7}><LoadingSpinner/></td></tr>) : filteredData.map(c => {
                                const semaforo = Utils.getViolenceCaseSemaforo(c.dueDate, c.status);
                                return (
                                <tr key={c.id} className="border-b dark:border-gray-700">
                                    <td className="p-3"><div className={`w-4 h-4 rounded-full ${semaforo.bg}`} title={semaforo.label}></div></td>
                                    <td className="p-3">{c.lastFollowUpDate ? Utils.formatDate(c.lastFollowUpDate) : 'N/A'}</td>
                                    <td className="p-3 font-medium">{c.student?.fullName || 'N/A'}</td>
                                    <td className="p-3 hidden md:table-cell">{c.student ? `${c.student.course} "${c.student.parallel}"` : 'N/A'}</td>
                                    <td className="p-3 hidden lg:table-cell">{c.details?.infractorFullName || 'N/A'}</td>
                                    <td className="p-3 hidden lg:table-cell">{c.details?.crimeType || 'N/A'}</td>
                                    <td className="p-3 text-right">
                                       <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => handleOpenFollowUp(c)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-blue-500" aria-label="Ver seguimientos" title="Ver seguimientos">
                                                <Activity size={18} />
                                            </button>
                                            <button onClick={() => handleGenerateDecePdf(c.id!)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-green-500" aria-label="Generar Formulario DECE PDF" title="Generar Formulario DECE PDF">
                                                <FileText size={18} />
                                            </button>
                                       </div>
                                   </td>
                               </tr>
                            )})}
                       </tbody>
                    </table>
                </div>
            </Card>

            {isFormModalOpen && <SexualViolenceCaseFormModal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} />}
            {isFollowUpModalOpen && selectedCase && <SexualViolenceFollowUpModal isOpen={isFollowUpModalOpen} onClose={() => setIsFollowUpModalOpen(false)} caseFile={selectedCase} />}
        </div>
    );
};

export default SexualViolenceCasesPage;