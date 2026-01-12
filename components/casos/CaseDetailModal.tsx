
import React, { useState, FC, useMemo } from 'react';
import { db } from '../../database';
import type { FollowUp, CaseFile, Student, CaseCategoryItem, User } from '../../database';
import { useLiveQuery } from 'dexie-react-hooks';
import Modal from '../shared/Modal';
import LoadingSpinner from '../shared/LoadingSpinner';
import { Utils } from '../../utils/helpers';
import { Paperclip, ClipboardEdit, CheckCircle, FileDown, FileSignature, Bell } from 'lucide-react';
import PsychosocialInterviewModal from './PsychosocialInterviewModal';
import { PdfGenerator } from '../../utils/pdf';

interface CaseDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    caseId: number | null;
    currentUser: User;
}

const CaseDetailModal: FC<CaseDetailModalProps> = ({ isOpen, onClose, caseId, currentUser }) => {
    const caseData = useLiveQuery(async () => {
        if (!caseId) return null;
        const caseFile = await db.caseFiles.get(caseId);
        if (!caseFile) return null;
        const student = await db.students.get(caseFile.studentId);
        const representative = student ? await db.representatives.get(student.representativeId) : undefined;
        const teacher = student?.tutorId ? await db.teachers.get(student.tutorId) : undefined;
        const course = student ? await db.courses.filter(c => c.name === student.course && c.parallel === student.parallel).first() : undefined;
        const followUps = await db.followUps.where({ caseId }).sortBy('date');
        const interviews = await db.psychosocialInterviews.where({ caseFileId: caseId }).toArray();
        const institution = await db.institution.get(1);
        const allCategories = await db.caseCategories.toArray();
        return { caseFile, student, followUps, interviews, representative, teacher, course, institution, allCategories };
    }, [caseId]);
    
    const [followUpData, setFollowUpData] = useState<Partial<FollowUp>>({ date: new Date().toISOString().split('T')[0], isEffective: true, participantType: ['Estudiante'], responsible: currentUser.nombreCompleto });
    const [nextDueDate, setNextDueDate] = useState('');
    const [newAttachment, setNewAttachment] = useState<{ name: string; base64: string; type: string } | null>(null);
    const [isInterviewModalOpen, setIsInterviewModalOpen] = useState(false);

    const isRiskCase = useMemo(() => {
        if (!caseData) return false;
        const category = caseData.allCategories.find(c => c.name === caseData.caseFile.category);
        return category?.isProtected === true;
    }, [caseData]);

    const handleFollowUpChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            setFollowUpData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setFollowUpData(prev => ({...prev, [name]: e.target.value}));
        }
    };

    const handleParticipantTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target as HTMLInputElement;
        const type = value as 'Estudiante' | 'Representante' | 'Docente' | 'Autoridad';
        setFollowUpData(prev => {
            const currentTypes = prev.participantType || [];
            if (checked) {
                return { ...prev, participantType: [...currentTypes, type] };
            } else {
                return { ...prev, participantType: currentTypes.filter(t => t !== type) };
            }
        });
    };

    const handleFollowUpFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const attachment = await Utils.fileToBase64(file);
            setNewAttachment(attachment);
        } else {
            setNewAttachment(null);
        }
    };

    const handleAddFollowUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!caseId || !followUpData.description) return;
        try {
            const finalFollowUpData: FollowUp = {
                ...followUpData,
                caseId: caseId,
                attachment: newAttachment || undefined
            } as FollowUp;
            
            await db.followUps.add(finalFollowUpData);

            if (nextDueDate) {
                await db.caseFiles.update(caseId, { dueDate: nextDueDate });
            }
            // Reset form
            setFollowUpData({ 
                date: new Date().toISOString().split('T')[0], 
                description: '', 
                observations: '', 
                responsible: currentUser.nombreCompleto,
                interventionType: undefined,
                isEffective: true,
                participantType: ['Estudiante']
            });
            setNewAttachment(null);
            (e.target as HTMLFormElement).reset(); // Reset file input
        } catch(e) {
            alert(`Error al guardar seguimiento: ${e}`);
        }
    };
    
    const onGenerateConsent = () => caseData?.student && caseData?.representative && PdfGenerator.generateInformedConsentPdf(caseData.caseFile, caseData.student, caseData.representative, caseData.teacher, caseData.course);
    const onGenerateObservation = () => caseData?.student && PdfGenerator.generateObservationSheetPdf(caseData.caseFile, caseData.student, currentUser);
    const onGenerateReferral = () => caseData?.student && PdfGenerator.generateReferralPdf(caseData.caseFile, caseData.student, caseData.representative, caseData.teacher, caseData.course);
    const onGenerateMspReferral = () => caseData?.student && PdfGenerator.generateMspReferralPdf(caseData.caseFile, caseData.student, caseData.representative, caseData.teacher, caseData.course);
    const onGenerateTutorRiskNotification = () => {
        if (!caseData?.teacher) {
            alert("No se puede generar la notificación porque el estudiante no tiene un docente tutor asignado.");
            return;
        }
        if (!caseData?.student) return;
        PdfGenerator.generateTutorNotificationPdf(caseData.caseFile, caseData.student, caseData.teacher, currentUser);
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Detalle del Expediente" size="2xl">
            {!caseData ? <LoadingSpinner /> : (
                <div className="space-y-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="flex justify-between items-start">
                             <div>
                                <h3 className="text-xl font-bold">{caseData.student?.fullName || 'Estudiante no encontrado'}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{caseData.caseFile.category}</p>
                                <p className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-1">{caseData.caseFile.code}</p>
                            </div>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${Utils.getPriorityBadge(caseData.caseFile.priority)}`}>{caseData.caseFile.priority}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
                        <button onClick={onGenerateConsent} disabled={!caseData.student || !caseData.representative} className="btn-secondary text-sm flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-600"><FileSignature size={16} /> Consentimiento</button>
                        <button onClick={onGenerateObservation} disabled={!caseData.student} className="btn-secondary text-sm flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-600"><FileSignature size={16} /> Ficha Observación</button>
                        <button onClick={onGenerateReferral} disabled={!caseData.student} className="btn-secondary text-sm flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-600"><FileSignature size={16} /> Derivación</button>
                        <button onClick={onGenerateMspReferral} disabled={!caseData.student} className="btn-secondary text-sm flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-600"><FileSignature size={16} /> Oficio MSP</button>
                        <button onClick={onGenerateTutorRiskNotification} disabled={!isRiskCase} className="btn-secondary text-sm flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-600"><Bell size={16} /> Notificar a Tutor (Riesgo)</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <h4 className="font-semibold text-lg border-b pb-1">Seguimientos</h4>
                            <div className="max-h-60 overflow-y-auto space-y-3 pr-2">
                                {caseData.followUps.map(f => (
                                    <div key={f.id} className="p-2 border rounded-md dark:border-gray-600 text-sm">
                                        <p className="font-semibold">{Utils.formatDate(f.date)} - {f.responsible}</p>
                                        <p>{f.description}</p>
                                        {f.observations && <p className="text-xs italic text-gray-500">Obs: {f.observations}</p>}
                                        {f.attachment && <a href={f.attachment.base64} download={f.attachment.name} className="text-dece-blue-600 text-xs flex items-center gap-1"><Paperclip size={12}/> {f.attachment.name}</a>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <form onSubmit={handleAddFollowUp} className="space-y-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <h4 className="font-semibold text-lg">Registrar Nuevo Seguimiento</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-sm">Fecha</label><input type="date" name="date" value={followUpData.date || ''} onChange={handleFollowUpChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required /></div>
                                <div><label className="text-sm">Tipo de Intervención</label><select name="interventionType" value={followUpData.interventionType || ''} onChange={handleFollowUpChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"><option value="">Seleccione...</option><option>Individual</option><option>Familiar</option><option>Grupal</option><option>Crisis</option></select></div>
                            </div>
                            <div>
                                <label className="text-sm">Participantes</label>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                    {(['Estudiante', 'Representante', 'Docente', 'Autoridad'] as const).map(type => (
                                        <label key={type} className="flex items-center gap-1 text-sm"><input type="checkbox" value={type} checked={followUpData.participantType?.includes(type)} onChange={handleParticipantTypeChange} />{type}</label>
                                    ))}
                                </div>
                            </div>
                            <div><label className="text-sm">Descripción</label><textarea name="description" value={followUpData.description || ''} onChange={handleFollowUpChange} rows={3} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required></textarea></div>
                            <div><label className="text-sm">Observaciones</label><textarea name="observations" value={followUpData.observations || ''} onChange={handleFollowUpChange} rows={2} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"></textarea></div>
                             <div><label className="text-sm">Adjunto</label><input type="file" onChange={handleFollowUpFileChange} className="mt-1 w-full p-1 border rounded text-xs dark:bg-gray-700 dark:border-gray-600"/></div>
                            <div><label className="text-sm">Próximo Seguimiento</label><input type="date" value={nextDueDate} onChange={e => setNextDueDate(e.target.value)} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" name="isEffective" id="isEffective" checked={followUpData.isEffective ?? true} onChange={handleFollowUpChange} className="h-4 w-4 rounded border-gray-300 text-dece-blue-600 focus:ring-dece-blue-500" />
                                <label htmlFor="isEffective" className="text-sm font-medium">Atención Efectiva (contará para estadísticas)</label>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setIsInterviewModalOpen(true)} className="flex items-center gap-2 bg-purple-600 text-white px-3 py-2 text-sm rounded-md hover:bg-purple-700 font-semibold"><ClipboardEdit size={16}/> Realizar Entrevista</button>
                                <button type="submit" className="flex items-center gap-2 bg-dece-blue-600 text-white px-3 py-2 text-sm rounded-md hover:bg-dece-blue-700 font-semibold"><CheckCircle size={16} /> Guardar Seguimiento</button>
                            </div>
                        </form>
                    </div>

                    {isInterviewModalOpen && <PsychosocialInterviewModal isOpen={isInterviewModalOpen} onClose={() => setIsInterviewModalOpen(false)} caseFile={caseData.caseFile} student={caseData.student} />}
                </div>
            )}
        </Modal>
    );
};

export default CaseDetailModal;
